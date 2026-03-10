# Multithreaded Convolution Plan

## The Problem

30s IR @ 44100 Hz = ~1.3M samples.
Current implementation: 512-point FFT, 128-sample blocks, uniform partitions.
That means ~10,336 partitions to sum every 128 samples. Too slow for one thread.

## The Solution: Non-Uniform Partitioned Convolution (NUPC)

Split the IR into two zones:

- **Early reflections** (first ~50ms): small FFT partitions, processed on the AudioWorklet thread (real-time, low latency)
- **Late tail** (rest of 30s): large FFT partitions, processed on a Web Worker thread (background, latency is fine for reverb tail)

Results from the two zones are summed using SharedArrayBuffer.

## Learning Steps

### Step 1 — Own the current code (Monday, ~2h)
Read `convolution.h` and `convolution.cpp` until you can explain:
- What `loadIR()` stores and in what form
- What happens inside `process()` every 128 samples
- What "overlap-add" actually means here

### Step 2 — Understand why it breaks for long IRs (Tuesday, ~1h)
Work out the math: how many partitions does a 30s IR create? How much work per block?
This motivates NUPC — not just "it's slow" but exactly where the bottleneck is.

### Step 3 — NUPC theory (Tuesday, ~2h)
Read one clear resource on non-uniform partitioned convolution.
Goal: understand partition scheduling — why mixing FFT sizes helps.

### Step 4 — Web Workers + SharedArrayBuffer (Tuesday–Wednesday, ~3h)
Learn:
- How to create a Web Worker from an AudioWorklet context
- SharedArrayBuffer: what it is, why it needs COOP/COEP headers
- Atomics: how to coordinate reads/writes between threads without data races

### Step 5 — Implement (Wednesday–Thursday, ~8h)
1. Split IR at a crossover point (e.g. 4096 samples ≈ 93ms)
2. Early part: keep in AudioWorklet (current convolution engine, possibly widened FFT)
3. Late part: large-FFT partitions, computed in Web Worker, result written to SharedArrayBuffer
4. Sum early + late output each block

### Step 6 — Test with real 30s IR (Thursday, ~2h)
Verify no glitches, correct tail decay, reasonable latency.

## Timeline Check

| Day | Hours | Goal |
|-----|-------|------|
| Mon | 2h | Step 1 — read current code |
| Tue | 5h | Steps 2, 3, start 4 |
| Wed | 5h | Finish 4, start 5 |
| Thu | 5h | Finish 5, do 6 |
| Fri | buffer | Polish / debug |

**17 hours is tight but realistic** if you stay focused on the MVP:
just get a 30s IR running without glitches. No need to perfectly tune crossover points or
optimize partition schedules this week.

## Key Risk

SharedArrayBuffer requires server headers (`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`). Check early that your dev server supports this —
it's a blocker for Web Workers + shared memory.
