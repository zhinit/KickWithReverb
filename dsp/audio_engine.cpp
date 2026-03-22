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

  // reverb chain — level 0 on audio thread, tail from worker
  if (activeIRIndex_ >= 0 && irReady_) {
    // mix kick+noise as dry reverb input (mono — L and R are summed)
    for (int i = 0; i < numSamples; ++i)
      dryBlock_[i] = kickL_[i] + noiseL_[i];

    // level 0 convolution
    level0Left_.processBlock(dryBlock_.data(), irFFTLevel0Left_);
    level0Right_.processBlock(dryBlock_.data(), irFFTLevel0Right_);

    const float* l0L = level0Left_.getResult();
    const float* l0R = level0Right_.getResult();
    for (int i = 0; i < numSamples; ++i) {
      reverbL_[i] = l0L[i];
      reverbR_[i] = l0R[i];
    }

    // add tail wet from worker (if available)
    if (hasTailWet_) {
      for (int i = 0; i < numSamples; ++i) {
        reverbL_[i] += tailWetL_[i];
        reverbR_[i] += tailWetR_[i];
      }
    }

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

    // deinterleave stereo IR
    std::vector<float> leftIR(ir.lengthPerChannel);
    std::vector<float> rightIR(ir.lengthPerChannel);
    if (ir.numChannels == 1) {
      leftIR.assign(ir.samples.data(), ir.samples.data() + ir.lengthPerChannel);
      rightIR.assign(ir.samples.data(), ir.samples.data() + ir.lengthPerChannel);
    } else {
      for (size_t i = 0; i < ir.lengthPerChannel; ++i) {
        leftIR[i] = ir.samples[i * 2];
        rightIR[i] = ir.samples[i * 2 + 1];
      }
    }

    normalizeEnergy(leftIR);
    normalizeEnergy(rightIR);

    // build level 0 IR FFTs — 2 partitions covering IR[0..2*blockSize)
    const size_t fftSize = kBlockSize * 2;
    auto buildLevel0FFTs = [&](const std::vector<float>& irData) {
      std::vector<std::vector<float>> partitions;
      for (size_t p = 0; p < 2; ++p) {
        std::vector<float> slice(fftSize, 0.0f);
        size_t offset = p * kBlockSize;
        size_t count =
          (offset < irData.size()) ? std::min((size_t)kBlockSize, irData.size() - offset) : 0;
        for (size_t i = 0; i < count; ++i)
          slice[i] = irData[offset + i];
        std::vector<float> irFFT(fftSize * 2, 0.0f);
        fft(slice.data(), irFFT.data(), fftSize);
        partitions.push_back(std::move(irFFT));
      }
      return partitions;
    };

    irFFTLevel0Left_ = buildLevel0FFTs(leftIR);
    irFFTLevel0Right_ = buildLevel0FFTs(rightIR);
    level0Left_ = ConvolutionLevel(0, kBlockSize, 0, 2);
    level0Right_ = ConvolutionLevel(0, kBlockSize, 0, 2);
    irReady_ = true;
    hasTailWet_ = false;
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

// --- Tail worker integration ---

void
AudioEngine::addTailWet(uintptr_t leftPtr, uintptr_t rightPtr, int numSamples)
{
  const float* left = reinterpret_cast<const float*>(leftPtr);
  const float* right = reinterpret_cast<const float*>(rightPtr);
  int count = std::min(numSamples, kBlockSize);
  std::copy_n(left, count, tailWetL_.data());
  std::copy_n(right, count, tailWetR_.data());
  hasTailWet_ = true;
}

uintptr_t
AudioEngine::getDryBlock() const
{
  return reinterpret_cast<uintptr_t>(dryBlock_.data());
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
    .function("addTailWet", &AudioEngine::addTailWet)
    .function("getDryBlock", &AudioEngine::getDryBlock)
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
