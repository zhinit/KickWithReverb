#include "convolution-mt.h"

void
EarlyConvolutionEngine::loadIR(const float* irData,
                               const size_t irLength,
                               const size_t numChannels)
{
  // pass
}

void
EarlyConvolutionEngine::process(const float* leftIn,
                                const float* rightIn,
                                float* leftOut,
                                float* rightOut,
                                const size_t numSamples)
{
  // pass
}

void
EarlyConvolutionEngine::reset()
{
  // pass
}

void
LateConvolutionEngine::loadIR(const float* irData,
                              const size_t irLength,
                              const size_t numChannels)
{
  // pass
}

void
LateConvolutionEngine::process(const float* leftIn,
                               const float* rightIn,
                               float* leftOut,
                               float* rightOut,
                               const size_t numSamples)
{
  // pass
}

void
LateConvolutionEngine::reset()
{
  // pass
}