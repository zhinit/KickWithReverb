#pragma once
#include <cstddef>

void
fft(const float* input, float* output, size_t size);

void
ifftReal(const float* input, float* output, size_t size);

void
ifft(const float* input, float* output, size_t size);
