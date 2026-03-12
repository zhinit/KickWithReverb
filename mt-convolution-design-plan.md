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
- Stereo will be handled by `StereoEarlyConvolutionReverb` / `StereoLateConvolutionReverb` wrapper classes added at the end (same pattern as existing `StereoConvolutionReverb`)
- Both classes written from scratch based on the TypeScript OverlapAddConvolver mental model — NOT derived from existing `convolution.cpp`
- A free function `multiplyAndAccumulateFFTs` is defined at the top of the `.cpp`, shared by both classes

**Constants (both classes):**
```
fftOrder_ = 9        (2^9 = 512)
fftSize_  = 512
blockSize_ = 128
segmentSize_ = fftSize_ - blockSize_ = 384
```

**EarlyConvolutionEngine — COMPLETE**

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
    - zero all inputHistoryFFT_ segments (note: inputHistoryFFT_ unused in Early, can be removed)
```

**LateConvolutionEngine — TODO**

Needs all the same members as Early, plus:
- `segmentSize_` constant (missing from header currently — add it)
- `irLoaded_` bool (missing from header currently — add it)

`loadIR`: same as Early — loads ALL segments. `process()` skips segment 0, iterates segments 1..N-1.

The key difference in `process()`:
- Must FFT the current input block and store it in `inputHistoryFFT_` (circular buffer)
- For each IR segment k (1..N-1): multiply `inputHistoryFFT_[k blocks ago]` × `irSegmentsFFT_[k]`, accumulate into combined
- Then IFFT + overlap-add same as Early

---

## multiplyAndAccumulateFFTs (free function in convolution-mt.cpp)

```cpp
void multiplyAndAccumulateFFTs(
  const std::vector<float>& fftDry,
  const std::vector<float>& fftIr,
  std::vector<float>& fftOutput)
```

Complex multiply-accumulate, JUCE interleaved format (real, imag, real, imag...):
- `(a + bi)(c + di) = (ac - bd) + (cb + ad)i`
- Steps by 2, accumulates into fftOutput

---

## Per-Block Flow (every 128 samples)

```
AudioWorkletProcessor process():
  1. Run EarlyConvolutionEngine.process(input, output, 128)   ← synchronous
  2. If lateResult is available: sum it into output
  3. postMessage({ inputBlock }, [inputBlock.buffer])
     ← transfer this block's input to the worker

late-convolution-worker.js onmessage:
  1. Write inputBlock into WASM heap
  2. Run LateConvolutionEngine.process(input, output, 128)
  3. Read output from WASM heap into resultBlock
  4. postMessage({ resultBlock }, [resultBlock.buffer])

AudioWorkletProcessor onmessage:
  Store resultBlock → summed into output next block at step 2
```

Note: both engines are mono. The AudioWorklet runs Early L+R separately, and the Worker runs Late L+R separately. The stereo wrappers handle this.

---

## IR Loading Flow (once per IR selection)

1. AudioWorklet loads IR into `StereoEarlyConvolutionReverb` as normal
2. AudioWorklet also postMessages the full IR data to the Worker
3. Worker loads it into `StereoLateConvolutionReverb`

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

## Files

| File | Status | Notes |
|------|--------|-------|
| `dsp/convolution-mt.h` | In progress | EarlyConvolutionEngine done. LateConvolutionEngine needs `segmentSize_` and `irLoaded_` added. |
| `dsp/convolution-mt.cpp` | In progress | EarlyConvolutionEngine done. LateConvolutionEngine stubs only. |
| `dsp/convolution.h/.cpp` | Untouched | Existing file, leave alone for now |
| `dsp/audio_engine.h/.cpp` | TODO | Replace `StereoConvolutionReverb` with `StereoEarlyConvolutionReverb` |
| `dsp/audio_engine.cpp` | TODO | Add `LateConvolutionEngine` / `StereoLateConvolutionReverb` to `EMSCRIPTEN_BINDINGS` |
| `frontend/public/late-convolution-worker.js` | TODO | Web Worker: loads WASM, owns `StereoLateConvolutionReverb`, handles messages |
| `frontend/src/hooks/use-audio-engine.ts` | TODO | Create `MessageChannel`, spawn Worker, wire ports |

---

## Build Changes

None. No new Emscripten flags. No `-pthread`. No server header changes. The existing `SINGLE_FILE` WASM output is loaded by the Worker the same way it's loaded by the AudioWorklet.

---

## Next Steps (when returning)

1. Fix `LateConvolutionEngine` header — add `segmentSize_` and `irLoaded_`
2. Implement `LateConvolutionEngine::loadIR` (same as Early)
3. Implement `LateConvolutionEngine::process` — same structure as Early but:
   - Store FFT'd input in `inputHistoryFFT_` circular buffer each block
   - Loop over segments 1..N-1, multiplying each against the appropriate historical input
4. Implement `LateConvolutionEngine::reset`
5. Add stereo wrapper classes to the bottom of convolution-mt.h/.cpp
6. Wire into AudioEngine and build
7. Implement the JS side (Worker + MessageChannel)
