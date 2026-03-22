#pragma once
#include "fft.h"
#include <algorithm>
#include <cstddef>
#include <vector>

enum class PipelineState
{
  IDLE,
  FFT_INIT,
  FFT_FORWARD,
  CMAC,
  IFFT_INIT,
  FFT_INVERSE,
  OVERLAP_ADD
};

void
normalizeEnergy(std::vector<float>& ir);

class ConvolutionLevel
{
public:
  ConvolutionLevel(int level,
                   size_t blockSize = 128,
                   size_t accumOffset = 0,
                   size_t numPartitions = 1,
                   size_t outputDelay = 0,
                   int pipelineStartDelay = -1);

  void processBlock(const float* dryBlock,
                    const std::vector<std::vector<float>>& irPartitionFFTs);
  const float* getResult() const;
  void reset();

  size_t fftSize() const { return fftSize_; }
  size_t superBlockSize() const { return superBlockSize_; }

private:
  int level_;
  size_t blockSize_;
  size_t period_;         // 2^level blocks between firings
  size_t superBlockSize_; // period_ * blockSize_
  size_t fftSize_;        // 2 * superBlockSize_
  size_t numPartitions_;

  std::vector<float> dryAccumSamples_;
  size_t accumPos_;

  std::vector<float> overlapSamples_;

  // double-buffered output
  std::vector<float> outputBufA_;
  std::vector<float> outputBufB_;
  float* curOutputBuf_;
  float* nextOutputBuf_;
  size_t outputReadBlock_;

  std::vector<float> result_;

  // pre-allocated working buffers
  std::vector<float> savedDrySamples_;
  std::vector<float> dryPaddedSamples_;
  std::vector<float> dryFFT_;
  std::vector<float> combinedFFT_;
  std::vector<float> combinedSamples_;
  std::vector<float> ifftTemp_;

  // UPOLS dry FFT history (one per partition)
  std::vector<std::vector<float>> dryFFTHistory_;
  size_t dryFFTHistoryPos_;

  // pipeline state
  size_t clearance_;
  PipelineState pipelineState_;
  bool pipelineActive_;
  bool pipelineReady_;
  int pipelineBlockCount_;
  int butterfliesPerBlock_;
  size_t cmacPartition_;
  int pipelineStartDelay_;
  int startCountdown_;

  FFTState fwdState_;
  FFTState invState_;

  void startPipeline();
  void advancePipeline(const std::vector<std::vector<float>>& irPartitionFFTs);
  void doInstantCompute(const std::vector<std::vector<float>>& irPartitionFFTs);
};

class TailEngine
{
public:
  // loads all levels at once (used by tests)
  void loadIR(const float* irData, size_t irLength, size_t blockSize = 128);

  // incremental: call prepareIR once, then loadNextLevel() repeatedly
  void prepareIR(const float* irData, size_t irLength, size_t blockSize = 128);
  bool loadNextLevel();

  void processBlock(const float* dryBlock);
  const float* getResult() const;
  void reset();

private:
  size_t blockSize_ = 128;

  struct LevelInfo
  {
    ConvolutionLevel level;
    std::vector<std::vector<float>> irPartitionFFTs;
    size_t inputDelay;

    LevelInfo(ConvolutionLevel l,
              std::vector<std::vector<float>> irFFTs,
              size_t delay)
      : level(std::move(l))
      , irPartitionFFTs(std::move(irFFTs))
      , inputDelay(delay)
    {
    }
  };

  struct LevelPlan
  {
    int levelIdx;
    size_t irSegOffset;
    size_t numSegs;
    size_t numPartitions;
    size_t inputDelay;
    size_t accumOffset;
    int pipelineStartDelay; // -1 = auto, >= 0 = explicit
  };

  std::vector<LevelInfo> levels_;
  std::vector<float> result_;

  std::vector<float> storedIR_;
  std::vector<LevelPlan> loadPlan_;
  size_t nextPlanIdx_ = 0;

  // shared dry history (all levels read from this)
  std::vector<float> dryHistorySamples_;
  size_t historyCapacity_ = 0;
  size_t historyPos_ = 0;
};
