# Migration Plan: Tone.js → JUCE/WASM

## Goal

Replace all Tone.js audio processing with a C++ JUCE-based DSP engine compiled to WebAssembly via Emscripten. The React UI stays the same — hooks post messages to an AudioWorklet instead of calling Tone.js APIs.

## C++ Audio Engine Architecture

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
│   ├── Distortion (tanh + asymmetric waveshaper)
│   └── OTTCompressor (3-band Linkwitz-Riley, ratio = 1 + 10 * amount, EQ: low = 9 * amount, mid = -3 * amount)
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
├── ConvolutionReverb (FFT overlap-add, stereo)
│   ├── Stores multiple IRs (loaded upfront)
│   ├── selectIR(index) to switch active IR
│   ├── LowpassFilter (post-reverb tone shaping)
│   └── HighpassFilter (post-reverb tone shaping)
│
├── Master Chain
│   ├── OTTCompressor (ratio = 1 + 8 * amount, EQ: low = 3 * amount, mid = -3 * amount)
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

## Implementation Steps

### Step 1: WASM Build System ✅ DONE

CMakeLists.txt with CPM/JUCE/Emscripten, COOP/COEP headers in Vite, outputs to `react/public/audio-engine.js`.

### Step 2: SamplePlayer Class ✅ DONE

`dsp/sample_player.h/.cpp` — multi-sample storage, trigger/stop with fade-out envelope, looping support.

### Step 3: Port Effects from POC ✅ DONE

Distortion, OTT, Convolution, Filter, Limiter — all ported from ThereminWebJuce POC.

### Step 4: AudioEngine Orchestrator ✅ DONE

`dsp/audio_engine.h/.cpp` — owns all DSP objects, full signal flow, transport, 20 parameter setters + EMSCRIPTEN_BINDINGS.

### Step 5: AudioWorklet Bridge ✅ DONE

`react/public/dsp-processor.js` — WASM init via postMessage, all 20+ message handlers, heap buffer management.

### Step 6: React Hooks Rewrite ✅ DONE

All hooks rewritten to take `AudioEngine` handle, postMessage on state change, `isReady` guard pattern.

### Step 7: Daw.tsx Wiring ✅ DONE

- `useAudioEngine()` at top, passed to all hooks
- Removed Tone.js node wiring `useEffect`s
- Removed transport trigger callbacks
- Cleaned `usePresets` interface (no more `noise.stop`, `scheduleNoiseRetrigger`)

### Step 8: Remove Tone.js ✅ DONE

- `npm uninstall tone` — zero Tone.js references remain in source
- No `Tone.dbToGain()` replacements needed (hooks were already fully rewritten in step 6)

---

### Step 9: Testing & Troubleshooting

**What:** Ensure audio quality and feature parity.

**Known Issues:**

- [ ] **Reverb not audible** — reverb volume knob may not be connected to a wet/dry mix. The convolution engine has a wet/dry parameter but `reverbVolume` might only control gain, not the mix level. Check that the reverb send path is producing output and that the volume control maps correctly.

- [ ] **Noise samples slow to load / gray and seasick don't load** — these files may be larger or in a format that `decodeAudioData` struggles with. Check console for decode errors. May need to convert problematic files to WAV or check if they exceed a size limit in the WASM heap transfer.

- [ ] **Noise doesn't play on cue button** — the `cue` message only triggers the kick in the C++ engine. The noise player may not be triggered by `cue`, only by the transport loop. Need to add noise triggering to the cue handler in `AudioEngine`.

- [ ] **Limiter gain range too low** — current range is 1-4 linear. Should be able to push higher for more aggressive limiting/loudness. Increase the max value in both the C++ setter and the React hook's knob mapping.

---

## Message Protocol

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
