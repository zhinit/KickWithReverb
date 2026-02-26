#include "distortion.h"

void Distortion::prepare(float sampleRate)
{
  waveshaper_.functionToUse = [this](float x) {
    // tanh (smooth soft clip)
    // return std::tanh(x * drive_);
    // cubic soft clip
    // return std::clamp(x * drive_, -1.0f, 1.0f) - std::pow(std::clamp(x * drive_, -1.0f, 1.0f), 3.0f) / 3.0f;
    // hard clip
    // return std::clamp(x * drive_, -1.0f, 1.0f);
    // arctangent
    // return (2.0f / 3.14159f) * std::atan(x * drive_);
    // sine fold
    // return std::sin(x * drive_);
    // asymetric tanh (w even harmonics)
    return std::tanh(x * drive_) + 0.1f * x * x;
  };
  juce::dsp::ProcessSpec spec{ sampleRate, 128u, 2u };
  waveshaper_.prepare(spec);
}

void Distortion::process(float* left, float* right, int numSamples)
{
  float* channels[] = { left, right };
  juce::dsp::AudioBlock<float> block(
    channels, 2, static_cast<size_t>(numSamples));
  juce::dsp::ProcessContextReplacing<float> context(block);
  waveshaper_.process(context);
}

void Distortion::setDrive(float drive) { drive_ = drive; }
