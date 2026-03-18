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

Note: SharedArrayBuffer was considered and could be swapped in later. The only files that would change are `dsp-processor.js` and `late-convolution-worker.js` — the C++ side is unaffected.

---

## C++ Classes

Files: `dsp/convolution_mt.h` and `dsp/convolution_mt.cpp`

**Note:** Files use underscores (not hyphens) for consistency with C++ naming conventions.

**Design decisions:**

- `EarlyConvolutionEngine` and `LateConvolutionEngine` are **mono** engines
- Stereo handled by `EarlyStereoConvolutionReverb` / `LateStereoConvolutionReverb` wrapper classes
- No `prepare`, no `setMix`, no `dryBuffer_` — AudioEngine manages wet/dry externally
- A free function `multiplyAndAccumulateFFTs` is defined at the top of the `.cpp`, shared by both classes
- **JUCE removed** — uses custom `fft.h`/`fft.cpp` instead of `juce::dsp::FFT`. This fixed the metallic output bug that was caused by JUCE's packed FFT format being incompatible with the standard interleaved complex multiply.

**Constants (both classes):**

```
fftSize_    = 512
blockSize_  = 128
segmentSize_ = fftSize_ - blockSize_ = 384
```

**EarlyConvolutionEngine — COMPLETE**

```
Private members:
  numIrSegments_                       size_t
  currSegment_                         size_t
  irLoaded_                            bool (default false)
  irSegmentsFFT_                       vector<vector<float>>  (size fftSize_*2 each)
  overlapBuffer_                       vector<float>, size fftSize_

Public API:
  loadIR(irData, irLength)
    - guard: null/zero → return
    - resize overlapBuffer_ to fftSize_
    - call reset() to clear stale state
    - compute numIrSegments_ = ceil(irLength / segmentSize_)
    - for each segment:
        - zero-pad irSamples to fftSize_
        - fft(irSamples, irSegmentsFFT_[segment], fftSize_)
    - set irLoaded_ = true

  process(input, output, numSamples)
    - guard: !irLoaded_ → copy input to output, return
    - zero-pad input to fftSize_ → drySamples
    - fft(drySamples, dryFFT, fftSize_)
    - multiplyAndAccumulateFFTs(dryFFT, irSegmentsFFT_[0], combinedFFT)
    - ifftReal(combinedFFT, combinedSamples, fftSize_)
    - output[i] = combinedSamples[i] + overlapBuffer_[i]  for i in 0..numSamples-1
    - overlap-add tail into overlapBuffer_

  reset()
    - currSegment_ = 0
    - zero overlapBuffer_
```

**LateConvolutionEngine — COMPLETE**

Same structure as Early, plus `inputHistoryFFT_` circular buffer.

```
process(input, output, numSamples)
  - guard: !irLoaded_ → copy input to output, return
  - zero-pad input → drySamples, fft → dryFFT
  - store dryFFT in inputHistoryFFT_[currSegment_]
  - for segment = 1..numIrSegments_-1:
      segmentsBackIdx = (currSegment_ + numIrSegments_ - segment) % numIrSegments_
      multiplyAndAccumulateFFTs(inputHistoryFFT_[segmentsBackIdx], irSegmentsFFT_[segment], combinedFFT)
  - ifftReal + overlap-add (same as Early)
  - currSegment_ = (currSegment_ + 1) % numIrSegments_
```

**Stereo wrappers — COMPLETE**

`EarlyStereoConvolutionReverb` and `LateStereoConvolutionReverb`:

- `loadIR(irData, irLengthPerChannel, numChannels)`: deinterleaves stereo IR into left/right, loads each mono engine
- `process(left, right, numSamples)`: calls left/right engine in-place
- `reset()`: calls both engines

---

## multiplyAndAccumulateFFTs

```cpp
void multiplyAndAccumulateFFTs(
  const std::vector<float>& fftDry,
  const std::vector<float>& fftIr,
  std::vector<float>& fftOutput)
```

Standard complex multiply-accumulate in interleaved format (real, imag, real, imag...):

- `(a + bi)(c + di) = (ac - bd) + (cb + ad)i`
- Steps by 2 over full buffer, accumulates into fftOutput

---

## audio_engine.h/.cpp — COMPLETE

- `audio_engine.h`: includes `convolution_mt.h`, owns `EarlyStereoConvolutionReverb earlyConvolution_`
- `audio_engine.cpp`: calls `earlyConvolution_.process()` and `earlyConvolution_.loadIR()`
- `EMSCRIPTEN_BINDINGS`: `LateStereoConvolutionReverb` bound with `allow_raw_pointers()` for `loadIR` and `process`
- `dsp/CMakeLists.txt`: `convolution_mt.cpp` and `fft.cpp` added to sources, JUCE dependency kept for other modules

---

## Per-Block Flow (every 128 samples)

```
AudioWorkletProcessor process():
  1. Run EarlyStereoConvolutionReverb.process(left, right, 128)   ← synchronous
  2. If lateResult is available: sum it into output
  3. lateWorkerPort.postMessage({ type: 'process', data: { left, right } }, [buffers])
     ← transfer this block's audio to the worker

late-convolution-worker.js port.onmessage:
  1. Write left/right into WASM heap
  2. Run LateStereoConvolutionReverb.process(left, right, 128)
  3. Read output from WASM heap into wetLeft/wetRight
  4. port.postMessage({ type: 'process', left: wetLeft, right: wetRight }, [buffers])

AudioWorkletProcessor handleLateResult():
  Store result → summed into output next block at step 2
```

---

## IR Loading Flow (once per IR selection)

1. `use-audio-engine.ts` sends `loadIR` to the AudioWorklet (loads `EarlyStereoConvolutionReverb`)
2. `use-audio-engine.ts` also sends `loadIR` directly to the Worker (loads `LateStereoConvolutionReverb`)
3. A copy of the samples (`workerSamples = samples.slice()`) is made before transferring to the AudioWorklet, since transferring detaches the original buffer

---

## JS Wiring (Main Thread)

AudioWorklets can't directly spawn Web Workers. The connection is made on the main thread using a `MessageChannel`:

```js
const channel = new MessageChannel();
audioWorkletNode.port.postMessage({ type: 'lateWorkerPort', port: channel.port1 }, [channel.port1]);
worker.postMessage({ port: channel.port2 }, [channel.port2]);
```

The AudioWorkletProcessor and Worker then communicate directly via `port1 ↔ port2`, bypassing the main thread entirely on every audio block.

---

## Files

| File                                         | Status         | Notes                                                                                 |
| -------------------------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| `dsp/convolution_mt.h`                       | Complete       | All 4 classes, JUCE removed, uses fft.h                                               |
| `dsp/convolution_mt.cpp`                     | Complete       | Working — metallic output bug fixed by switching to custom FFT                        |
| `dsp/fft.h/.cpp`                             | Complete       | Custom FFT used by convolution_mt                                                     |
| `dsp/convolution.h/.cpp`                     | Untouched      | Leave alone — original single-threaded reverb, kept for reference                    |
| `dsp/audio_engine.h/.cpp`                    | Complete       | Uses `EarlyStereoConvolutionReverb`, binds `LateStereoConvolutionReverb`              |
| `dsp/CMakeLists.txt`                         | Complete       | `convolution_mt.cpp` and `fft.cpp` added to sources                                  |
| `frontend/public/late-convolution-worker.js` | Complete       | Loads WASM, owns `LateStereoConvolutionReverb`, handles loadIR/process/reset via port |
| `frontend/public/dsp-processor.js`           | Complete       | Wires lateWorkerPort, sends dry blocks, sums late result                              |
| `frontend/src/hooks/use-audio-engine.ts`     | Complete       | Spawns worker, creates MessageChannel, sends IR to both AudioWorklet and worker       |

---

## Known Issue — Wrong Signal Sent to Late Engine

Currently `dsp-processor.js` sends `wasmLeft`/`wasmRight` (the fully mixed wet output) to the late worker instead of the pre-reverb dry signal. The correct signal is `kickL_ + noiseL_` / `kickR_ + noiseR_` computed inside `audio_engine.cpp` before `earlyConvolution_.process()` is called.

**Fix needed:** Add a method to `AudioEngine` that exposes the pre-reverb buffer:

```cpp
void getDrySignal(uintptr_t leftPtr, uintptr_t rightPtr, int numSamples);
```

Bind it in `EMSCRIPTEN_BINDINGS`, call it in `dsp-processor.js` after `this.engine.process()`, and send that to the worker instead of `wasmLeft`/`wasmRight`.

This is why only the early convolution is audible — the late engine is receiving incorrect input.

---

## Build Changes

None beyond adding source files to CMakeLists.txt. No new Emscripten flags. No `-pthread`. No server header changes. The existing `SINGLE_FILE` WASM output is loaded by the Worker the same way it's loaded by the AudioWorklet.
