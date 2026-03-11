#pragma once
#include <cstddef>

class EarlyConvolutionEngine
{
public:
  void loadIR(const float* irData,
              const size_t irLength,
              const size_t numChannels);
  void process(const float* leftIn,
               const float* rightIn,
               float* leftOut,
               float* rightOut,
               const size_t numSamples);
  void reset();

private:
};

class LateConvolutionEngine
{
public:
  void loadIR(const float* irData,
              const size_t irLength,
              const size_t numChannels);
  void process(const float* leftIn,
               const float* rightIn,
               float* leftOut,
               float* rightOut,
               const size_t numSamples);
  void reset();

private:
};