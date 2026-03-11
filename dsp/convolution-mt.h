#pragma once
#include <cstddef>
#include <juce_dsp/juce_dsp.h>
#include <vector>

class EarlyConvolutionEngine
{
public:
  void loadIR(const float* irData, const size_t irLength);
  void process(const float* input, float* output, const size_t numSamples);
  void reset();

private:
  size_t numIrSegments_;
  size_t currSegment_;
  std::vector<std::vector<float>> irSegmentsFFT_;
  std::vector<std::vector<float>> inputHistoryFFT_;
  std::vector<float> overlapBuffer_;

  static constexpr int fftOrder_ = 9; // 2^9 = 512
  static constexpr size_t fftSize_ = 512;
  static constexpr size_t blockSize_ = 128;

  juce::dsp::FFT fft_{ fftOrder_ };
};

class LateConvolutionEngine
{
public:
  void loadIR(const float* irData, const size_t irLength);
  void process(const float* input, float* output, const size_t numSamples);
  void reset();

private:
  size_t numIrSegments_;
  size_t currSegment_;
  std::vector<std::vector<float>> irSegmentsFFT_;
  std::vector<std::vector<float>> inputHistoryFFT_;
  std::vector<float> overlapBuffer_;

  static constexpr int fftOrder_ = 9; // 2^9 = 512
  static constexpr size_t fftSize_ = 512;
  static constexpr size_t blockSize_ = 128;

  juce::dsp::FFT fft_{ fftOrder_ };
};
