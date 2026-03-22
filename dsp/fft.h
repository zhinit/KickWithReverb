#pragma once
#include <cstddef>

void
fft(const float* input, float* output, size_t size);

void
ifftReal(const float* input,
         float* output,
         size_t size,
         float* workBuf = nullptr);

void
ifft(const float* input, float* output, size_t size);

// --- steppable FFT ---

struct FFTState
{
  float* data;        // interleaved complex buffer (caller-owned)
  size_t size;        // complex samples
  int totalStages;    // log2(size)
  int currentStage;
  bool forward;
  size_t groupOffset; // progress within current stage
};

void
fft_init(FFTState& state, const float* realInput);

void
ifft_init(FFTState& state, const float* complexInput);

bool
fft_partial(FFTState& state, size_t maxGroups, size_t& butterfliesOut);

void
ifft_extract_real(const FFTState& state, float* output);
