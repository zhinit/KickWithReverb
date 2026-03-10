#include "convolution.h"

// --- ConvolutionEngine ---

void
ConvolutionEngine::prepare(float sampleRate)
{
  sampleRate_ = sampleRate;
  reset();
}

void
ConvolutionEngine::loadIR(const float* irData, size_t irLength)
{
  // validate input
  if (irLength == 0 || irData == nullptr)
    return;

  // allocate arrays and buffers initialized to 0
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
    // handle partial segment
    size_t copyLen = std::min(segmentSize_, irLength - srcOffset);

    // copy ir file raw samples into each segment
    for (size_t i = 0; i < copyLen; ++i) {
      irSegmentsFFT_[seg][i] = irData[srcOffset + i];
    }

    // apply fft in place
    fft_.performRealOnlyForwardTransform(irSegmentsFFT_[seg].data());
    // reorganize segments so real numbers come before complex numbers
    prepareForConvolution(irSegmentsFFT_[seg].data());
  }

  irLoaded_ = true;
  reset();
}

void
ConvolutionEngine::process(const float* input, float* output, int numSamples)
{
  // pass audio through unchanged until an IR is loaded
  if (!irLoaded_) {
    std::copy(input, input + numSamples, output);
    return;
  }

  int numSamplesProcessed = 0;

  // how far apart IR segments are spaced in the circular input buffer
  size_t indexStep = numInputSegments_ / numSegments_;

  while (numSamplesProcessed < numSamples) {
    // true if we're starting a fresh internal block
    bool inputBufferWasEmpty = (inputDataPos_ == 0);

    // how many samples to handle this iteration. capped at what fits in the
    // current block
    size_t samplesToProcess =
      std::min(static_cast<size_t>(numSamples - numSamplesProcessed),
               blockSize_ - inputDataPos_);

    // accumulate incoming samples into the staging buffer
    for (size_t i = 0; i < samplesToProcess; ++i) {
      inputBuffer_[inputDataPos_ + i] = input[numSamplesProcessed + i];
    }

    // pointer to the current slot in the circular input segment buffer
    float* inputSegmentData = inputSegmentsFFT_[currentSegment_].data();

    // only run FFT and tail convolution once per block (at the block boundary)
    if (inputBufferWasEmpty) {
      // FFT the new input block and store it in the circular buffer
      std::copy(inputBuffer_.begin(), inputBuffer_.end(), inputSegmentData);
      std::fill(inputSegmentData + fftSize_,
                inputSegmentData + fftSize_ * 2,
                0.0f); // zero-pad second half
      fft_.performRealOnlyForwardTransform(inputSegmentData);
      prepareForConvolution(inputSegmentData);

      // convolve past input blocks against IR segments 1..N (the tail)
      // each IR segment is paired with the input block from that many blocks
      // ago
      std::fill(tempBuffer_.begin(), tempBuffer_.end(), 0.0f);
      size_t index = currentSegment_;
      for (size_t seg = 1; seg < numSegments_; ++seg) {
        index += indexStep;
        if (index >= numInputSegments_)
          index -= numInputSegments_; // wrap around the circular buffer

        convolutionProcessingAndAccumulate(inputSegmentsFFT_[index].data(),
                                           irSegmentsFFT_[seg].data(),
                                           tempBuffer_.data());
      }
      // tempBuffer_ now holds the summed tail contribution (IR segments 1..N)
    }

    // start output with the tail result, then add IR segment 0 (most recent
    // input vs IR start)
    std::copy(tempBuffer_.begin(), tempBuffer_.end(), outputBuffer_.begin());
    convolutionProcessingAndAccumulate(
      inputSegmentData, irSegmentsFFT_[0].data(), outputBuffer_.data());

    // restore FFT symmetry then inverse FFT back to time domain
    updateSymmetricFrequencyDomainData(outputBuffer_.data());
    fft_.performRealOnlyInverseTransform(outputBuffer_.data());

    // write output samples, adding overlap from the previous block's tail
    for (size_t i = 0; i < samplesToProcess; ++i) {
      output[numSamplesProcessed + i] =
        outputBuffer_[inputDataPos_ + i] + overlapBuffer_[inputDataPos_ + i];
    }

    inputDataPos_ += samplesToProcess;

    // end of internal block — save the tail and advance the circular buffer
    if (inputDataPos_ == blockSize_) {
      std::fill(inputBuffer_.begin(), inputBuffer_.end(), 0.0f);
      inputDataPos_ = 0;

      // finish adding overlap to the tail portion of outputBuffer_
      for (size_t i = blockSize_; i < fftSize_; ++i) {
        outputBuffer_[i] += overlapBuffer_[i];
      }

      // save the tail of this block to add into the next block's output
      std::copy(outputBuffer_.begin() + blockSize_,
                outputBuffer_.begin() + fftSize_,
                overlapBuffer_.begin());
      std::fill(overlapBuffer_.begin() + (fftSize_ - blockSize_),
                overlapBuffer_.end(),
                0.0f);

      // step backward in the circular buffer (newest slot is always
      // currentSegment_)
      currentSegment_ =
        (currentSegment_ > 0) ? (currentSegment_ - 1) : (numInputSegments_ - 1);
    }

    numSamplesProcessed += samplesToProcess;
  }
}

void
ConvolutionEngine::reset()
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

void
ConvolutionEngine::prepareForConvolution(float* samples)
{
  // juce fft returns results alternating real, complex, real, complex, ...
  // this function puts all reals together, then all complex together
  size_t halfSize = fftSize_ / 2;

  for (size_t i = 0; i < halfSize; ++i)
    samples[i] = samples[i << 1];

  samples[halfSize] = 0.0f;

  for (size_t i = 1; i < halfSize; ++i)
    samples[i + halfSize] = -samples[((fftSize_ - i) << 1) + 1];
}

void
ConvolutionEngine::convolutionProcessingAndAccumulate(const float* input,
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

void
ConvolutionEngine::updateSymmetricFrequencyDomainData(float* samples)
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

void
StereoConvolutionReverb::prepare(float sampleRate)
{
  leftEngine_.prepare(sampleRate);
  rightEngine_.prepare(sampleRate);
  dryBuffer_.resize(128 * 2);
}

void
StereoConvolutionReverb::loadIR(const float* irData,
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

void
StereoConvolutionReverb::process(float* left, float* right, int numSamples)
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

void
StereoConvolutionReverb::setMix(float wetLevel, float dryLevel)
{
  wetLevel_ = wetLevel;
  dryLevel_ = dryLevel;
}

void
StereoConvolutionReverb::reset()
{
  leftEngine_.reset();
  rightEngine_.reset();
}
