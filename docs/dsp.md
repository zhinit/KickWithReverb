# DSP Engine Reference

C++ JUCE-based audio engine compiled to WASM via Emscripten. Lives in `dsp/`.

## Build

```bash
cd dsp
rm -rf build                          # clean rebuild recommended after CMake changes
emcmake cmake -B build && cmake --build build
```

Output: `react/public/audio-engine.js` (SINGLE_FILE with embedded WASM, ~1.5MB)

## Files

| File                   | Class                                          | Purpose                                                                                                                                                                                      |
| ---------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio_engine.h/.cpp`  | `AudioEngine`                                  | Top-level orchestrator. Owns all players/effects/transport. EMSCRIPTEN_BINDINGS here.                                                                                                        |
| `sample_player.h/.cpp` | `SamplePlayer`                                 | Stores multiple samples in `vector<vector<float>>`. Supports trigger/stop, fade-out envelope, looping. Used for kick and noise.                                                              |
| `distortion.h/.cpp`    | `Distortion`                                   | `juce::dsp::WaveShaper` with `tanh(x*drive) + 0.1*x*x`. `setDrive(float)`. AudioEngine manages wet/dry mix externally.                                                                       |
| `ott.h/.cpp`           | `OTTCompressor`, `BandCompressor`              | 3-band Linkwitz-Riley crossover (100Hz/2500Hz). Per-band up/down compression + EQ scaling by amount. Constructor takes `(ratioMultiplier, lowEqPerAmount, midEqPerAmount, highEqPerAmount)`. |
| `convolution.h/.cpp`   | `ConvolutionEngine`, `StereoConvolutionReverb` | FFT overlap-add convolution (order 9, 512-point FFT, 128-sample blocks). Stereo wrapper with wet/dry mix.                                                                                    |
| `filter.h`             | `Filter`                                       | Wrapper around `juce::dsp::StateVariableTPTFilter`. `setType(lowpass/highpass)`, `setFrequency(hz)`. Header-only.                                                                            |
| `limiter.h`            | `Limiter`                                      | Wrapper around `juce::dsp::Limiter`. 0dB ceiling, 50ms release. Header-only.                                                                                                                 |

## Signal Flow (in `AudioEngine::process`)

```
1. Transport: advance sample counter, trigger kick every beat, noise every 8 beats

2. Kick: SamplePlayer → Distortion (wet/dry blend by kickDistortionMix_) → OTTCompressor(10, 9, -3, 0)

3. Noise: SamplePlayer(looping=true) → LowpassFilter → HighpassFilter

4. Reverb (send): (kick+noise) → StereoConvolutionReverb(wet=1.0) → LowpassFilter → HighpassFilter → reverbGain_
   (skipped if activeIRIndex_ < 0; ConvolutionEngine passes through dry signal if irLoaded_=false)

5. Master: (kick+noise+reverb) → OTTCompressor(8, 3, -3, 0) → Distortion (wet/dry blend) → masterLimiterGain_ → Limiter
```

## AudioEngine Public API (all exposed via EMSCRIPTEN_BINDINGS)

### Lifecycle

- `prepare(sampleRate)` — Init all components, set noise looping + 0.1s release
- `process(leftPtr, rightPtr, numSamples)` — Main audio callback (128 samples from AudioWorklet)

### Kick

- `loadKickSample(ptr, length)` — Add sample from WASM heap
- `selectKickSample(index)` — Switch active sample
- `setKickRelease(seconds)` — Fade-out envelope (0-0.3s)
- `setKickDistortion(amount)` — Wet/dry mix (0-0.5)
- `setKickOTT(amount)` — Compression amount (0-1)

### Noise

- `loadNoiseSample(ptr, length)` — Add sample from WASM heap
- `selectNoiseSample(index)` — Switch active sample
- `setNoiseVolume(db)` — Volume in dB (-70 to -6), converted to linear internally
- `setNoiseLowPass(hz)` — Lowpass cutoff (30-7000)
- `setNoiseHighPass(hz)` — Highpass cutoff (30-7000)

### Reverb

- `loadIR(ptr, irLength, numChannels)` — Store IR in irStorage\_ vector
- `selectIR(index)` — Reload convolution engine with stored IR
- `setReverbLowPass(hz)` — Post-reverb lowpass (30-7000)
- `setReverbHighPass(hz)` — Post-reverb highpass (30-7000)
- `setReverbVolume(db)` — Reverb level in dB (-60 to 0), converted to linear

### Master

- `setMasterOTT(amount)` — Compression amount (0-1)
- `setMasterDistortion(amount)` — Wet/dry mix (0-0.5)
- `setMasterLimiter(amount)` — Pre-limiter gain (1-4 linear)

### Transport

- `setBPM(bpm)` — Recalculates samplesPerBeat\_ (60-365)
- `setLooping(enabled)` — Start: triggers kick+noise, resets counters. Stop: fades out noise.
- `cue()` — Single kick trigger

## Key Design Decisions

- **Distortion wet/dry**: AudioEngine saves dry copy, processes through Distortion, blends with `mix` amount. Distortion drive is fixed at 6.0.
- **Reverb as send**: Convolution set to 100% wet. Dry signals bypass reverb. Reverb output added at master mix point.
- **IR storage**: Raw IR data stored in `irStorage_` vector. `loadIR` only stores data; `selectIR` must be called to actually load into the convolution engine (involves FFT partitioning). Convolution outputs pass-through until an IR is selected.
- **Noise looping**: SamplePlayer has `setLooping(bool)`. When true, position wraps to 0 at end of sample. Envelope fade-out still works across loop boundary.
- **Block size**: All scratch buffers are `std::array<float, 128>`. OTT band buffers also 128. AudioWorklet always sends exactly 128 samples.
- **Transport**: Beat triggers checked once per block (not sample-accurate). Max ~3ms imprecision at 44.1kHz, acceptable for this use case.

## CMake Notes (`dsp/CMakeLists.txt`)

- CPM fetches JUCE 8.0.12
- Two JUCE patches applied for WASM: thread priorities table + missing emscripten.h include
- Emscripten flags: `MODULARIZE=1`, `EXPORT_NAME=createAudioEngine`, `SINGLE_FILE=1`
- Exports `_malloc`, `_free`, `HEAPF32` for sample data transfer from JS
- **Memory flags** (critical for loading audio samples):
  - `ALLOW_MEMORY_GROWTH=1` — lets WASM heap grow dynamically as needed
  - `INITIAL_MEMORY=67108864` — starts with 64MB heap (default 16MB is insufficient for loading multiple audio samples + IRs)
