#include "convolution-mt.h"

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
  // pass
}

void
EarlyConvolutionEngine::reset()
{
  // pass
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
  // pass
}

void
LateConvolutionEngine::reset()
{
  // pass
}
