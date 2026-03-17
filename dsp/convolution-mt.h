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
  bool irLoaded_ = false;

  std::vector<std::vector<float>> irSegmentsFFT_;
  std::vector<float> overlapBuffer_;

  static constexpr int fftOrder_ = 9; // 2^9 = 512
  static constexpr size_t fftSize_ = 512;
  static constexpr size_t blockSize_ = 128;
  static constexpr size_t segmentSize_ = fftSize_ - blockSize_;

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
  bool irLoaded_ = false;

  std::vector<std::vector<float>> irSegmentsFFT_;
  std::vector<std::vector<float>> inputHistoryFFT_;
  std::vector<float> overlapBuffer_;

  static constexpr int fftOrder_ = 9; // 2^9 = 512
  static constexpr size_t fftSize_ = 512;
  static constexpr size_t blockSize_ = 128;
  static constexpr size_t segmentSize_ = fftSize_ - blockSize_;

  juce::dsp::FFT fft_{ fftOrder_ };
};

class EarlyStereoConvolutionReverb
{
public:
  void loadIR(const float* irData, size_t irLengthPerChannel, int numChannels);
  void process(float* left, float* right, int numSamples);
  void reset();

private:
  EarlyConvolutionEngine leftEngine_;
  EarlyConvolutionEngine rightEngine_;
};

class LateStereoConvolutionReverb
{
public:
  void loadIR(const float* irData, size_t irLengthPerChannel, int numChannels);
  void process(float* left, float* right, int numSamples);
  void reset();

private:
  LateConvolutionEngine leftEngine_;
  LateConvolutionEngine rightEngine_;
};
