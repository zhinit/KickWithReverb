#include "fft.h"
#include <numbers>
#include <vector>

void
fft(const float* input, float* output, size_t size)
{
  // base case when we are down to 1 sample
  // just return the sample with no imaginary part
  if (size == 1) {
    output[0] = input[0];
    output[1] = 0.0f;
    return;
  }

  // split input into even and odd samples
  std::vector<float> evenSamples(size / 2);
  std::vector<float> oddSamples(size / 2);
  size_t j = 0;
  for (size_t i = 0; i < size; i += 2) {
    evenSamples[j] = input[i];
    oddSamples[j] = input[i + 1];
    j++;
  }

  std::vector<float> evenSpectra(size);
  std::vector<float> oddSpectra(size);
  fft(evenSamples.data(), evenSpectra.data(), size / 2);
  fft(oddSamples.data(), oddSpectra.data(), size / 2);

  // combine
  for (size_t k = 0; k < size; k += 2) {
    // get root of unity, call it w
    float theta = -2.0f * std::numbers::pi_v<float> * k / size;
    float wReal = std::cos(theta);
    float wImag = std::sin(theta);

    // get even/odd real/imaginary pieces
    float evenReal = evenSpectra[k];
    float evenImag = evenSpectra[k + 1];
    float oddReal = oddSpectra[k];
    float oddImag = oddSpectra[k + 1];

    // y[k] = y_even[k] + w^k y_odd[k]
    // y[k + N/2] = y_even[k] - w^k y_odd[k]
    output[k] = evenReal + wReal * oddReal - wImag * oddImag;
    output[k + 1] = evenImag + wReal * oddImag + wImag * oddReal;
    output[k + size] = evenReal - (wReal * oddReal - wImag * oddImag);
    output[k + size + 1] = evenImag - (wReal * oddImag + wImag * oddReal);
  }
}

void
ifft(const float* input, float* output, size_t size)
{
  return;
}
