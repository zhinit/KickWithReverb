#include "convolution_mt.h"
#include <cmath>
#include <emscripten/bind.h>

class TailWorker
{
public:
  void prepareIR(uintptr_t irPtr, size_t irLength, int numChannels)
  {
    const float* irData = reinterpret_cast<const float*>(irPtr);

    std::vector<float> leftIR(irLength);
    std::vector<float> rightIR(irLength);
    if (numChannels == 1) {
      leftIR.assign(irData, irData + irLength);
      rightIR.assign(irData, irData + irLength);
    } else {
      for (size_t i = 0; i < irLength; ++i) {
        leftIR[i] = irData[i * 2];
        rightIR[i] = irData[i * 2 + 1];
      }
    }

    // normalize IR
    normalizeEnergy(leftIR);
    normalizeEnergy(rightIR);

    // Prepare tail levels only (level 0 runs on audio thread)
    tailLeft_.prepareIR(leftIR.data(), irLength, blockSize_);
    tailRight_.prepareIR(rightIR.data(), irLength, blockSize_);

    resultLeft_.assign(blockSize_, 0.0f);
    resultRight_.assign(blockSize_, 0.0f);
    irReady_ = true;
  }

  bool loadNextLevel()
  {
    bool moreLeft = tailLeft_.loadNextLevel();
    bool moreRight = tailRight_.loadNextLevel();
    return moreLeft || moreRight;
  }

  void processBlock(uintptr_t dryPtr)
  {
    if (!irReady_)
      return;

    const float* dry = reinterpret_cast<const float*>(dryPtr);

    // Tail levels only
    tailLeft_.processBlock(dry);
    tailRight_.processBlock(dry);

    const float* tl = tailLeft_.getResult();
    const float* tr = tailRight_.getResult();
    std::copy(tl, tl + blockSize_, resultLeft_.begin());
    std::copy(tr, tr + blockSize_, resultRight_.begin());
  }

  uintptr_t getResultLeft()
  {
    return reinterpret_cast<uintptr_t>(resultLeft_.data());
  }

  uintptr_t getResultRight()
  {
    return reinterpret_cast<uintptr_t>(resultRight_.data());
  }

private:
  static constexpr size_t blockSize_ = 128;
  bool irReady_ = false;

  // Tail levels 1+ only (level 0 runs on audio thread)
  TailEngine tailLeft_;
  TailEngine tailRight_;

  std::vector<float> resultLeft_;
  std::vector<float> resultRight_;
};

EMSCRIPTEN_BINDINGS(tail_module)
{
  emscripten::class_<TailWorker>("TailWorker")
    .constructor()
    .function("prepareIR", &TailWorker::prepareIR)
    .function("loadNextLevel", &TailWorker::loadNextLevel)
    .function("processBlock", &TailWorker::processBlock)
    .function("getResultLeft", &TailWorker::getResultLeft)
    .function("getResultRight", &TailWorker::getResultRight);
}
