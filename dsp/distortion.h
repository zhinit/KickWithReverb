#pragma once

#include <cmath>
#include <functional>
#include <juce_dsp/juce_dsp.h>

class Distortion
{
public:
  Distortion() = default;

  void prepare(float sampleRate);
  void process(float* left, float* right, int numSamples);
  void setDrive(float drive);

private:
  juce::dsp::WaveShaper<float, std::function<float(float)>> waveshaper_;
  float drive_ = 6.0f;
};
