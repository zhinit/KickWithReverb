#include "audio_engine.h"
#include <algorithm>
#include <cstring>
#include <emscripten/bind.h>

AudioEngine::AudioEngine() = default;

void
AudioEngine::prepare(float sampleRate)
{
  sampleRate_ = sampleRate;

  kickPlayer_.setSampleRate(sampleRate);
  noisePlayer_.setSampleRate(sampleRate);
  noisePlayer_.setReleaseDuration(0.1f);
  noisePlayer_.setLooping(true);

  kickDistortion_.prepare(sampleRate);
  kickOTT_.prepare(sampleRate);

  noiseLowPass_.prepare(sampleRate);
  noiseLowPass_.setType(Filter::Type::lowpass);
  noiseLowPass_.setFrequency(7000.0f);

  noiseHighPass_.prepare(sampleRate);
  noiseHighPass_.setType(Filter::Type::highpass);
  noiseHighPass_.setFrequency(30.0f);

  convolution_.prepare(sampleRate);
  convolution_.setMix(1.0f, 0.0f);

  reverbLowPass_.prepare(sampleRate);
  reverbLowPass_.setType(Filter::Type::lowpass);
  reverbLowPass_.setFrequency(7000.0f);

  reverbHighPass_.prepare(sampleRate);
  reverbHighPass_.setType(Filter::Type::highpass);
  reverbHighPass_.setFrequency(30.0f);

  masterOTT_.prepare(sampleRate);
  masterDistortion_.prepare(sampleRate);
  masterLimiter_.prepare(sampleRate);

  recalcSamplesPerBeat();
}

void
AudioEngine::process(uintptr_t leftPtr, uintptr_t rightPtr, int numSamples)
{
  float* left = reinterpret_cast<float*>(leftPtr);
  float* right = reinterpret_cast<float*>(rightPtr);

  // trigger kick/noise at boundaries
  if (looping_ && samplesPerBeat_ > 0) {
    samplesSinceBeat_ += numSamples;
    while (samplesSinceBeat_ >= samplesPerBeat_) {
      samplesSinceBeat_ -= samplesPerBeat_;
      noiseBeatCount_++;
      kickPlayer_.trigger();

      // If new noise selected, trigger it and reset the loop
      if (pendingNoiseTrigger_) {
        noisePlayer_.trigger();
        noiseBeatCount_ = 0;
        pendingNoiseTrigger_ = false;
      } else if (noiseBeatCount_ % 16 == 0) {
        noisePlayer_.trigger();
      }
    }
  }

  // kick chain 
  kickPlayer_.process(kickL_.data(), kickR_.data(), numSamples);

  if (kickDistortionMix_ > 0.0f) {
    std::copy_n(kickL_.data(), numSamples, tempL_.data());
    std::copy_n(kickR_.data(), numSamples, tempR_.data());
    kickDistortion_.process(kickL_.data(), kickR_.data(), numSamples);
    float dry = 1.0f - kickDistortionMix_;
    float wet = kickDistortionMix_;
    for (int i = 0; i < numSamples; ++i) {
      kickL_[i] = tempL_[i] * dry + kickL_[i] * wet;
      kickR_[i] = tempR_[i] * dry + kickR_[i] * wet;
    }
  }

  kickOTT_.process(kickL_.data(), kickR_.data(), numSamples);

  // noise chain
  noisePlayer_.process(noiseL_.data(), noiseR_.data(), numSamples);
  noiseLowPass_.process(noiseL_.data(), noiseR_.data(), numSamples);
  noiseHighPass_.process(noiseL_.data(), noiseR_.data(), numSamples);

  // reverb chain
  if (activeIRIndex_ >= 0) {
    for (int i = 0; i < numSamples; ++i) {
      reverbL_[i] = kickL_[i] + noiseL_[i];
      reverbR_[i] = kickR_[i] + noiseR_[i];
    }
    convolution_.process(reverbL_.data(), reverbR_.data(), numSamples);
    reverbLowPass_.process(reverbL_.data(), reverbR_.data(), numSamples);
    reverbHighPass_.process(reverbL_.data(), reverbR_.data(), numSamples);
    for (int i = 0; i < numSamples; ++i) {
      reverbL_[i] *= reverbGain_;
      reverbR_[i] *= reverbGain_;
    }
  } else {
    std::memset(reverbL_.data(), 0, sizeof(float) * numSamples);
    std::memset(reverbR_.data(), 0, sizeof(float) * numSamples);
  }

  // master chain
  for (int i = 0; i < numSamples; ++i) {
    left[i] = kickL_[i] + noiseL_[i] + reverbL_[i];
    right[i] = kickR_[i] + noiseR_[i] + reverbR_[i];
  }

  masterOTT_.process(left, right, numSamples);

  if (masterDistortionMix_ > 0.0f) {
    std::copy_n(left, numSamples, tempL_.data());
    std::copy_n(right, numSamples, tempR_.data());
    masterDistortion_.process(left, right, numSamples);
    float dry = 1.0f - masterDistortionMix_;
    float wet = masterDistortionMix_;
    for (int i = 0; i < numSamples; ++i) {
      left[i] = tempL_[i] * dry + left[i] * wet;
      right[i] = tempR_[i] * dry + right[i] * wet;
    }
  }

  for (int i = 0; i < numSamples; ++i) {
    left[i] *= masterLimiterGain_;
    right[i] *= masterLimiterGain_;
  }

  masterLimiter_.process(left, right, numSamples);
}

// --- Kick ---

void
AudioEngine::loadKickSample(uintptr_t ptr, size_t length)
{
  kickPlayer_.loadSample(ptr, length);
}

void
AudioEngine::selectKickSample(int index)
{
  kickPlayer_.selectSample(index);
}

void
AudioEngine::setKickLength(float ratio)
{
  kickPlayer_.setLengthRatio(ratio);
}

void
AudioEngine::setKickDistortion(float amount)
{
  kickDistortionMix_ = std::clamp(amount, 0.0f, 1.0f);
}

void
AudioEngine::setKickOTT(float amount)
{
  kickOTT_.setAmount(std::clamp(amount, 0.0f, 1.0f));
}

// --- Noise ---

void
AudioEngine::loadNoiseSample(uintptr_t ptr, size_t length)
{
  noisePlayer_.loadSample(ptr, length);
}

void
AudioEngine::selectNoiseSample(int index)
{
  noisePlayer_.selectSample(index);
  if (looping_) {
    pendingNoiseTrigger_ = true;
  }
}

void
AudioEngine::setNoiseVolume(float db)
{
  // translate from db to linear number that can be multiplied onto signal
  noisePlayer_.setVolume(std::pow(10.0f, db / 20.0f));
}

void
AudioEngine::setNoiseLowPass(float hz)
{
  noiseLowPass_.setFrequency(hz);
}

void
AudioEngine::setNoiseHighPass(float hz)
{
  noiseHighPass_.setFrequency(hz);
}

// --- Reverb ---

void
AudioEngine::loadIR(uintptr_t ptr, size_t irLength, size_t numChannels)
{
  const float* data = reinterpret_cast<const float*>(ptr);
  size_t totalSamples = irLength * numChannels;
  IRData ir;
  ir.samples.assign(data, data + totalSamples);
  ir.lengthPerChannel = irLength;
  ir.numChannels = static_cast<int>(numChannels);
  irStorage_.push_back(std::move(ir));
}

void
AudioEngine::selectIR(int index)
{
  if (index >= 0 && index < static_cast<int>(irStorage_.size()) &&
      index != activeIRIndex_) {
    activeIRIndex_ = index;
    const auto& ir = irStorage_[index];
    convolution_.loadIR(ir.samples.data(), ir.lengthPerChannel, ir.numChannels);
  }
}

void
AudioEngine::setReverbLowPass(float hz)
{
  reverbLowPass_.setFrequency(hz);
}

void
AudioEngine::setReverbHighPass(float hz)
{
  reverbHighPass_.setFrequency(hz);
}

void
AudioEngine::setReverbVolume(float db)
{
  reverbGain_ = std::pow(10.0f, db / 20.0f);
}


// --- Master ---

void
AudioEngine::setMasterOTT(float amount)
{
  masterOTT_.setAmount(std::clamp(amount, 0.0f, 1.0f));
}

void
AudioEngine::setMasterDistortion(float amount)
{
  masterDistortionMix_ = std::clamp(amount, 0.0f, 1.0f);
}

void
AudioEngine::setMasterLimiter(float amount)
{
  masterLimiterGain_ = std::clamp(amount, 1.0f, 8.0f);
}


// --- Transport ---

void
AudioEngine::setLooping(bool enabled)
{
  looping_ = enabled;
  if (enabled) {
    samplesSinceBeat_ = 0;
    noiseBeatCount_ = 0;
    kickPlayer_.trigger();
    noisePlayer_.trigger();
  } else {
    noisePlayer_.stop();
  }
}

void
AudioEngine::cue()
{
  noisePlayer_.setLooping(false);
  noisePlayer_.trigger();
  kickPlayer_.trigger();
}

void
AudioEngine::cueRelease()
{
  noisePlayer_.stop();
  noisePlayer_.setLooping(true);
}

void
AudioEngine::recalcSamplesPerBeat()
{
  if (bpm_ > 0.0f) {
    samplesPerBeat_ = static_cast<int>(sampleRate_ * 60.0f / bpm_);
  }
}

void
AudioEngine::setBPM(float bpm)
{
  bpm_ = bpm;
  recalcSamplesPerBeat();
}

// --- Emscripten bindings ---

EMSCRIPTEN_BINDINGS(audio_module)
{
  emscripten::class_<AudioEngine>("AudioEngine")
    .constructor()
    .function("prepare", &AudioEngine::prepare)
    .function("process", &AudioEngine::process)
    // Kick
    .function("loadKickSample", &AudioEngine::loadKickSample)
    .function("selectKickSample", &AudioEngine::selectKickSample)
    .function("setKickLength", &AudioEngine::setKickLength)
    .function("setKickDistortion", &AudioEngine::setKickDistortion)
    .function("setKickOTT", &AudioEngine::setKickOTT)
    // Noise
    .function("loadNoiseSample", &AudioEngine::loadNoiseSample)
    .function("selectNoiseSample", &AudioEngine::selectNoiseSample)
    .function("setNoiseVolume", &AudioEngine::setNoiseVolume)
    .function("setNoiseLowPass", &AudioEngine::setNoiseLowPass)
    .function("setNoiseHighPass", &AudioEngine::setNoiseHighPass)
    // Reverb
    .function("loadIR", &AudioEngine::loadIR)
    .function("selectIR", &AudioEngine::selectIR)
    .function("setReverbLowPass", &AudioEngine::setReverbLowPass)
    .function("setReverbHighPass", &AudioEngine::setReverbHighPass)
    .function("setReverbVolume", &AudioEngine::setReverbVolume)
    // Master
    .function("setMasterOTT", &AudioEngine::setMasterOTT)
    .function("setMasterDistortion", &AudioEngine::setMasterDistortion)
    .function("setMasterLimiter", &AudioEngine::setMasterLimiter)
    // Transport
    .function("setBPM", &AudioEngine::setBPM)
    .function("setLooping", &AudioEngine::setLooping)
    .function("cue", &AudioEngine::cue)
    .function("cueRelease", &AudioEngine::cueRelease);
}
