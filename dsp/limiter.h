#pragma once

#include <juce_dsp/juce_dsp.h>

class Limiter
{
public:
  Limiter() = default;

  void prepare(float sampleRate)
  {
    juce::dsp::ProcessSpec spec{ sampleRate, 128u, 2u };
    limiter_.prepare(spec);
    limiter_.setThreshold(0.0f);  // 0 dB ceiling
    limiter_.setRelease(10.0f);   // 10ms release
  }

  void process(float* left, float* right, int numSamples)
  {
    float* channels[] = { left, right };
    juce::dsp::AudioBlock<float> block(
      channels, 2, static_cast<size_t>(numSamples));
    juce::dsp::ProcessContextReplacing<float> context(block);
    limiter_.process(context);
  }

private:
  juce::dsp::Limiter<float> limiter_;
};
