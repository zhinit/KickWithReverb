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

  // calculate number of ffts (segments)
  // note ceil(a /b) = (a + b - 1) / b and this avoids type conversions
  numIrSegments_ = (irLength + segmentSize_ - 1) / segmentSize_;
  irSegmentsFFT_.resize(numIrSegments_);

  for (size_t segment = 0; segment < numIrSegments_; segment++) {
    // resize segment and fill with 0s
    irSegmentsFFT_[segment].resize(fftSize_ * 2, 0.0f);

    // fill segment with ir samples
    size_t offset = segment * segmentSize_;
    size_t segmentSizeAdj = std::min(segmentSize_, irLength - offset);
    for (size_t sample = 0; sample < segmentSizeAdj; sample++) {
      irSegmentsFFT_[segment][sample] = irData[sample + offset];
    }

    // apply fft on segment
    fft_.performRealOnlyForwardTransform(irSegmentsFFT_[segment].data());
  }
}

void
EarlyConvolutionEngine::process(const float* input,
                                float* output,
                                const size_t numSamples)
{
  // pull in input segment
  std::vector<float> drySegment;
  drySegment.resize(fftSize_ * 2.0, 0.0f);
  for (size_t sample = 0; sample < segmentSize_; sample++)
    drySegment[sample] = input[sample];

  // take fft on input segment
  fft_.performRealOnlyForwardTransform(drySegment.data());

  // reflect new info in history
  inputHistoryFFT_[currSegment_] = drySegment;
  currSegment_++;

  // multiply 0 index segment dry FFT with 0 index segment ir FFT
  std::vector<float> combinedFFT_ =
    multiplySpectra(drySegment, irSegmentsFFT_[currSegment_]);

  // take IFFT to get result
  // put it in the output
}

void
EarlyConvolutionEngine::reset()
{
  currSegment_ = 0;
  std::fill(overlapBuffer_.begin(), overlapBuffer_.end(), 0.0f);

  for (auto& segment : inputHistoryFFT_) {
    std::fill(segment.begin(), segment.end(), 0.0f);
  }
}

void
LateConvolutionEngine::loadIR(const float* irData, const size_t irLength)
{
  // pass
}

void
LateConvolutionEngine::process(const float* input,
                               float* output,
                               const size_t numSamples)
{
  // take fft on input
  // reflect new info in history
  // multiply 0 index segment dry FFT with 0 index segment ir FFT
  // take IFFT to get result
  // put it in the output
}

void
LateConvolutionEngine::reset()
{
  // pass
}
