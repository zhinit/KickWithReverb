#include "convolution.h"

// --- ConvolutionEngine ---

void ConvolutionEngine::prepare(float sampleRate)
{
  sampleRate_ = sampleRate;
  reset();
}

void ConvolutionEngine::loadIR(const float* irData, size_t irLength)
{
  if (irLength == 0 || irData == nullptr)
    return;

  numSegments_ = (irLength + segmentSize_ - 1) / segmentSize_;
  numInputSegments_ = numSegments_ * 3;

  irSegmentsFFT_.resize(numSegments_);
  for (auto& segment : irSegmentsFFT_) {
    segment.resize(fftSize_ * 2, 0.0f);
  }

  inputSegmentsFFT_.resize(numInputSegments_);
  for (auto& segment : inputSegmentsFFT_) {
    segment.resize(fftSize_ * 2, 0.0f);
  }

  inputBuffer_.resize(fftSize_, 0.0f);
  outputBuffer_.resize(fftSize_ * 2, 0.0f);
  overlapBuffer_.resize(fftSize_, 0.0f);
  tempBuffer_.resize(fftSize_ * 2, 0.0f);

  for (size_t seg = 0; seg < numSegments_; ++seg) {
    std::fill(irSegmentsFFT_[seg].begin(), irSegmentsFFT_[seg].end(), 0.0f);

    size_t srcOffset = seg * segmentSize_;
    size_t copyLen = std::min(segmentSize_, irLength - srcOffset);

    for (size_t i = 0; i < copyLen; ++i) {
      irSegmentsFFT_[seg][i] = irData[srcOffset + i];
    }

    fft_.performRealOnlyForwardTransform(irSegmentsFFT_[seg].data());
    prepareForConvolution(irSegmentsFFT_[seg].data());
  }

  irLoaded_ = true;
  reset();
}

void ConvolutionEngine::process(const float* input, float* output, int numSamples)
{
  if (!irLoaded_) {
    std::copy(input, input + numSamples, output);
    return;
  }

  int numSamplesProcessed = 0;
  size_t indexStep = numInputSegments_ / numSegments_;

  while (numSamplesProcessed < numSamples) {
    bool inputBufferWasEmpty = (inputDataPos_ == 0);
    size_t samplesToProcess =
      std::min(static_cast<size_t>(numSamples - numSamplesProcessed),
               blockSize_ - inputDataPos_);

    for (size_t i = 0; i < samplesToProcess; ++i) {
      inputBuffer_[inputDataPos_ + i] = input[numSamplesProcessed + i];
    }

    float* inputSegmentData = inputSegmentsFFT_[currentSegment_].data();

    if (inputBufferWasEmpty) {
      std::copy(inputBuffer_.begin(), inputBuffer_.end(), inputSegmentData);
      std::fill(
        inputSegmentData + fftSize_, inputSegmentData + fftSize_ * 2, 0.0f);
      fft_.performRealOnlyForwardTransform(inputSegmentData);
      prepareForConvolution(inputSegmentData);

      std::fill(tempBuffer_.begin(), tempBuffer_.end(), 0.0f);

      size_t index = currentSegment_;
      for (size_t seg = 1; seg < numSegments_; ++seg) {
        index += indexStep;
        if (index >= numInputSegments_)
          index -= numInputSegments_;

        convolutionProcessingAndAccumulate(inputSegmentsFFT_[index].data(),
                                           irSegmentsFFT_[seg].data(),
                                           tempBuffer_.data());
      }
    }

    std::copy(tempBuffer_.begin(), tempBuffer_.end(), outputBuffer_.begin());
    convolutionProcessingAndAccumulate(
      inputSegmentData, irSegmentsFFT_[0].data(), outputBuffer_.data());

    updateSymmetricFrequencyDomainData(outputBuffer_.data());
    fft_.performRealOnlyInverseTransform(outputBuffer_.data());

    for (size_t i = 0; i < samplesToProcess; ++i) {
      output[numSamplesProcessed + i] =
        outputBuffer_[inputDataPos_ + i] + overlapBuffer_[inputDataPos_ + i];
    }

    inputDataPos_ += samplesToProcess;

    if (inputDataPos_ == blockSize_) {
      std::fill(inputBuffer_.begin(), inputBuffer_.end(), 0.0f);
      inputDataPos_ = 0;

      for (size_t i = blockSize_; i < fftSize_; ++i) {
        outputBuffer_[i] += overlapBuffer_[i];
      }

      std::copy(outputBuffer_.begin() + blockSize_,
                outputBuffer_.begin() + fftSize_,
                overlapBuffer_.begin());
      std::fill(overlapBuffer_.begin() + (fftSize_ - blockSize_),
                overlapBuffer_.end(),
                0.0f);

      currentSegment_ = (currentSegment_ > 0) ? (currentSegment_ - 1)
                                              : (numInputSegments_ - 1);
    }

    numSamplesProcessed += samplesToProcess;
  }
}

void ConvolutionEngine::reset()
{
  currentSegment_ = 0;
  inputDataPos_ = 0;

  std::fill(inputBuffer_.begin(), inputBuffer_.end(), 0.0f);
  std::fill(outputBuffer_.begin(), outputBuffer_.end(), 0.0f);
  std::fill(overlapBuffer_.begin(), overlapBuffer_.end(), 0.0f);
  std::fill(tempBuffer_.begin(), tempBuffer_.end(), 0.0f);

  for (auto& segment : inputSegmentsFFT_) {
    std::fill(segment.begin(), segment.end(), 0.0f);
  }
}

void ConvolutionEngine::prepareForConvolution(float* samples)
{
  size_t halfSize = fftSize_ / 2;

  for (size_t i = 0; i < halfSize; ++i)
    samples[i] = samples[i << 1];

  samples[halfSize] = 0.0f;

  for (size_t i = 1; i < halfSize; ++i)
    samples[i + halfSize] = -samples[((fftSize_ - i) << 1) + 1];
}

void ConvolutionEngine::convolutionProcessingAndAccumulate(const float* input,
                                                           const float* impulse,
                                                           float* output)
{
  size_t halfSize = fftSize_ / 2;

  for (size_t i = 0; i < halfSize; ++i) {
    output[i] += input[i] * impulse[i];
  }
  for (size_t i = 0; i < halfSize; ++i) {
    output[i] -= input[halfSize + i] * impulse[halfSize + i];
  }

  for (size_t i = 0; i < halfSize; ++i) {
    output[halfSize + i] += input[i] * impulse[halfSize + i];
  }
  for (size_t i = 0; i < halfSize; ++i) {
    output[halfSize + i] += input[halfSize + i] * impulse[i];
  }

  output[fftSize_] += input[fftSize_] * impulse[fftSize_];
}

void ConvolutionEngine::updateSymmetricFrequencyDomainData(float* samples)
{
  size_t halfSize = fftSize_ / 2;

  for (size_t i = 1; i < halfSize; ++i) {
    samples[(fftSize_ - i) << 1] = samples[i];
    samples[((fftSize_ - i) << 1) + 1] = -samples[halfSize + i];
  }

  samples[1] = 0.0f;

  for (size_t i = 1; i < halfSize; ++i) {
    samples[i << 1] = samples[(fftSize_ - i) << 1];
    samples[(i << 1) + 1] = -samples[((fftSize_ - i) << 1) + 1];
  }
}

// --- StereoConvolutionReverb ---

void StereoConvolutionReverb::prepare(float sampleRate)
{
  leftEngine_.prepare(sampleRate);
  rightEngine_.prepare(sampleRate);
  dryBuffer_.resize(128 * 2);
}

void StereoConvolutionReverb::loadIR(const float* irData,
                                     size_t irLengthPerChannel,
                                     int numChannels)
{
  if (numChannels == 1) {
    leftEngine_.loadIR(irData, irLengthPerChannel);
    rightEngine_.loadIR(irData, irLengthPerChannel);
  } else {
    std::vector<float> leftIR(irLengthPerChannel);
    std::vector<float> rightIR(irLengthPerChannel);

    for (size_t i = 0; i < irLengthPerChannel; ++i) {
      leftIR[i] = irData[i * 2];
      rightIR[i] = irData[i * 2 + 1];
    }

    leftEngine_.loadIR(leftIR.data(), irLengthPerChannel);
    rightEngine_.loadIR(rightIR.data(), irLengthPerChannel);
  }
}

void StereoConvolutionReverb::process(float* left, float* right, int numSamples)
{
  if (dryBuffer_.size() < static_cast<size_t>(numSamples * 2))
    dryBuffer_.resize(numSamples * 2);

  for (int i = 0; i < numSamples; ++i) {
    dryBuffer_[i] = left[i];
    dryBuffer_[numSamples + i] = right[i];
  }

  leftEngine_.process(left, left, numSamples);
  rightEngine_.process(right, right, numSamples);

  for (int i = 0; i < numSamples; ++i) {
    left[i] = dryBuffer_[i] * dryLevel_ + left[i] * wetLevel_;
    right[i] = dryBuffer_[numSamples + i] * dryLevel_ + right[i] * wetLevel_;
  }
}

void StereoConvolutionReverb::setMix(float wetLevel, float dryLevel)
{
  wetLevel_ = wetLevel;
  dryLevel_ = dryLevel;
}

void StereoConvolutionReverb::reset()
{
  leftEngine_.reset();
  rightEngine_.reset();
}
