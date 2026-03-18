#include "../convolution_mt.h"
#include <iostream>

int
main()
{
  std::vector<float> ir(400);
  ir[0] = 0.5f;
  ir[1] = 0.25f;
  ir[2] = 0.1f;
  ir[384] = 0.4f;
  ir[385] = 0.15f;
  ir[386] = 0.05f;

  float dry[128] = {};
  dry[0] = 1.0f;

  float wet[128] = {};

  float dryBlock2[128] = {};
  float wetBlock2[128] = {};

  // run the early engine
  EarlyConvolutionEngine earlyEngine;
  earlyEngine.loadIR(ir.data(), 3);
  earlyEngine.process(dry, wet, 128);

  std::cout << "Early convolution test. We expect 0.5, 0.25, 0.1, 0\n";
  for (size_t i = 0; i < 4; i++) {
    std::cout << wet[i] << " ";
  }
  std::cout << '\n';

  // run the late engine
  LateConvolutionEngine lateEngine;
  lateEngine.loadIR(ir.data(), 400);
  lateEngine.process(dry, wet, 128);
  lateEngine.process(dryBlock2, wetBlock2, 128);

  std::cout << "Late convolution test. We expect 0.4, 0.15, 0.05, 0\n";
  for (size_t i = 0; i < 4; i++) {
    std::cout << wetBlock2[i] << " ";
  }
  std::cout << '\n';
}
