#include "ott.h"

// --- BandCompressor ---

BandCompressor::BandCompressor(float attackMs, float releaseMs,
                               float downThresholdDb, float downRatio,
                               float upThresholdDb, float upRatio)
  : attackMs_(attackMs)
  , releaseMs_(releaseMs)
  , downThresholdDb_(downThresholdDb)
  , downRatio_(downRatio)
  , upThresholdDb_(upThresholdDb)
  , upRatio_(upRatio)
{
}

void BandCompressor::prepare(float sampleRate)
{
  attackCoeff_ = std::exp(-1.0f / (attackMs_ * 0.001f * sampleRate));
  releaseCoeff_ = std::exp(-1.0f / (releaseMs_ * 0.001f * sampleRate));
  envelopeL_ = 0.0f;
  envelopeR_ = 0.0f;
}

void BandCompressor::process(float* left, float* right, int numSamples,
                             float amount)
{
  float effectiveDownRatio = 1.0f + amount * (downRatio_ - 1.0f);
  float effectiveUpRatio = 1.0f + amount * (upRatio_ - 1.0f);

  for (int i = 0; i < numSamples; ++i) {
    left[i] = processSample(left[i], envelopeL_,
                             effectiveDownRatio, effectiveUpRatio);
    right[i] = processSample(right[i], envelopeR_,
                              effectiveDownRatio, effectiveUpRatio);
  }
}

float BandCompressor::processSample(float sample, float& envelope,
                                    float downRatio, float upRatio)
{
  float level = std::abs(sample);
  float coeff = (level > envelope) ? attackCoeff_ : releaseCoeff_;
  envelope = coeff * envelope + (1.0f - coeff) * level;

  float envelopeDb = 20.0f * std::log10(std::max(envelope, 1e-6f));

  float gainDb = 0.0f;
  if (envelopeDb > downThresholdDb_) {
    gainDb = (1.0f - 1.0f / downRatio) * (downThresholdDb_ - envelopeDb);
  } else if (envelopeDb < upThresholdDb_) {
    gainDb = (1.0f - 1.0f / upRatio) * (upThresholdDb_ - envelopeDb);
  }

  float gain = std::pow(10.0f, gainDb / 20.0f);
  return sample * gain;
}

// --- OTTCompressor ---

OTTCompressor::OTTCompressor(float knobRatioMultiplier,
                             float knobLowBoost,
                             float knobMidBoost,
                             float knobHighBoost)
  : lowComp_(10.0f, 100.0f, -20.0f, knobRatioMultiplier + 1.0f, -40.0f, 3.0f)
  , midComp_(5.0f, 75.0f, -20.0f, knobRatioMultiplier + 1.0f, -40.0f, 4.0f)
  , highComp_(1.0f, 50.0f, -20.0f, knobRatioMultiplier + 1.0f, -40.0f, 5.0f)
  , knobLowBoost_(knobLowBoost)
  , knobMidBoost_(knobMidBoost)
  , knobHighBoost_(knobHighBoost)
{
}

void OTTCompressor::prepare(float sampleRate)
{
  juce::dsp::ProcessSpec spec{ sampleRate, 128u, 2u };

  lowCrossoverLP_.setCutoffFrequency(100.0f);
  lowCrossoverLP_.setType(
    juce::dsp::LinkwitzRileyFilter<float>::Type::lowpass);
  lowCrossoverLP_.prepare(spec);

  lowCrossoverHP_.setCutoffFrequency(100.0f);
  lowCrossoverHP_.setType(
    juce::dsp::LinkwitzRileyFilter<float>::Type::highpass);
  lowCrossoverHP_.prepare(spec);

  highCrossoverLP_.setCutoffFrequency(2500.0f);
  highCrossoverLP_.setType(
    juce::dsp::LinkwitzRileyFilter<float>::Type::lowpass);
  highCrossoverLP_.prepare(spec);

  highCrossoverHP_.setCutoffFrequency(2500.0f);
  highCrossoverHP_.setType(
    juce::dsp::LinkwitzRileyFilter<float>::Type::highpass);
  highCrossoverHP_.prepare(spec);

  lowComp_.prepare(sampleRate);
  midComp_.prepare(sampleRate);
  highComp_.prepare(sampleRate);
}

void OTTCompressor::process(float* left, float* right, int numSamples)
{
  for (int i = 0; i < numSamples; ++i) {
    float lowL = lowCrossoverLP_.processSample(0, left[i]);
    float lowR = lowCrossoverLP_.processSample(1, right[i]);
    float restL = lowCrossoverHP_.processSample(0, left[i]);
    float restR = lowCrossoverHP_.processSample(1, right[i]);

    float midL = highCrossoverLP_.processSample(0, restL);
    float midR = highCrossoverLP_.processSample(1, restR);
    float highL = highCrossoverHP_.processSample(0, restL);
    float highR = highCrossoverHP_.processSample(1, restR);

    lowBandL_[i] = lowL;   lowBandR_[i] = lowR;
    midBandL_[i] = midL;   midBandR_[i] = midR;
    highBandL_[i] = highL; highBandR_[i] = highR;
  }

  lowComp_.process(lowBandL_.data(), lowBandR_.data(), numSamples, amount_);
  midComp_.process(midBandL_.data(), midBandR_.data(), numSamples, amount_);
  highComp_.process(highBandL_.data(), highBandR_.data(), numSamples, amount_);

  // Per-band EQ scaled by amount
  float lowGain = std::pow(10.0f, (amount_ * knobLowBoost_) / 20.0f);
  float midGain = std::pow(10.0f, (amount_ * knobMidBoost_) / 20.0f);
  float highGain = std::pow(10.0f, (amount_ * knobHighBoost_) / 20.0f);

  float makeupDb = amount_ * makeupGainDb_;
  float makeupGain = std::pow(10.0f, makeupDb / 20.0f);

  for (int i = 0; i < numSamples; ++i) {
    left[i] = (lowBandL_[i] * lowGain + midBandL_[i] * midGain + highBandL_[i] * highGain) * makeupGain;
    right[i] = (lowBandR_[i] * lowGain + midBandR_[i] * midGain + highBandR_[i] * highGain) * makeupGain;
  }
}

void OTTCompressor::setAmount(float amount) { amount_ = amount; }
