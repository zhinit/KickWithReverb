#pragma once

#include <array>
#include <cmath>
#include <juce_dsp/juce_dsp.h>

class BandCompressor
{
public:
  BandCompressor(float attackMs, float releaseMs,
                 float downThresholdDb, float downRatio,
                 float upThresholdDb, float upRatio);

  void prepare(float sampleRate);
  void process(float* left, float* right, int numSamples, float amount);

private:
  float processSample(float sample, float& envelope,
                      float downRatio, float upRatio);

  float attackMs_, releaseMs_;
  float downThresholdDb_, downRatio_;
  float upThresholdDb_, upRatio_;
  float attackCoeff_ = 0.0f;
  float releaseCoeff_ = 0.0f;
  float envelopeL_ = 0.0f;
  float envelopeR_ = 0.0f;
};

class OTTCompressor
{
public:
  // ratioMultiplier: effective down ratio = 1 + ratioMultiplier * amount
  // EQ per-amount: actual gain = amount * eqDb for each band
  OTTCompressor(float knobRatioMultiplier = 10.0f,
                float knobLowBoost = 9.0f,
                float knobMidBoost = -3.0f,
                float knobHighBoost = 0.0f);

  void prepare(float sampleRate);
  void process(float* left, float* right, int numSamples);
  void setAmount(float amount);

private:
  juce::dsp::LinkwitzRileyFilter<float> lowCrossoverLP_;
  juce::dsp::LinkwitzRileyFilter<float> lowCrossoverHP_;
  juce::dsp::LinkwitzRileyFilter<float> highCrossoverLP_;
  juce::dsp::LinkwitzRileyFilter<float> highCrossoverHP_;

  BandCompressor lowComp_;
  BandCompressor midComp_;
  BandCompressor highComp_;

  std::array<float, 128> lowBandL_{}, lowBandR_{};
  std::array<float, 128> midBandL_{}, midBandR_{};
  std::array<float, 128> highBandL_{}, highBandR_{};

  float amount_ = 0.0f;
  float knobLowBoost_;
  float knobMidBoost_;
  float knobHighBoost_;
  static constexpr float makeupGainDb_ = 18.0f;
};
