#include "convolution_mt.h"

static void
multiplyAndAccumulateFFTs(const std::vector<float>& fftA,
                          const std::vector<float>& fftB,
                          std::vector<float>& fftOutput)
{
  for (size_t i = 0; i < fftA.size(); i += 2) {
    float a = fftA[i];
    float b = fftA[i + 1];
    float c = fftB[i];
    float d = fftB[i + 1];
    fftOutput[i] += a * c - b * d;
    fftOutput[i + 1] += c * b + a * d;
  }
}

void
normalizeEnergy(std::vector<float>& ir)
{
  float sumOfSquares = 0.0f;
  for (float sample : ir)
    sumOfSquares += sample * sample;
  if (sumOfSquares >= 0.0f) {
    float rootSumOfSquares = std::sqrt(sumOfSquares);
    for (float& sample : ir)
      sample /= rootSumOfSquares;
  }
}

ConvolutionLevel::ConvolutionLevel(int level,
                                   size_t blockSize,
                                   size_t accumOffset,
                                   size_t numPartitions,
                                   size_t outputDelay,
                                   int pipelineStartDelay)
  : level_(level)
  , blockSize_(blockSize)
  , period_(1 << level)
  , superBlockSize_(blockSize * (1 << level))
  , fftSize_(2 * superBlockSize_)
  , numPartitions_(numPartitions)
  , dryAccumSamples_(superBlockSize_, 0.0f)
  , accumPos_(accumOffset % (1 << level))
  , overlapSamples_(superBlockSize_, 0.0f)
  , outputBufA_(superBlockSize_, 0.0f)
  , outputBufB_(superBlockSize_, 0.0f)
  , curOutputBuf_(outputBufA_.data())
  , nextOutputBuf_(outputBufB_.data())
  , outputReadBlock_(0)
  , result_(blockSize, 0.0f)
  , savedDrySamples_(superBlockSize_, 0.0f)
  , dryPaddedSamples_(fftSize_, 0.0f)
  , dryFFT_(fftSize_ * 2, 0.0f)
  , combinedFFT_(fftSize_ * 2, 0.0f)
  , combinedSamples_(fftSize_, 0.0f)
  , ifftTemp_(fftSize_ * 2, 0.0f)
  , dryFFTHistory_(numPartitions, std::vector<float>(fftSize_ * 2, 0.0f))
  , dryFFTHistoryPos_(0)
  , clearance_(outputDelay)
  , pipelineState_(PipelineState::IDLE)
  , pipelineActive_(false)
  , pipelineReady_(false)
  , pipelineBlockCount_(0)
  , butterfliesPerBlock_(0)
  , cmacPartition_(0)
  , pipelineStartDelay_(0)
  , startCountdown_(0)
  , fwdState_{}
  , invState_{}
{
  // level 0: no double-buffering needed
  if (clearance_ == 0) {
    nextOutputBuf_ = curOutputBuf_;
  }

  // stagger pipeline starts to spread FFT_INIT across blocks
  if (pipelineStartDelay >= 0) {
    pipelineStartDelay_ = std::min(pipelineStartDelay, (int)(clearance_ / 2));
  } else if (clearance_ > 1 && level_ >= 2) {
    int stagger = 1 << (level_ - 2);
    pipelineStartDelay_ = std::min(stagger, (int)(clearance_ / 2));
  }
}

void
ConvolutionLevel::processBlock(
  const float* dryBlock,
  const std::vector<std::vector<float>>& irPartitionFFTs)
{
  // swap buffers if pipeline finished
  if (pipelineReady_) {
    std::swap(curOutputBuf_, nextOutputBuf_);
    outputReadBlock_ = 0;
    pipelineReady_ = false;
  }

  // accumulate dry block
  std::copy(dryBlock,
            dryBlock + blockSize_,
            dryAccumSamples_.begin() + accumPos_ * blockSize_);
  ++accumPos_;

  // fire when super-block is full
  if (accumPos_ >= period_) {
    accumPos_ = 0;

    if (clearance_ == 0) {
      doInstantCompute(irPartitionFFTs);
      outputReadBlock_ = 0;
    } else {
      // snapshot dry samples before they get overwritten
      std::copy(dryAccumSamples_.begin(), dryAccumSamples_.end(), savedDrySamples_.begin());
      pipelineActive_ = true;
      pipelineBlockCount_ = 0;
      startCountdown_ = pipelineStartDelay_;
    }
  }

  // advance pipeline if active
  if (pipelineActive_) {
    if (startCountdown_ > 0) {
      --startCountdown_;
    } else {
      if (pipelineState_ == PipelineState::IDLE && pipelineBlockCount_ == 0) {
        startPipeline();
      }
      if (pipelineState_ != PipelineState::IDLE) {
        advancePipeline(irPartitionFFTs);
      }
      ++pipelineBlockCount_;

      // done when work finished and clearance time elapsed
      if (pipelineState_ == PipelineState::IDLE && pipelineBlockCount_ > 0 &&
          (pipelineBlockCount_ + pipelineStartDelay_) >= (int)clearance_) {
        pipelineActive_ = false;
        pipelineReady_ = true;
      }
    }
  }

  // serve current block from output buffer
  size_t readIdx = outputReadBlock_ % period_;
  size_t offset = readIdx * blockSize_;
  std::copy(curOutputBuf_ + offset,
            curOutputBuf_ + offset + blockSize_,
            result_.begin());
  ++outputReadBlock_;
}

const float*
ConvolutionLevel::getResult() const
{
  return result_.data();
}

void
ConvolutionLevel::reset()
{
  accumPos_ = 0;
  outputReadBlock_ = 0;
  dryFFTHistoryPos_ = 0;
  pipelineState_ = PipelineState::IDLE;
  pipelineActive_ = false;
  pipelineReady_ = false;
  pipelineBlockCount_ = 0;

  std::fill(dryAccumSamples_.begin(), dryAccumSamples_.end(), 0.0f);
  std::fill(savedDrySamples_.begin(), savedDrySamples_.end(), 0.0f);
  std::fill(overlapSamples_.begin(), overlapSamples_.end(), 0.0f);
  std::fill(outputBufA_.begin(), outputBufA_.end(), 0.0f);
  std::fill(outputBufB_.begin(), outputBufB_.end(), 0.0f);
  std::fill(result_.begin(), result_.end(), 0.0f);
  for (auto& s : dryFFTHistory_)
    std::fill(s.begin(), s.end(), 0.0f);

  curOutputBuf_ = outputBufA_.data();
  nextOutputBuf_ = (clearance_ == 0) ? outputBufA_.data() : outputBufB_.data();
}

void
ConvolutionLevel::startPipeline()
{
  cmacPartition_ = 0;

  // zero-pad saved dry samples for FFT
  std::copy(savedDrySamples_.begin(), savedDrySamples_.end(), dryPaddedSamples_.begin());
  std::fill(dryPaddedSamples_.begin() + superBlockSize_, dryPaddedSamples_.end(), 0.0f);

  fwdState_.data = dryFFT_.data();
  fwdState_.size = fftSize_;
  fwdState_.currentStage = 0;
  fwdState_.forward = true;

  pipelineState_ = PipelineState::FFT_INIT;

  // butterfly budget: spread total work evenly across clearance blocks
  int totalStages = 0;
  {
    size_t n = fftSize_;
    while (n > 1) {
      n >>= 1;
      ++totalStages;
    }
  }
  long long halfN = (long long)fftSize_ / 2;
  long long totalButterflies = halfN * totalStages * 2 // fwd + inv FFT
                               + halfN * 2             // 2 inits
                               + halfN * (long long)numPartitions_ // CMAC
                               + halfN;                            // OLA
  int effectiveClearance = (int)clearance_ - pipelineStartDelay_;
  if (effectiveClearance < 1)
    effectiveClearance = 1;
  butterfliesPerBlock_ =
    std::max(1, (int)(totalButterflies / effectiveClearance));
}

void
ConvolutionLevel::advancePipeline(
  const std::vector<std::vector<float>>& irPartitionFFTs)
{
  int buttBudget = butterfliesPerBlock_;

  while (buttBudget > 0 && pipelineState_ != PipelineState::IDLE) {
    switch (pipelineState_) {

      case PipelineState::FFT_INIT: {
        fft_init(fwdState_, dryPaddedSamples_.data());
        pipelineState_ = PipelineState::FFT_FORWARD;
        buttBudget -= (int)(fftSize_ / 2);
        break;
      }

      case PipelineState::FFT_FORWARD: {
        if (fwdState_.currentStage >= fwdState_.totalStages) {
          std::copy(dryFFT_.begin(),
                    dryFFT_.end(),
                    dryFFTHistory_[dryFFTHistoryPos_].begin());
          std::fill(combinedFFT_.begin(), combinedFFT_.end(), 0.0f);
          cmacPartition_ = 0;
          pipelineState_ = PipelineState::CMAC;
          break;
        }

        while (buttBudget > 0 &&
               fwdState_.currentStage < fwdState_.totalStages) {
          size_t stageSize = (size_t)1 << (fwdState_.currentStage + 1);
          size_t butterfliesPerGroup = stageSize / 2;
          size_t maxGroups = std::max(
            (size_t)1,
            (size_t)buttBudget / std::max((size_t)1, butterfliesPerGroup));
          size_t actualButterflies = 0;
          fft_partial(fwdState_, maxGroups, actualButterflies);
          buttBudget -= std::max((size_t)1, actualButterflies);
        }

        if (fwdState_.currentStage >= fwdState_.totalStages) {
          std::copy(dryFFT_.begin(),
                    dryFFT_.end(),
                    dryFFTHistory_[dryFFTHistoryPos_].begin());
          std::fill(combinedFFT_.begin(), combinedFFT_.end(), 0.0f);
          cmacPartition_ = 0;
          pipelineState_ = PipelineState::CMAC;
        }
        break;
      }

      case PipelineState::CMAC: {
        if (cmacPartition_ < numPartitions_ &&
            cmacPartition_ < irPartitionFFTs.size()) {
          size_t histIdx = (dryFFTHistoryPos_ + numPartitions_ - cmacPartition_) %
                           numPartitions_;
          multiplyAndAccumulateFFTs(dryFFTHistory_[histIdx],
                                    irPartitionFFTs[cmacPartition_],
                                    combinedFFT_);
          ++cmacPartition_;
          buttBudget -= (int)(fftSize_ / 2);
        }

        if (cmacPartition_ >= numPartitions_ ||
            cmacPartition_ >= irPartitionFFTs.size()) {
          dryFFTHistoryPos_ = (dryFFTHistoryPos_ + 1) % numPartitions_;
          invState_.data = ifftTemp_.data();
          invState_.size = fftSize_;
          invState_.currentStage = 0;
          invState_.forward = false;
          invState_.groupOffset = 0;
          pipelineState_ = PipelineState::IFFT_INIT;
        }
        break;
      }

      case PipelineState::IFFT_INIT: {
        ifft_init(invState_, combinedFFT_.data());
        pipelineState_ = PipelineState::FFT_INVERSE;
        buttBudget -= (int)(fftSize_ / 2);
        break;
      }

      case PipelineState::FFT_INVERSE: {
        if (invState_.currentStage >= invState_.totalStages) {
          pipelineState_ = PipelineState::OVERLAP_ADD;
          break;
        }

        while (buttBudget > 0 &&
               invState_.currentStage < invState_.totalStages) {
          size_t stageSize = (size_t)1 << (invState_.currentStage + 1);
          size_t butterfliesPerGroup = stageSize / 2;
          size_t maxGroups = std::max(
            (size_t)1,
            (size_t)buttBudget / std::max((size_t)1, butterfliesPerGroup));
          size_t actualButterflies = 0;
          fft_partial(invState_, maxGroups, actualButterflies);
          buttBudget -= std::max((size_t)1, actualButterflies);
        }

        if (invState_.currentStage >= invState_.totalStages) {
          pipelineState_ = PipelineState::OVERLAP_ADD;
        }
        break;
      }

      case PipelineState::OVERLAP_ADD: {
        ifft_extract_real(invState_, combinedSamples_.data());

        for (size_t i = 0; i < superBlockSize_; ++i)
          nextOutputBuf_[i] = combinedSamples_[i] + overlapSamples_[i];

        std::copy(combinedSamples_.begin() + superBlockSize_,
                  combinedSamples_.end(),
                  overlapSamples_.begin());

        pipelineState_ = PipelineState::IDLE;
        buttBudget = 0;
        break;
      }

      default:
        break;
    }
  }
}

void
ConvolutionLevel::doInstantCompute(
  const std::vector<std::vector<float>>& irPartitionFFTs)
{
  // zero-pad dry samples
  std::copy(dryAccumSamples_.begin(), dryAccumSamples_.end(), dryPaddedSamples_.begin());
  std::fill(dryPaddedSamples_.begin() + superBlockSize_, dryPaddedSamples_.end(), 0.0f);

  fft(dryPaddedSamples_.data(), dryFFT_.data(), fftSize_);

  // store in history
  std::copy(dryFFT_.begin(),
            dryFFT_.end(),
            dryFFTHistory_[dryFFTHistoryPos_].begin());

  // CMAC across all partitions
  std::fill(combinedFFT_.begin(), combinedFFT_.end(), 0.0f);
  for (size_t p = 0; p < numPartitions_ && p < irPartitionFFTs.size(); ++p) {
    size_t histIdx = (dryFFTHistoryPos_ + numPartitions_ - p) % numPartitions_;
    multiplyAndAccumulateFFTs(
      dryFFTHistory_[histIdx], irPartitionFFTs[p], combinedFFT_);
  }

  dryFFTHistoryPos_ = (dryFFTHistoryPos_ + 1) % numPartitions_;

  ifftReal(combinedFFT_.data(), combinedSamples_.data(), fftSize_, ifftTemp_.data());

  // overlap-add
  for (size_t i = 0; i < superBlockSize_; ++i)
    curOutputBuf_[i] = combinedSamples_[i] + overlapSamples_[i];

  std::copy(combinedSamples_.begin() + superBlockSize_,
            combinedSamples_.end(),
            overlapSamples_.begin());
}

void
TailEngine::loadIR(const float* irData, size_t irLength, size_t blockSize)
{
  prepareIR(irData, irLength, blockSize);
  while (loadNextLevel()) {
  }
}

void
TailEngine::prepareIR(const float* irData, size_t irLength, size_t blockSize)
{
  blockSize_ = blockSize;
  storedIR_.assign(irData, irData + irLength);

  size_t numSegments = (irLength + blockSize - 1) / blockSize;
  const size_t maxLevel = 10;

  levels_.clear();
  loadPlan_.clear();
  nextPlanIdx_ = 0;
  result_.assign(blockSize, 0.0f);

  // Gardner scheme: level 0 covers 2 segments (handled by Sampler).
  // level k covers 2*period segments starting at segment 2^(k+1) - 2.
  size_t segsCovered = 2;

  for (size_t k = 1; k <= maxLevel; ++k) {
    size_t gardnerOffset = (1 << (k + 1)) - 2;
    size_t period = 1 << k;

    if (gardnerOffset >= numSegments)
      break;

    size_t totalLevelSegs = 2 * period;
    if (gardnerOffset + totalLevelSegs > numSegments)
      totalLevelSegs = numSegments - gardnerOffset;

    loadPlan_.push_back({ (int)k, gardnerOffset, totalLevelSegs, 2, 0, 0, -1 });
    segsCovered = gardnerOffset + totalLevelSegs;
  }

  // capped partitions for IR beyond maxLevel
  size_t capPeriod = 1 << maxLevel;
  size_t capCoverage = 2 * capPeriod;
  size_t extraSegs =
    (numSegments > segsCovered) ? numSegments - segsCovered : 0;
  size_t numCaps = (extraSegs + capCoverage - 1) / capCoverage;
  size_t stride = (numCaps > 0) ? capPeriod / numCaps : 0;
  if (stride < 1)
    stride = 1;

  size_t maxDelay = 0;
  for (size_t idx = 0; segsCovered < numSegments; ++idx) {
    size_t totalSegs = std::min(capCoverage, numSegments - segsCovered);
    size_t accumOffset = (idx * stride) % capPeriod;

    // total latency is 2*period - 2 (accumulation + pipeline).
    // accumOffset cancels out — inputDelay is independent of it.
    size_t inputDelay = segsCovered - (2 * capPeriod - 2);
    if (inputDelay > maxDelay)
      maxDelay = inputDelay;

    // stagger caps to avoid overlapping FFT_INIT work
    int capStagger = (int)((idx + 1) * capPeriod / (numCaps + 1));
    loadPlan_.push_back({ (int)maxLevel,
                          segsCovered,
                          totalSegs,
                          2,
                          inputDelay,
                          accumOffset,
                          capStagger });
    segsCovered += capCoverage;
  }

  if (loadPlan_.empty()) {
    historyCapacity_ = 1;
  } else {
    historyCapacity_ = maxDelay + 1;
    if (historyCapacity_ < 1)
      historyCapacity_ = 1;
  }
  dryHistorySamples_.assign(historyCapacity_ * blockSize, 0.0f);
  historyPos_ = 0;
}

bool
TailEngine::loadNextLevel()
{
  if (nextPlanIdx_ >= loadPlan_.size())
    return false;

  const auto& plan = loadPlan_[nextPlanIdx_];
  size_t period = 1 << plan.levelIdx;
  size_t superBlockSize = period * blockSize_;
  size_t levelFftSize = 2 * superBlockSize;
  size_t segsPerPartition = period;

  std::vector<std::vector<float>> partitions;
  size_t segsSoFar = 0;

  for (size_t p = 0; p < plan.numPartitions; ++p) {
    std::vector<float> irPartition(levelFftSize, 0.0f);

    for (size_t seg = 0; seg < segsPerPartition && segsSoFar < plan.numSegs;
         ++seg) {
      size_t srcOffset = (plan.irSegOffset + segsSoFar) * blockSize_;
      if (srcOffset < storedIR_.size()) {
        size_t count = std::min(blockSize_, storedIR_.size() - srcOffset);
        for (size_t i = 0; i < count; ++i)
          irPartition[seg * blockSize_ + i] = storedIR_[srcOffset + i];
      }
      ++segsSoFar;
    }

    std::vector<float> partFFT(levelFftSize * 2, 0.0f);
    fft(irPartition.data(), partFFT.data(), levelFftSize);
    partitions.push_back(std::move(partFFT));
  }

  size_t clearance = period - 1;
  levels_.emplace_back(ConvolutionLevel(plan.levelIdx,
                                        blockSize_,
                                        plan.accumOffset,
                                        plan.numPartitions,
                                        clearance,
                                        plan.pipelineStartDelay),
                       std::move(partitions),
                       plan.inputDelay);

  ++nextPlanIdx_;

  // free stored IR when done loading
  if (nextPlanIdx_ >= loadPlan_.size()) {
    storedIR_.clear();
    storedIR_.shrink_to_fit();
  }

  return nextPlanIdx_ < loadPlan_.size();
}

void
TailEngine::processBlock(const float* dryBlock)
{
  if (levels_.empty())
    return;

  std::copy(dryBlock,
            dryBlock + blockSize_,
            dryHistorySamples_.begin() + historyPos_ * blockSize_);

  for (auto& levelInfo : levels_) {
    if (levelInfo.inputDelay == 0) {
      levelInfo.level.processBlock(dryBlock, levelInfo.irPartitionFFTs);
    } else {
      // capped partitions: feed delayed block from history
      size_t delayedPos =
        (historyPos_ + historyCapacity_ - levelInfo.inputDelay) % historyCapacity_;
      const float* delayedBlock =
        dryHistorySamples_.data() + delayedPos * blockSize_;
      levelInfo.level.processBlock(delayedBlock, levelInfo.irPartitionFFTs);
    }
  }

  historyPos_ = (historyPos_ + 1) % historyCapacity_;

  // sum results from all levels
  std::fill(result_.begin(), result_.end(), 0.0f);
  for (auto& levelInfo : levels_) {
    const float* r = levelInfo.level.getResult();
    for (size_t i = 0; i < blockSize_; ++i)
      result_[i] += r[i];
  }
}

const float*
TailEngine::getResult() const
{
  return result_.data();
}

void
TailEngine::reset()
{
  for (auto& levelInfo : levels_)
    levelInfo.level.reset();
  std::fill(result_.begin(), result_.end(), 0.0f);
  std::fill(dryHistorySamples_.begin(), dryHistorySamples_.end(), 0.0f);
  historyPos_ = 0;
}
