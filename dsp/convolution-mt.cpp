#include "convolution-mt.h"

void
multiplyAndAccumulateFFTs(const std::vector<float>& fftDry,
                          const std::vector<float>& fftIr,
                          std::vector<float>& fftOutput)
{
  // (a + bi) (c + di)
  // ac + cbi + adi + bdi^2
  // ac - bd + i (cb + ad)
  for (size_t i = 0; i < fftDry.size(); i += 2) {
    float a = fftDry[i];
    float b = fftDry[i + 1];
    float c = fftIr[i];
    float d = fftIr[i + 1];
    fftOutput[i] += a * c - b * d;
    fftOutput[i + 1] += c * b + a * d;
  }
}

void
EarlyConvolutionEngine::loadIR(const float* irData, const size_t irLength)
{
  if (irLength == 0 || irData == nullptr)
    return;

  // initialize overlap buffer (this seems like the best place to do it)
  overlapBuffer_.resize(fftSize_);

  // clear any stale buffers
  reset();

  // calculate number of ffts (segments)
  // note ceil(a /b) = (a + b - 1) / b and this avoids type conversions
  numIrSegments_ = (irLength + segmentSize_ - 1) / segmentSize_;
  irSegmentsFFT_.resize(numIrSegments_);

  for (size_t segment = 0; segment < numIrSegments_; segment++) {
    // resize segment and fill with 0s
    irSegmentsFFT_[segment].resize(fftSize_ * 2);

    // fill segment with ir samples
    size_t offset = segment * segmentSize_;
    size_t segmentSizeAdj = std::min(segmentSize_, irLength - offset);
    std::vector<float> irSamples(fftSize_);
    for (size_t sample = 0; sample < segmentSizeAdj; sample++) {
      irSamples[sample] = irData[sample + offset];
    }

    // apply fft on segment
    fft(irSamples.data(), irSegmentsFFT_[segment].data(), fftSize_);
  }

  irLoaded_ = true;
}

void
EarlyConvolutionEngine::process(const float* input,
                                float* output,
                                const size_t numSamples)
{
  // if no ir then set output to input
  if (!irLoaded_) {
    std::copy(input, input + numSamples, output);
    return;
  }

  // pull in dry samples (input)
  std::vector<float> drySamples(fftSize_);
  for (size_t sample = 0; sample < numSamples; sample++)
    drySamples[sample] = input[sample];

  // take fft on input segment
  std::vector<float> dryFFT(fftSize_ * 2);
  fft(drySamples.data(), dryFFT.data(), fftSize_);

  // multiply 0 index segment dry FFT with 0 index segment ir FFT
  std::vector<float> combinedFFT(fftSize_ * 2);
  multiplyAndAccumulateFFTs(dryFFT, irSegmentsFFT_[0], combinedFFT);

  // take IFFT
  std::vector<float> combinedSamples(fftSize_);
  ifftReal(combinedFFT.data(), combinedSamples.data(), fftSize_);

  // add overlap and set output for 1 block
  for (size_t sample = 0; sample < numSamples; sample++) {
    output[sample] = combinedSamples[sample] + overlapBuffer_[sample];
  }

  // add overlap for tail
  for (size_t sample = numSamples; sample < fftSize_; sample++)
    combinedSamples[sample] += overlapBuffer_[sample];

  // save tail into overlapBuffer for next go around
  std::copy(combinedSamples.begin() + numSamples,
            combinedSamples.begin() + fftSize_,
            overlapBuffer_.begin());
  std::fill(overlapBuffer_.begin() + (fftSize_ - numSamples),
            overlapBuffer_.end(),
            0.0f);
}

void
EarlyConvolutionEngine::reset()
{
  currSegment_ = 0;
  std::fill(overlapBuffer_.begin(), overlapBuffer_.end(), 0.0f);
}

void
LateConvolutionEngine::loadIR(const float* irData, const size_t irLength)
{
  if (irLength == 0 || irData == nullptr)
    return;

  // initialize overlap buffer (this seems like the best place to do it)
  overlapBuffer_.resize(fftSize_, 0.0f);

  // clear any stale buffers
  reset();

  // calculate number of ffts (segments)
  // note ceil(a /b) = (a + b - 1) / b and this avoids type conversions
  numIrSegments_ = (irLength + segmentSize_ - 1) / segmentSize_;
  irSegmentsFFT_.resize(numIrSegments_);
  inputHistoryFFT_.resize(numIrSegments_);

  for (size_t segment = 0; segment < numIrSegments_; segment++) {
    // resize segment and fill with 0s
    irSegmentsFFT_[segment].resize(fftSize_ * 2, 0.0f);
    inputHistoryFFT_[segment].resize(fftSize_ * 2, 0.0f);

    // fill segment with ir samples
    size_t offset = segment * segmentSize_;
    size_t segmentSizeAdj = std::min(segmentSize_, irLength - offset);
    for (size_t sample = 0; sample < segmentSizeAdj; sample++) {
      irSegmentsFFT_[segment][sample] = irData[sample + offset];
    }

    // apply fft on segment
    fft_.performRealOnlyForwardTransform(irSegmentsFFT_[segment].data());
  }

  irLoaded_ = true;
}

void
LateConvolutionEngine::process(const float* input,
                               float* output,
                               const size_t numSamples)
{
  // if no ir then set output to input
  if (!irLoaded_) {
    std::copy(input, input + numSamples, output);
    return;
  }

  // pull in input segment
  std::vector<float> drySegment(fftSize_ * 2, 0.0f);
  for (size_t sample = 0; sample < numSamples; sample++)
    drySegment[sample] = input[sample];
  // take fft on dry segment
  fft_.performRealOnlyForwardTransform(drySegment.data());
  // add dry fft to history
  inputHistoryFFT_[currSegment_] = drySegment;

  // calculations for [1..n-1] segments
  std::vector<float> combined(fftSize_ * 2, 0.0f);
  for (size_t segment = 1; segment < numIrSegments_; segment++) {
    // multiply and accumulate dry fft and ir fft onto the combined buffer
    size_t segmentsBackIdx =
      (currSegment_ + numIrSegments_ - segment) % numIrSegments_;
    multiplyAndAccumulateFFTs(
      inputHistoryFFT_[segmentsBackIdx], irSegmentsFFT_[segment], combined);
  }

  // take IFFT
  fft_.performRealOnlyInverseTransform(combined.data());

  // add overlap and set output for 1 block
  for (size_t sample = 0; sample < numSamples; sample++) {
    output[sample] = combined[sample] + overlapBuffer_[sample];
  }

  // add overlap for tail
  for (size_t sample = numSamples; sample < fftSize_; sample++)
    combined[sample] += overlapBuffer_[sample];

  // save tail into overlapBuffer for next go around
  std::copy(combined.begin() + numSamples,
            combined.begin() + fftSize_,
            overlapBuffer_.begin());
  std::fill(overlapBuffer_.begin() + (fftSize_ - numSamples),
            overlapBuffer_.end(),
            0.0f);

  // advance current segment
  currSegment_ = (currSegment_ + 1) % numIrSegments_;
}

void
LateConvolutionEngine::reset()
{
  currSegment_ = 0;
  std::fill(overlapBuffer_.begin(), overlapBuffer_.end(), 0.0f);

  for (auto& segment : inputHistoryFFT_) {
    std::fill(segment.begin(), segment.end(), 0.0f);
  }
}

void
EarlyStereoConvolutionReverb::loadIR(const float* irData,
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
EarlyStereoConvolutionReverb::process(float* left, float* right, int numSamples)
{
  leftEngine_.process(left, left, numSamples);
  rightEngine_.process(right, right, numSamples);
}

void
EarlyStereoConvolutionReverb::reset()
{
  leftEngine_.reset();
  rightEngine_.reset();
}

void
LateStereoConvolutionReverb::loadIR(const float* irData,
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
LateStereoConvolutionReverb::process(float* left, float* right, int numSamples)
{
  leftEngine_.process(left, left, numSamples);
  rightEngine_.process(right, right, numSamples);
}

void
LateStereoConvolutionReverb::reset()
{
  leftEngine_.reset();
  rightEngine_.reset();
}
