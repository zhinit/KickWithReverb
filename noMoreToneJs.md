# Migration Plan: Tone.js → JUCE/WASM

## Goal

Replace all Tone.js audio processing with a C++ JUCE-based DSP engine compiled to WebAssembly via Emscripten. The React UI stays the same — hooks post messages to an AudioWorklet instead of calling Tone.js APIs.

## Current Tone.js Usage (What We're Replacing)

15 Tone.js APIs across 5 hooks:

- **Kick layer** (`useKickLayer.ts`): `Tone.Sampler` → `Tone.Distortion` → `Tone.MultibandCompressor` + `Tone.EQ3` + `Tone.Gain` (OTT effect)
- **Noise layer** (`useNoiseLayer.ts`): `Tone.Player` → `Tone.Filter` (lowpass) → `Tone.Filter` (highpass)
- **Reverb layer** (`useReverbLayer.ts`): `Tone.Convolver` → `Tone.Filter` (lowpass) → `Tone.Filter` (highpass) → `Tone.Gain`
- **Master chain** (`useMasterChain.ts`): `Tone.MultibandCompressor` + `Tone.EQ3` + `Tone.Gain` (OTT) → `Tone.Distortion` → `Tone.Gain` → `Tone.Limiter`
- **Transport** (`useTransport.ts`): `Tone.getTransport()` + 2x `Tone.Loop` (kick every quarter note, noise every 2 measures)

## New C++ Audio Engine Architecture

```
C++ AudioEngine (single class, owns everything)
│
├── KickPlayer (SamplePlayer instance)
│   ├── Stores multiple kick samples (loaded upfront)
│   ├── selectSample(index) to switch active sample
│   ├── trigger() resets playback position
│   └── setReleaseDuration(seconds) for fade-out envelope
│
├── Kick Effects
│   ├── Distortion (reused from POC — juce::dsp::WaveShaper)
│   └── OTTCompressor (reused from POC — modified for KickWithReverb params)
│       ├── MultibandCompressor (3-band Linkwitz-Riley crossover)
│       ├── EQ: mid = -3 * amount, low = 9 * amount
│       └── Compression ratio = 1 + 10 * amount (all bands)
│
├── NoisePlayer (SamplePlayer instance)
│   ├── Stores multiple noise samples (loaded upfront)
│   ├── Loops internally, retriggers on 2-bar boundary
│   └── 0.1s fade-out on stop
│
├── Noise Filters
│   ├── LowpassFilter (juce::dsp::StateVariableTPTFilter)
│   └── HighpassFilter (juce::dsp::StateVariableTPTFilter)
│
├── ConvolutionReverb (reused from POC — FFT overlap-add)
│   ├── Stores multiple IRs (loaded upfront)
│   ├── selectIR(index) to switch active IR
│   ├── LowpassFilter (post-reverb tone shaping)
│   └── HighpassFilter (post-reverb tone shaping)
│
├── Master Chain
│   ├── OTTCompressor (separate instance, different settings)
│   │   ├── EQ: mid = -3 * amount, low = 3 * amount
│   │   └── Compression ratio = 1 + 8 * amount
│   ├── Distortion (separate instance)
│   ├── Gain (limiter makeup, range 1-4 linear)
│   └── Limiter (juce::dsp::Limiter, 0dB ceiling)
│
└── Transport (internal sample counting)
    ├── BPM → samplesPerBeat calculation
    ├── Kick loop: trigger every beat (quarter note)
    └── Noise loop: trigger every 8 beats (2 measures at 4/4)
```

### Signal Flow in `AudioEngine::process()`

```
1. Advance loop counters, trigger kick/noise at boundaries

2. KickPlayer.process() → kickDistortion.process() → kickOTT.process()
   → kickOutput (stereo buffer)

3. NoisePlayer.process() → noiseLowpass.process() → noiseHighpass.process()
   → noiseOutput (stereo buffer)

4. Mix kickOutput + noiseOutput → reverbInput
   ConvolutionReverb.process(reverbInput) → reverbLowpass → reverbHighpass
   → reverbOutput (stereo buffer)

5. Mix dry signals + reverbOutput → masterInput
   masterOTT.process() → masterDistortion.process() → masterLimiterGain → masterLimiter.process()
   → final stereo output
```

### SamplePlayer Class Design

Unified class used for both kick and noise:

```cpp
class SamplePlayer {
public:
    void loadSample(uintptr_t ptr, size_t length);       // Add sample to internal storage
    void selectSample(int index);                          // Switch active sample
    void trigger();                                        // Reset playback to position 0
    void stop();                                           // Stop with fade-out
    void process(float* left, float* right, int numSamples);
    void setReleaseDuration(float seconds);                // Fade-out envelope length
    void setVolume(float gainLinear);                      // Output level

private:
    std::vector<std::vector<float>> samples_;              // All loaded samples
    int activeSampleIndex_ = 0;
    size_t position_ = 0;
    float releaseDuration_ = 0.0f;
    float volume_ = 1.0f;
    // Envelope state for fade-out
};
```

## Implementation Steps

### Step 1: Set Up WASM Build System

**What:** Add the Emscripten/CMake build pipeline to KickWithReverb.

**Tasks:**
- Create `dsp/` directory at project root
- Add `CMakeLists.txt` adapted from the POC (`ThereminWebJuce/CMakeLists.txt`)
- Configure CPM to fetch JUCE 8.0.12
- Include both JUCE patches (thread priorities table + missing emscripten include)
- Set output path to `react/public/audio-engine.js`
- Add COOP/COEP headers to `react/vite.config.ts`:
  ```
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```
- Build a minimal test (empty process function) to verify the pipeline works

**Verify:** `emcmake cmake -B build && cmake --build build` produces `react/public/audio-engine.js`

---

### Step 2: Build the SamplePlayer Class

**What:** Reusable audio sample player for both kick and noise.

**Tasks:**
- Create `dsp/sample_player.h` and `dsp/sample_player.cpp`
- Implement `loadSample()` — copies Float32Array data from WASM heap into internal vector
- Implement `selectSample(index)` — switches active buffer, resets position
- Implement `trigger()` — resets position to 0
- Implement `stop()` — initiates fade-out envelope
- Implement `process()` — reads from active sample buffer, applies volume and fade envelope
- Implement `setReleaseDuration()` and `setVolume()`
- Handle end-of-sample gracefully (output silence)

**Verify:** Unit test or simple worklet test that loads a sample and plays it back

---

### Step 3: Port Effects from POC

**What:** Bring over the DSP effects and adapt them for KickWithReverb's parameter scheme.

**Tasks:**
- Copy `dsp/distortion.h`, `dsp/distortion.cpp` from POC (no changes needed, same waveshaper)
- Copy `dsp/ott.h`, `dsp/ott.cpp` from POC
  - Modify `OTTCompressor` to expose per-band EQ control: `setEQ(lowDb, midDb, highDb)`
  - Add configurable ratio multiplier so kick (10x) and master (8x) can differ
  - Keep the existing 3-band Linkwitz-Riley crossover and BandCompressor logic
- Copy `dsp/convolution.h`, `dsp/convolution.cpp` from POC (no changes needed)
- Create `dsp/filter.h` — thin wrapper around `juce::dsp::StateVariableTPTFilter`
  - `setFrequency(hz)`, `setType(lowpass/highpass)`, `process(left, right, numSamples)`
- Add limiter using `juce::dsp::Limiter` (or simple soft-clip if JUCE limiter has issues in WASM)

**Verify:** Each effect processes audio correctly in isolation

---

### Step 4: Build the AudioEngine Orchestrator

**What:** Top-level C++ class that owns all players, effects, and transport. Single entry point for the AudioWorklet.

**Tasks:**
- Create `dsp/audio_engine.h` and `dsp/audio_engine.cpp`
- Own: 2x `SamplePlayer`, 2x `Distortion`, 2x `OTTCompressor`, `StereoConvolutionReverb`, 4x `Filter`, `Limiter`, `Gain`
- Implement `prepare(sampleRate)` — initializes all components
- Implement `process(leftPtr, rightPtr, numSamples)` — full signal flow (see diagram above)
- Implement transport logic:
  - `setBPM(bpm)` — recalculates `samplesPerBeat_`
  - `setLooping(bool)` — start/stop loop
  - `cue()` — single trigger of kick (and noise if appropriate)
  - Internal sample counters for kick (every beat) and noise (every 8 beats)
- Implement all parameter setters:
  - Kick: `loadKickSample()`, `selectKickSample(index)`, `setKickRelease(seconds)`, `setKickDistortion(amount)`, `setKickOTT(amount)`
  - Noise: `loadNoiseSample()`, `selectNoiseSample(index)`, `setNoiseVolume(db)`, `setNoiseLowPass(hz)`, `setNoiseHighPass(hz)`
  - Reverb: `loadIR()`, `selectIR(index)`, `setReverbLowPass(hz)`, `setReverbHighPass(hz)`, `setReverbVolume(db)`
  - Master: `setMasterOTT(amount)`, `setMasterDistortion(amount)`, `setMasterLimiter(amount)`
  - Transport: `setBPM(bpm)`, `setLooping(bool)`, `cue()`
- Add `EMSCRIPTEN_BINDINGS` block exposing all public methods

**Verify:** Build compiles. Can instantiate engine, load a sample, trigger, and get non-silent output.

---

### Step 5: Create the AudioWorklet Bridge

**What:** JavaScript AudioWorklet processor that bridges React ↔ WASM.

**Tasks:**
- Create `react/public/dsp-processor.js` (adapted from POC)
- Implement initialization flow:
  1. Receive Emscripten glue code via `postMessage("init")`
  2. Instantiate WASM module via `new Function()` + `createAudioEngine()`
  3. Create `AudioEngine` instance, call `prepare(sampleRate)`
  4. Send `"ready"` back to main thread
- Implement message handlers for all parameters (see message protocol below)
- Implement `process()`:
  1. Allocate WASM heap buffers for left/right output
  2. Call `engine.process(leftPtr, rightPtr, 128)`
  3. Copy WASM heap → JS output buffers
- Handle memory management: `_malloc` / `_free` for sample data transfers

**Message Protocol:**
```
init                    → Load WASM module
loadKickSample          → { samples: Float32Array }
loadNoiseSample         → { samples: Float32Array }
loadIR                  → { irSamples: Float32Array, irLength, numChannels }
selectKickSample        → { index: number }
selectNoiseSample       → { index: number }
selectIR                → { index: number }
cue                     → (no data)
loop                    → { enabled: boolean }
bpm                     → { value: number }
kickRelease             → { value: number }      (0-0.3 seconds)
kickDistortion          → { value: number }       (0-0.5 wet mix)
kickOTT                 → { value: number }        (0-1)
noiseVolume             → { value: number }        (-70 to -6 dB)
noiseLowPass            → { value: number }        (30-7000 Hz)
noiseHighPass           → { value: number }        (30-7000 Hz)
reverbLowPass           → { value: number }        (30-7000 Hz)
reverbHighPass          → { value: number }        (30-7000 Hz)
reverbVolume            → { value: number }        (-60 to 0 dB)
masterOTT               → { value: number }        (0-1)
masterDistortion        → { value: number }        (0-0.5 wet mix)
masterLimiter           → { value: number }        (1-4 linear gain)
```

**Verify:** Worklet loads, receives "ready", processes silent audio without errors.

---

### Step 6: Replace React Hooks with WASM-Backed Versions

**What:** Rewrite each audio hook to post messages to the AudioWorklet instead of using Tone.js.

**New hook: `useAudioEngine.ts`**
- Creates `AudioContext` on first user interaction
- Fetches `audio-engine.js`, loads AudioWorklet
- Creates `AudioWorkletNode` with stereo output, connects to destination
- Loads ALL samples/IRs upfront:
  - Decode each kick .wav → `Float32Array` → `postMessage("loadKickSample")`
  - Decode each noise .mp3 → `Float32Array` → `postMessage("loadNoiseSample")`
  - Decode each IR .wav → `Float32Array` → `postMessage("loadIR")`
- Returns `{ postMessage, isReady }` for child hooks to use
- Provides sample name → index mapping

**Rewrite: `useKickLayer.ts`**
- Remove all Tone.js node creation
- Keep React state for UI (sample, len, distortionAmt, ottAmt)
- On state change → `postMessage` to worklet with new values
- `trigger()` → `postMessage({ type: "cue" })`
- `getState()` unchanged (reads React state)
- `setters` unchanged (write React state, which triggers postMessage)

**Rewrite: `useNoiseLayer.ts`**
- Same pattern: React state for UI, postMessage for audio

**Rewrite: `useReverbLayer.ts`**
- Same pattern: React state for UI, postMessage for audio
- IR selection → `postMessage({ type: "selectIR", index })`

**Rewrite: `useMasterChain.ts`**
- Same pattern: React state + postMessage

**Rewrite: `useTransport.ts`**
- Remove `Tone.getTransport()` and `Tone.Loop`
- BPM change → `postMessage({ type: "bpm", value })`
- Play/stop → `postMessage({ type: "loop", enabled })`
- Cue → `postMessage({ type: "cue" })`

**Verify:** Each hook compiles. UI renders. Parameter changes reach the worklet (console.log in worklet).

---

### Step 7: Update Daw.tsx Wiring

**What:** Simplify the DAW component now that audio routing is internal to C++.

**Tasks:**
- Remove the `useEffect` blocks that wire Tone.js nodes together (kick→reverb, noise→reverb, reverb→master connections)
- Add `useAudioEngine()` hook at the top of Daw
- Pass the engine's `postMessage` to child hooks (via prop or context)
- Preset loading/saving stays the same — setters now post messages internally
- Remove `Tone.start()` call — replaced by AudioContext creation in `useAudioEngine`

**Verify:** DAW renders, presets bar works, all knobs/selects are wired up.

---

### Step 8: Remove Tone.js

**What:** Clean up all Tone.js dependencies.

**Tasks:**
- `npm uninstall tone` from `react/`
- Delete any remaining `import * as Tone from "tone"` statements
- Remove `Tone.start()`, `Tone.dbToGain()`, and any other Tone utility usage
  - Replace `Tone.dbToGain()` with: `Math.pow(10, db / 20)`
- Remove unused Tone.js type references
- Run build to verify no remaining Tone.js references

**Verify:** `npm run build` succeeds with zero Tone.js references. App bundle size should decrease significantly.

---

### Step 9: Testing & Verification

**What:** Ensure audio quality and feature parity.

**Tasks:**
- Load each existing preset and verify all parameters apply correctly
- Compare audio output:
  - Kick samples play correctly with proper release envelope
  - Noise loops smoothly with filter sweeps
  - Distortion character matches (tanh + asymmetric term)
  - OTT compression sounds correct at various amounts
  - Convolution reverb with IR switching
  - Master chain processing (OTT → distortion → limiter)
- Test transport: play, stop, cue, BPM changes
- Test sample switching for all three layers (kick, noise, IR)
- Test preset save → reload roundtrip (all 20 parameters)
- Test authentication flow still works (presets require auth)
- Test on Chrome and Firefox (AudioWorklet support)
- Check for audio glitches, clicks, or silence gaps

---

## Reference: POC Project Location

The proof-of-concept code to port from:
```
/Users/hookline/coding/learning/learn_juce/ThereminWebJuce/
├── CMakeLists.txt          → Adapt for Step 1
├── dsp/sampler.cpp         → Reference for Step 4 (AudioEngine pattern)
├── dsp/distortion.h/.cpp   → Copy for Step 3
├── dsp/ott.h/.cpp          → Copy + modify for Step 3
├── dsp/convolution.h/.cpp  → Copy for Step 3
└── frontend/public/dsp-processor.js → Adapt for Step 5
```

## Preset Parameter Mapping (20 params)

| Preset Field | Message Type | Value Range |
|---|---|---|
| bpm | bpm | 60-365 |
| kickSample | selectKickSample | index (0-N) |
| kickLen | kickRelease | 0-0.3 seconds |
| kickDistAmt | kickDistortion | 0-0.5 |
| kickOttAmt | kickOTT | 0-1 |
| noiseSample | selectNoiseSample | index (0-N) |
| noiseLowPassFreq | noiseLowPass | 30-7000 Hz |
| noiseHighPassFreq | noiseHighPass | 30-7000 Hz |
| noiseVolume | noiseVolume | -70 to -6 dB |
| reverbSample | selectIR | index (0-N) |
| reverbLowPassFreq | reverbLowPass | 30-7000 Hz |
| reverbHighPassFreq | reverbHighPass | 30-7000 Hz |
| reverbVolume | reverbVolume | -60 to 0 dB |
| masterOttAmt | masterOTT | 0-1 |
| masterDistAmt | masterDistortion | 0-0.5 |
| masterLimiterAmt | masterLimiter | 1-4 linear |
