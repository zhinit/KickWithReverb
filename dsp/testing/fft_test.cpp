#include "../fft.h"
#include <iostream>
#include <vector>

int
main()
{
  std::vector<float> samples = { 1, 0.5, 0, -0.5 };
  std::vector<float> spectra(8);
  std::vector<float> recovered(4);
  fft(samples.data(), spectra.data(), 4);
  ifftReal(spectra.data(), recovered.data(), 4);
  for (auto& element : recovered)
    std::cout << element << " ";
  std::cout << '\n';
}
