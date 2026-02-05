#pragma once

#include <algorithm>
#include <cstring>
#include <juce_dsp/juce_dsp.h>
#include <vector>

class ConvolutionEngine
{
public:
  ConvolutionEngine() = default;

  void prepare(float sampleRate);
  void loadIR(const float* irData, size_t irLength);
  void process(const float* input, float* output, int numSamples);
  void reset();

private:
  void prepareForConvolution(float* samples);
  void convolutionProcessingAndAccumulate(const float* input,
                                          const float* impulse,
                                          float* output);
  void updateSymmetricFrequencyDomainData(float* samples);

  static constexpr int fftOrder_ = 9;
  static constexpr size_t fftSize_ = 512;
  static constexpr size_t blockSize_ = 128;
  static constexpr size_t segmentSize_ = fftSize_ - blockSize_;

  juce::dsp::FFT fft_{ fftOrder_ };

  std::vector<std::vector<float>> irSegmentsFFT_;
  std::vector<std::vector<float>> inputSegmentsFFT_;
  std::vector<float> inputBuffer_;
  std::vector<float> outputBuffer_;
  std::vector<float> overlapBuffer_;
  std::vector<float> tempBuffer_;

  float sampleRate_ = 44100.0f;
  size_t numSegments_ = 0;
  size_t numInputSegments_ = 0;
  size_t currentSegment_ = 0;
  size_t inputDataPos_ = 0;
  bool irLoaded_ = false;
};

class StereoConvolutionReverb
{
public:
  void prepare(float sampleRate);
  void loadIR(const float* irData, size_t irLengthPerChannel, int numChannels);
  void process(float* left, float* right, int numSamples);
  void setMix(float wetLevel, float dryLevel);
  void reset();

private:
  ConvolutionEngine leftEngine_;
  ConvolutionEngine rightEngine_;
  std::vector<float> dryBuffer_;
  float wetLevel_ = 0.3f;
  float dryLevel_ = 0.7f;
};
