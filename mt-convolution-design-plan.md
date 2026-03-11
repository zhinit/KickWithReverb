# Multithreaded Convolution Reverb — Design Plan

## Goal

Split the existing convolution reverb into two engines: an early engine (segment 0, audio thread) and a late engine (segments 1..N-1, Web Worker). The two outputs are summed together. No added latency on the direct sound. ~3ms added latency on the reverb tail, which is inaudible.

---

## Why This Works

The IR is naturally split into two regions:
- **Segment 0** (first 384 samples, ~8.7ms): the attack and early reflections — needs to feel immediate
- **Segments 1..N-1** (the tail): already delayed by nature, one extra block (~3ms) is inaudible

The early engine runs synchronously on the audio thread. The late engine runs in a Web Worker one block behind.

---

## Communication

`postMessage` + transferable `Float32Array`s. No SharedArrayBuffer, no mutexes, no COOP/COEP headers required.

---

## C++ Classes

Two new classes written from scratch (based on the TypeScript OverlapAddConvolver mental model). Both handle stereo directly — no mono engine + stereo wrapper split.

```
EarlyConvolutionEngine
  - loadIR(irData, irLengthPerChannel, numChannels)
      → FFTs all segments, stores them. process() only uses segment 0.
  - process(left, right, numSamples)
  - reset()

LateConvolutionEngine
  - loadIR(irData, irLengthPerChannel, numChannels)
      → FFTs all segments, stores them. process() only uses segments 1..N-1.
  - process(left, right, numSamples)
  - reset()
```

Both receive the full IR. The split happens internally in `process()` — not at load time.

`AudioEngine` replaces its existing `StereoConvolutionReverb` with `EarlyConvolutionEngine`.

`LateConvolutionEngine` is exposed via `EMSCRIPTEN_BINDINGS` so the Web Worker can instantiate it.

---

## Per-Block Flow (every 128 samples)

```
AudioWorkletProcessor process():
  1. Run EarlyConvolutionEngine.process(left, right, 128)   ← synchronous
  2. If lateResult is available: sum leftLate/rightLate into left/right
  3. postMessage({ leftIn, rightIn }, [leftIn.buffer, rightIn.buffer])
     ← transfer this block's input to the worker

late-convolution-worker.js onmessage:
  1. Write leftIn/rightIn into WASM heap
  2. Run LateConvolutionEngine.process(left, right, 128)
  3. Read output from WASM heap into leftOut/rightOut
  4. postMessage({ leftOut, rightOut }, [leftOut.buffer, rightOut.buffer])

AudioWorkletProcessor onmessage:
  Store leftOut/rightOut → picked up next block at step 2
```

---

## IR Loading Flow (once per IR selection)

1. AudioWorklet loads IR into `EarlyConvolutionEngine` as normal
2. AudioWorklet also postMessages the full IR data to the Worker
3. Worker loads it into `LateConvolutionEngine`

---

## JS Wiring (Main Thread)

AudioWorklets can't directly spawn Web Workers. The connection is made on the main thread using a `MessageChannel`:

```js
const channel = new MessageChannel()
audioWorkletNode.port.postMessage({ port: channel.port1 }, [channel.port1])
worker.postMessage({ port: channel.port2 }, [channel.port2])
```

The AudioWorkletProcessor and Worker then communicate directly via `port1 ↔ port2`, bypassing the main thread entirely on every audio block.

---

## New Files

| File | Purpose |
|------|---------|
| `dsp/convolution.h` | Add `EarlyConvolutionEngine`, `LateConvolutionEngine` declarations |
| `dsp/convolution.cpp` | Implement both classes |
| `frontend/public/late-convolution-worker.js` | Web Worker: loads WASM, owns `LateConvolutionEngine`, handles messages |

## Modified Files

| File | Change |
|------|--------|
| `dsp/audio_engine.h/.cpp` | Replace `StereoConvolutionReverb` with `EarlyConvolutionEngine` |
| `dsp/audio_engine.cpp` | Add `LateConvolutionEngine` to `EMSCRIPTEN_BINDINGS` |
| `frontend/src/hooks/use-audio-engine.ts` | Create `MessageChannel`, spawn Worker, wire ports |

---

## Build Changes

None. No new Emscripten flags. No `-pthread`. No server header changes. The existing `SINGLE_FILE` WASM output is loaded by the Worker the same way it's loaded by the AudioWorklet.
