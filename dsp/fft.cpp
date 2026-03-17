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

  // recurse
  std::vector<float> evenSpectra(size);
  std::vector<float> oddSpectra(size);
  fft(evenSamples.data(), evenSpectra.data(), size / 2);
  fft(oddSamples.data(), oddSpectra.data(), size / 2);

  // combine
  for (size_t i = 0; i < size; i += 2) {
    // get root of unity, call it w
    size_t bin = i / 2;
    float theta = -2.0f * std::numbers::pi_v<float> * bin / size;
    float wReal = std::cos(theta);
    float wImag = std::sin(theta);

    // get even/odd real/imaginary pieces
    float evenReal = evenSpectra[i];
    float evenImag = evenSpectra[i + 1];
    float oddReal = oddSpectra[i];
    float oddImag = oddSpectra[i + 1];

    // y[k] = y_even[k] + w^k y_odd[k]
    // y[k + N/2] = y_even[k] - w^k y_odd[k]
    output[i] = evenReal + wReal * oddReal - wImag * oddImag;
    output[i + 1] = evenImag + wReal * oddImag + wImag * oddReal;
    output[i + size] = evenReal - (wReal * oddReal - wImag * oddImag);
    output[i + size + 1] = evenImag - (wReal * oddImag + wImag * oddReal);
  }
}

void
ifftReal(const float* input, float* output, size_t size)
{
  std::vector<float> fullOutput(size * 2);
  ifft(input, fullOutput.data(), size);
  for (size_t i = 0; i < size; i++)
    output[i] = fullOutput[i * 2];
}

void
ifft(const float* input, float* output, size_t size)
{
  // base case when we are down to 1 frequency
  // just return the input
  if (size == 1) {
    output[0] = input[0];
    output[1] = input[1];
    return;
  }

  // split input into even and odd spectra
  std::vector<float> evenSpectra(size);
  std::vector<float> oddSpectra(size);
  size_t j = 0;
  for (size_t i = 0; i < size * 2; i += 4) {
    evenSpectra[j] = input[i];
    evenSpectra[j + 1] = input[i + 1];
    oddSpectra[j] = input[i + 2];
    oddSpectra[j + 1] = input[i + 3];
    j += 2;
  }

  // recurse
  std::vector<float> evenSamples(size);
  std::vector<float> oddSamples(size);
  ifft(evenSpectra.data(), evenSamples.data(), size / 2);
  ifft(oddSpectra.data(), oddSamples.data(), size / 2);

  // combine
  for (size_t i = 0; i < size; i += 2) {
    // get root of unity, call it w
    size_t bin = i / 2;
    float theta = 2.0f * std::numbers::pi_v<float> * bin / size;
    float wReal = std::cos(theta);
    float wImag = std::sin(theta);

    // get even/odd real/imaginary pieces
    float evenReal = evenSamples[i];
    float evenImag = evenSamples[i + 1];
    float oddReal = oddSamples[i];
    float oddImag = oddSamples[i + 1];

    // y[k] = y_even[k] + w^k y_odd[k]
    // y[k + N/2] = y_even[k] - w^k y_odd[k]
    // divide by 2 to normalize
    output[i] = (evenReal + wReal * oddReal - wImag * oddImag) / 2.0f;
    output[i + 1] = (evenImag + wReal * oddImag + wImag * oddReal) / 2.0f;
    output[i + size] = (evenReal - (wReal * oddReal - wImag * oddImag)) / 2.0f;
    output[i + size + 1] =
      (evenImag - (wReal * oddImag + wImag * oddReal)) / 2.0f;
  }
}
