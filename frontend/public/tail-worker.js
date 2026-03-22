const BLOCK = 128;
const MAX_RING_BLOCKS = 64;

let engine = null;
let module = null;
let heapDryPtr = null;

// SharedArrayBuffer views
let dryWriteCount = null;
let wetWriteCount = null;
let dryRing = null;
let wetRingL = null;
let wetRingR = null;

function processLoop() {
  let lastProcessed = 0;

  while (true) {
    Atomics.wait(dryWriteCount, 0, lastProcessed);
    const writeCount = Atomics.load(dryWriteCount, 0);

    while (lastProcessed < writeCount) {
      const readIdx = (lastProcessed % MAX_RING_BLOCKS) * BLOCK;
      const drySub = dryRing.subarray(readIdx, readIdx + BLOCK);
      module.HEAPF32.set(drySub, heapDryPtr / 4);
      engine.processBlock(heapDryPtr);

      const wetIdx = (lastProcessed % MAX_RING_BLOCKS) * BLOCK;
      lastProcessed++;
      const leftPtr = engine.getResultLeft();
      const rightPtr = engine.getResultRight();
      const wetLSub = module.HEAPF32.subarray(leftPtr / 4, leftPtr / 4 + BLOCK);
      const wetRSub = module.HEAPF32.subarray(
        rightPtr / 4,
        rightPtr / 4 + BLOCK,
      );
      wetRingL.set(wetLSub, wetIdx);
      wetRingR.set(wetRSub, wetIdx);
      Atomics.store(wetWriteCount, 0, lastProcessed);
    }
  }
}

self.onmessage = async (e) => {
  const data = e.data;

  if (data.type === "init") {
    const fn = new Function(data.scriptCode + "; return createTailEngine;");
    const createTailEngine = fn();
    module = await createTailEngine();
    engine = new module.TailWorker();
    heapDryPtr = module._malloc(BLOCK * 4);
    self.postMessage({ type: "ready" });
  }

  if (data.type === "sharedBuffer") {
    const sab = data.sab;
    dryWriteCount = new Int32Array(sab, 0, 1);
    wetWriteCount = new Int32Array(sab, 4, 1);
    dryRing = new Float32Array(sab, 8, MAX_RING_BLOCKS * BLOCK);
    const wetLOffset = 8 + MAX_RING_BLOCKS * BLOCK * 4;
    const wetROffset = wetLOffset + MAX_RING_BLOCKS * BLOCK * 4;
    wetRingL = new Float32Array(sab, wetLOffset, MAX_RING_BLOCKS * BLOCK);
    wetRingR = new Float32Array(sab, wetROffset, MAX_RING_BLOCKS * BLOCK);
  }

  if (data.type === "loadIR") {
    const irPtr = module._malloc(data.irSamples.length * 4);
    module.HEAPF32.set(data.irSamples, irPtr / 4);
    engine.prepareIR(irPtr, data.irLength, data.numChannels);
    module._free(irPtr);

    while (engine.loadNextLevel()) {}

    // signal ready THEN enter loop — main thread forwards this to worklet
    self.postMessage({ type: "tailReady" });
    processLoop();
  }
};
