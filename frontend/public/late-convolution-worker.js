importScripts("./audio-engine.js");

let wasmReady = false;
let Module;
let lateReverb;

createAudioEngine().then((mod) => {
  Module = mod;
  wasmReady = true;
  lateReverb = new Module.LateStereoConvolutionReverb();
});

// handles loadIR and reset from main thread
self.onmessage = (e) => {
  if (!wasmReady) return;

  const { type, data } = e.data;

  // receives the MessageChannel port from the main thread
  if (e.data.port) {
    const port = e.data.port;
    port.onmessage = (e) => {
      if (!wasmReady) return;
      const { type, data } = e.data;
      if (type === "process") {
        const ptrLeft = Module._malloc(data.left.length * 4);
        Module.HEAPF32.set(data.left, ptrLeft / 4);
        const ptrRight = Module._malloc(data.right.length * 4);
        Module.HEAPF32.set(data.right, ptrRight / 4);

        lateReverb.process(ptrLeft, ptrRight, 128);
        const wetLeft = Module.HEAPF32.slice(ptrLeft / 4, ptrLeft / 4 + 128);
        const wetRight = Module.HEAPF32.slice(ptrRight / 4, ptrRight / 4 + 128);
        port.postMessage({ type: "process", left: wetLeft, right: wetRight }, [
          wetLeft.buffer,
          wetRight.buffer,
        ]);

        Module._free(ptrLeft);
        Module._free(ptrRight);
      }
    };
    return;
  }

  switch (type) {
    case "loadIR": {
      const ptr = Module._malloc(data.samples.length * 4);
      Module.HEAPF32.set(data.samples, ptr / 4);
      lateReverb.loadIR(
        ptr,
        data.samples.length / data.numChannels,
        data.numChannels,
      );
      Module._free(ptr);
      break;
    }
    case "reset": {
      lateReverb.reset();
      break;
    }
  }
};
