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

### Step 1: Set Up WASM Build System ✅ DONE

- `dsp/CMakeLists.txt` — CPM fetches JUCE 8.0.12, includes both WASM patches, outputs to `react/public/audio-engine.js`
- `react/vite.config.ts` — COOP/COEP headers added
- `.gitignore` — `dsp/build/` excluded
- Build verified: `cd dsp && emcmake cmake -B build && cmake --build build`

---

### Step 2: Build the SamplePlayer Class ✅ DONE

- `dsp/sample_player.h` / `dsp/sample_player.cpp` — Stores multiple samples in `vector<vector<float>>`, supports `loadSample`, `selectSample`, `trigger`, `stop` (with linear fade-out envelope), `process`, `setReleaseDuration`, `setVolume`, `setSampleRate`
- `dsp/audio_engine.cpp` — Uses SamplePlayer for kick and noise, exposes `loadKickSample`, `selectKickSample`, `setKickRelease`, `loadNoiseSample`, `selectNoiseSample`, `setNoiseVolume`, `cue` via EMSCRIPTEN_BINDINGS
- Build verified

---

### Step 3: Port Effects from POC ✅ DONE

- `dsp/distortion.h/.cpp` — Copied from POC (tanh + asymmetric waveshaper)
- `dsp/ott.h/.cpp` — Modified from POC: constructor takes `ratioMultiplier` (kick=10, master=8) and per-band EQ scaling (`lowEqPerAmount`, `midEqPerAmount`, `highEqPerAmount`). All bands use same down ratio formula: `1 + ratioMultiplier * amount`. EQ gains applied per-band after compression, scaled by amount.
- `dsp/convolution.h/.cpp` — Copied from POC (FFT overlap-add, stereo wrapper with wet/dry mix)
- `dsp/filter.h` — Wrapper around `juce::dsp::StateVariableTPTFilter` with `setType(lowpass/highpass)`, `setFrequency(hz)`, `process()`
- `dsp/limiter.h` — Wrapper around `juce::dsp::Limiter` with 0dB ceiling, 50ms release
- Build verified

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
