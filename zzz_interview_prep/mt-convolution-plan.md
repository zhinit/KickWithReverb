# Multithreaded Convolution Reverb — Handoff

## Context

Interview is Friday March 13 with Marc at Suno. The multithreaded convolution reverb is the main thing to build before then. Sam specifically suggested it.

## Current DSP State

- `dsp/convolution.h` already exists with `ConvolutionEngine` (partitioned overlap-add, JUCE FFT, 128-sample blocks) and `StereoConvolutionReverb` (stereo wrapper)
- The engine already segments the IR into `irSegmentsFFT_` internally
- Compiled to WASM, lives in the existing KWR app

## Algorithm Understanding (built Tuesday)

User built the full algorithm from scratch in TypeScript in `zzz_interview_prep/audio_problems/naive_convolution/`:
- DFT, IDFT, multiply-spectra, linear-convolve, overlap-add-convolver

User understands the overlap-add algorithm deeply. Do NOT re-explain it.

## Plan for Next Session

Help the user write a proper plan for adding multithreading to the existing C++ DSP. The plan should live in this file. Do NOT write code — lay out files, architecture, key decisions. Let the user drive.

Key things to figure out together:
- How to split the existing `ConvolutionEngine` into early/late partitions
- Threading approach in C++ (std::thread, mutex, condition_variable)
- WASM pthread requirements (SharedArrayBuffer, COOP/COEP headers, Emscripten flags)
- How the audio thread and worker thread communicate without blocking
