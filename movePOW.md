# Port Multithreaded Convolution Reverb into kick-with-reverb

Replace the single-threaded ConvolutionEngine with the Gardner-partitioned multithreaded convolution from dsp-sandbox.

## Step 1: COOP/COEP Headers

SharedArrayBuffer requires specific HTTP headers.

**Vite dev server (`vite.config.ts`):**
- Add headers plugin:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: credentialless`

**Vercel production (`vercel.json`):**
- Add same headers for all routes

**Test:** Site still loads, Supabase audio URLs not blocked.

## Step 2: Copy C++ Files

Copy from `dsp-sandbox/dsp/` into `kick-with-reverb/dsp/`:
- `fft.h`
- `fft.cpp`
- `convolution_mt.h`
- `convolution_mt.cpp`

## Step 3: Create `tail_worker.cpp`

Adapt from `dsp-sandbox/dsp/tail_worker.cpp`:
- Wraps TailEngine for L/R channels
- WASM bindings: `processBlock()`, `prepareIR()`, `loadNextLevel()`, `getLevelsRemaining()`
- Compiled as separate WASM target (`tail-engine.js`)

## Step 4: Modify AudioEngine

In `audio_engine.h/.cpp`:
- Replace `StereoConvolutionReverb` with two `ConvolutionLevel` instances (L/R, level 0 only)
- Level 0: period=1, 2 partitions, instant computation, runs synchronously in `process()`
- Add `addTailWet(leftPtr, rightPtr, numSamples)` method — accepts tail worker results, applies reverb filters (lowpass, highpass) and gain in C++
- Expose dry reverb input (kick+noise mix) via pointer so AudioWorklet can copy it to the shared ring buffer
- Update `selectIR()` to call `ConvolutionLevel::loadIR()` for level 0

## Step 5: Delete Old Convolution

Remove from `kick-with-reverb/dsp/`:
- `convolution.h`
- `convolution.cpp`

## Step 6: Update CMakeLists.txt

- Add `fft.cpp`, `convolution_mt.cpp` to `audio-engine` target source list
- Remove `convolution.cpp` from source list
- Add second WASM target `tail-engine`:
  - Sources: `tail_worker.cpp`, `convolution_mt.cpp`, `fft.cpp`
  - Flags: `ENVIRONMENT=worker`, `MODULARIZE=1`, `EXPORT_NAME=createTailEngine`, `SINGLE_FILE=1`
  - Output: `frontend/public/tail-engine.js`
- JUCE stays — still used for filters, distortion, OTT, limiter

## Step 7: Build WASM

```bash
cd dsp && rm -rf build && emcmake cmake -B build && cmake --build build
```

Produces `frontend/public/audio-engine.js` + `frontend/public/tail-engine.js`.

## Step 8: Test Level 0 Only

Reverb works with just the first 2 partitions of the IR (short reverb, no tail). Verify correct output before adding the worker.

## Step 9: Add `tail-worker.js`

Create `frontend/public/tail-worker.js`, adapted from `dsp-sandbox/frontend/public/tail-worker.js`:
- Receives `tail-engine.js` glue code on startup, instantiates WASM
- Receives IR data from main thread, calls `prepareIR()` + `loadNextLevel()` in a loop
- Main loop: `Atomics.wait(dryWriteCount)` → read dry from shared ring → `processBlock()` → write wet L/R to shared ring → `Atomics.store(wetWriteCount)`

## Step 10: Modify `dsp-processor.js`

- Allocate SharedArrayBuffer:
  - `dryWriteCount (4B)` | `wetWriteCount (4B)` | `dryRing` | `wetRingL` | `wetRingR`
- Each `process()` frame:
  1. Call `engine.process()` (includes level 0 convolution)
  2. Copy dry reverb input (kick+noise) into shared dry ring
  3. `Atomics.store(dryWriteCount)` + `Atomics.notify()`
  4. Check `wetWriteCount` — if tail worker posted results, read wet L/R from shared ring
  5. Pass tail wet into `engine.addTailWet()` for reverb filters + gain
  6. Output final mixed buffer

## Step 11: Modify `use-audio-engine.ts`

- After AudioWorklet ready:
  1. Fetch `tail-engine.js` glue code
  2. Create `new Worker('tail-worker.js')`
  3. Send glue code to worker, wait for "ready"
  4. Broker SharedArrayBuffer handoff: AudioWorklet → main thread → tail worker
- When IR loaded: send raw IR Float32Array to tail worker (for levels 1+)
- On cleanup: terminate tail worker

## Step 12: Test Full Pipeline

Load a long IR, verify:
- Level 0 provides immediate early reflections
- Tail reverb fades in from the worker
- Reverb filters and volume controls still work
- No clicks or dropouts

## Step 13: Deploy

- Push to main
- Verify COEP headers on Vercel
- Test with Supabase audio URLs (AI kicks)

## Notes

- No changes needed to `use-reverb-layer.ts` or any other hooks/UI — the multithreaded convolution is invisible to the frontend
- JUCE FFT is only replaced for convolution; other JUCE DSP (filters, etc.) unchanged
- `credentialless` COEP policy avoids breaking cross-origin Supabase fetches
