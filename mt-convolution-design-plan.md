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

## C++ Classes — Actual Implementation

Files: `dsp/convolution-mt.h` and `dsp/convolution-mt.cpp`

**Design decisions made:**

- `EarlyConvolutionEngine` and `LateConvolutionEngine` are **mono** engines (not stereo directly)
- Stereo handled by `EarlyStereoConvolutionReverb` / `LateStereoConvolutionReverb` wrapper classes (no `prepare`, no `setMix`, no `dryBuffer_` — AudioEngine manages wet/dry externally)
- A free function `multiplyAndAccumulateFFTs` is defined at the top of the `.cpp`, shared by both classes
- **Known issue**: reverb produces metallic output. Root cause not yet confirmed — suspect the JUCE FFT output format requires the same `prepareForConvolution`/`updateSymmetricFrequencyDomainData` treatment as `convolution.cpp`. **Next session: investigate and fix.**

**Constants (both classes):**

```
fftOrder_ = 9        (2^9 = 512)
fftSize_  = 512
blockSize_ = 128
segmentSize_ = fftSize_ - blockSize_ = 384
```

**EarlyConvolutionEngine — IMPLEMENTED (but broken, see above)**

```
Private members:
  numIrSegments_                       size_t
  currSegment_                         size_t
  irLoaded_                            bool (default false)
  irSegmentsFFT_                       vector<vector<float>>
  overlapBuffer_                       vector<float>, size fftSize_
  fft_                                 juce::dsp::FFT{fftOrder_}

Public API:
  loadIR(irData, irLength)
    - guard: null/zero → return
    - resize overlapBuffer_ to fftSize_ with zeros
    - call reset() to clear stale state
    - compute numIrSegments_ = ceil(irLength / segmentSize_)
    - for each segment: resize to fftSize_*2 zeros, copy IR samples, FFT in-place
    - set irLoaded_ = true

  process(input, output, numSamples)
    - guard: !irLoaded_ → copy input to output, return
    - build drySegment (fftSize_*2, zero-padded), copy input in, FFT
    - build combined (fftSize_*2, zeros)
    - multiplyAndAccumulateFFTs(drySegment, irSegmentsFFT_[0], combined)
    - IFFT combined
    - output[i] = combined[i] + overlapBuffer_[i]  for i in 0..numSamples-1
    - combined[i] += overlapBuffer_[i]              for i in numSamples..fftSize_-1
    - copy combined[numSamples..fftSize_-1] → overlapBuffer_[0..segmentSize_-1]
    - zero overlapBuffer_[fftSize_-numSamples..fftSize_-1]

  reset()
    - currSegment_ = 0
    - zero overlapBuffer_
```

**LateConvolutionEngine — IMPLEMENTED (but broken, see above)**

Same structure as Early, plus `inputHistoryFFT_` circular buffer.

```
process(input, output, numSamples)
  - guard: !irLoaded_ → copy input to output, return
  - build drySegment, FFT it, store in inputHistoryFFT_[currSegment_]
  - build combined (fftSize_*2, zeros)
  - for segment = 1..numIrSegments_-1:
      segmentsBackIdx = (currSegment_ + numIrSegments_ - segment) % numIrSegments_
      multiplyAndAccumulateFFTs(inputHistoryFFT_[segmentsBackIdx], irSegmentsFFT_[segment], combined)
  - IFFT + overlap-add (same as Early)
  - currSegment_ = (currSegment_ + 1) % numIrSegments_
```

**Stereo wrappers — COMPLETE**

`EarlyStereoConvolutionReverb` and `LateStereoConvolutionReverb`:

- No `prepare`, no `setMix`, no `dryBuffer_`
- `loadIR`: deinterleaves stereo IR into left/right, loads each mono engine
- `process(left, right, numSamples)`: calls left/right engine in-place
- `reset()`: calls both engines

---

## multiplyAndAccumulateFFTs (free function in convolution-mt.cpp)

```cpp
void multiplyAndAccumulateFFTs(
  const std::vector<float>& fftDry,
  const std::vector<float>& fftIr,
  std::vector<float>& fftOutput)
```

Standard complex multiply-accumulate, JUCE interleaved format (real, imag, real, imag...):

- `(a + bi)(c + di) = (ac - bd) + (cb + ad)i`
- Steps by 2 over full buffer, accumulates into fftOutput
- **Suspected broken** — may need to use `prepareForConvolution` format like `convolution.cpp`

---

## audio_engine.h/.cpp — COMPLETE

- `audio_engine.h`: includes `convolution-mt.h`, owns `EarlyStereoConvolutionReverb convolution_`
- `audio_engine.cpp`: removed `convolution_.prepare()` and `convolution_.setMix()` calls from `prepare()`
- `EMSCRIPTEN_BINDINGS`: `LateStereoConvolutionReverb` bound with `allow_raw_pointers()` for `loadIR` and `process`
- `dsp/CMakeLists.txt`: `convolution-mt.cpp` added to sources

---

## Per-Block Flow (every 128 samples)

```
AudioWorkletProcessor process():
  1. Run EarlyStereoConvolutionReverb.process(left, right, 128)   ← synchronous
  2. If lateResult is available: sum it into output
  3. postMessage({ inputLeft, inputRight }, [buffers])
     ← transfer this block's input to the worker

late-convolution-worker.js onmessage:
  1. Write inputLeft/Right into WASM heap
  2. Run LateStereoConvolutionReverb.process(left, right, 128)
  3. Read output from WASM heap into resultLeft/Right
  4. postMessage({ resultLeft, resultRight }, [buffers])

AudioWorkletProcessor onmessage:
  Store result → summed into output next block at step 2
```

---

## IR Loading Flow (once per IR selection)

1. AudioWorklet loads IR into `EarlyStereoConvolutionReverb` as normal
2. AudioWorklet also postMessages the full IR data to the Worker
3. Worker loads it into `LateStereoConvolutionReverb`

---

## JS Wiring (Main Thread)

AudioWorklets can't directly spawn Web Workers. The connection is made on the main thread using a `MessageChannel`:

```js
const channel = new MessageChannel();
audioWorkletNode.port.postMessage({ port: channel.port1 }, [channel.port1]);
worker.postMessage({ port: channel.port2 }, [channel.port2]);
```

The AudioWorkletProcessor and Worker then communicate directly via `port1 ↔ port2`, bypassing the main thread entirely on every audio block.

---

## Files

| File                                         | Status              | Notes                                                                        |
| -------------------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| `dsp/convolution-mt.h`                       | Complete            | All 4 classes done                                                           |
| `dsp/convolution-mt.cpp`                     | Implemented, broken | FFT multiply produces metallic output — fix `multiplyAndAccumulateFFTs`      |
| `dsp/convolution.h/.cpp`                     | Untouched           | Leave alone                                                                  |
| `dsp/audio_engine.h/.cpp`                    | Complete            | Uses `EarlyStereoConvolutionReverb`, binds `LateStereoConvolutionReverb`     |
| `dsp/CMakeLists.txt`                         | Complete            | `convolution-mt.cpp` added                                                   |
| `frontend/public/late-convolution-worker.js` | TODO                | Web Worker: loads WASM, owns `LateStereoConvolutionReverb`, handles messages |
| `frontend/src/hooks/use-audio-engine.ts`     | TODO                | Create `MessageChannel`, spawn Worker, wire ports                            |

---

## Build Changes

None. No new Emscripten flags. No `-pthread`. No server header changes. The existing `SINGLE_FILE` WASM output is loaded by the Worker the same way it's loaded by the AudioWorklet.

---

## Next Steps (when returning)

1. **Fix `multiplyAndAccumulateFFTs`** — investigate whether JUCE's `performRealOnlyForwardTransform` output requires the `prepareForConvolution`/`updateSymmetricFrequencyDomainData` treatment from `convolution.cpp` before multiplying. Try using those helper functions instead of standard complex multiply.
2. Confirm reverb sounds correct with Early-only (segment 0)
3. Implement `frontend/public/late-convolution-worker.js`
4. Wire `MessageChannel` in `frontend/src/hooks/use-audio-engine.ts`
