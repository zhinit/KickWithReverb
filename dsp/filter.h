#pragma once

#include <juce_dsp/juce_dsp.h>

class Filter
{
public:
  enum class Type { lowpass, highpass };

  Filter() = default;

  void prepare(float sampleRate)
  {
    juce::dsp::ProcessSpec spec{ sampleRate, 128u, 2u };
    filter_.prepare(spec);
  }

  void setType(Type type)
  {
    if (type == Type::lowpass)
      filter_.setType(juce::dsp::StateVariableTPTFilterType::lowpass);
    else
      filter_.setType(juce::dsp::StateVariableTPTFilterType::highpass);
  }

  void setFrequency(float hz)
  {
    filter_.setCutoffFrequency(hz);
  }

  void process(float* left, float* right, int numSamples)
  {
    float* channels[] = { left, right };
    juce::dsp::AudioBlock<float> block(
      channels, 2, static_cast<size_t>(numSamples));
    juce::dsp::ProcessContextReplacing<float> context(block);
    filter_.process(context);
  }

private:
  juce::dsp::StateVariableTPTFilter<float> filter_;
};
