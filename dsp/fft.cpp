#include "fft.h"
#include <cmath>
#include <numbers>
#include <unordered_map>
#include <vector>

// log2 of a power-of-two
static int
log2n(size_t size)
{
  int n = 0;
  while (size > 1) {
    size >>= 1;
    n++;
  }
  return n;
}

static size_t
bitReverse(size_t x, size_t numOfBits)
{
  size_t result = 0;
  for (size_t i = 0; i < numOfBits; i++) {
    result = (result << 1) | (x & 1);
    x >>= 1;
  }
  return result;
}

// cached bit-reversal tables, built once per FFT size
static std::unordered_map<size_t, std::vector<size_t>>&
bitReversalTables()
{
  static std::unordered_map<size_t, std::vector<size_t>> tables;
  return tables;
}

static const std::vector<size_t>&
getBitReversalTable(size_t size)
{
  auto& tables = bitReversalTables();
  auto it = tables.find(size);
  if (it != tables.end())
    return it->second;

  int bits = log2n(size);
  std::vector<size_t> table(size);
  for (size_t i = 0; i < size; i++)
    table[i] = bitReverse(i, bits);

  auto [inserted, _] = tables.emplace(size, std::move(table));
  return inserted->second;
}

// in-place Cooley-Tukey FFT on interleaved complex buffer
static void
fftCore(float* buf, size_t size, bool forward)
{
  // swap each index with its bit-reversed partner
  size_t numOfBits = log2n(size);
  for (size_t i = 0; i < size; i++) {
    size_t j = bitReverse(i, numOfBits);
    if (j > i) {
      std::swap(buf[i * 2], buf[j * 2]);
      std::swap(buf[i * 2 + 1], buf[j * 2 + 1]);
    }
  }

  // butterfly stages
  for (size_t stageSize = 2; stageSize <= size; stageSize <<= 1) {
    float theta = (forward ? -1.0f : 1.0f) * 2.0f * std::numbers::pi_v<float> /
                  (float)stageSize;
    float wBaseReal = std::cos(theta);
    float wBaseImag = std::sin(theta);

    for (size_t i = 0; i < size; i += stageSize) {
      float wReal = 1.0f, wImag = 0.0f;
      // k is butterfly
      for (size_t k = 0; k < stageSize / 2; k++) {
        size_t u = i + k;
        size_t v = i + k + stageSize / 2;

        float uReal = buf[u * 2];
        float uImag = buf[u * 2 + 1];
        float tReal = wReal * buf[v * 2] - wImag * buf[v * 2 + 1];
        float tImag = wReal * buf[v * 2 + 1] + wImag * buf[v * 2];

        buf[u * 2] = uReal + tReal;
        buf[u * 2 + 1] = uImag + tImag;
        buf[v * 2] = uReal - tReal;
        buf[v * 2 + 1] = uImag - tImag;

        float newWReal = wReal * wBaseReal - wImag * wBaseImag;
        wImag = wReal * wBaseImag + wImag * wBaseReal;
        wReal = newWReal;
      }
    }
  }
}

void
fft(const float* input, float* output, size_t size)
{
  for (size_t i = 0; i < size; i++) {
    output[i * 2] = input[i]; // real
    output[i * 2 + 1] = 0.0f; // imag = 0
  }
  fftCore(output, size, true);
}

void
ifft(const float* input, float* output, size_t size)
{
  for (size_t i = 0; i < size * 2; i++)
    output[i] = input[i];

  fftCore(output, size, false);

  // normalize
  for (size_t i = 0; i < size * 2; i++)
    output[i] /= (float)size;
}

// --- steppable FFT ---

void
fft_init(FFTState& state, const float* realInput)
{
  const auto& table = getBitReversalTable(state.size);

  // zero buffer, then scatter real samples to bit-reversed positions
  for (size_t i = 0; i < state.size * 2; i++)
    state.data[i] = 0.0f;
  for (size_t i = 0; i < state.size; i++)
    state.data[table[i] * 2] = realInput[i];

  state.totalStages = log2n(state.size);
  state.currentStage = 0;
  state.forward = true;
  state.groupOffset = 0;
}

void
ifft_init(FFTState& state, const float* complexInput)
{
  const auto& table = getBitReversalTable(state.size);

  // copy complex samples to bit-reversed positions
  for (size_t i = 0; i < state.size; i++) {
    size_t j = table[i];
    state.data[j * 2] = complexInput[i * 2];
    state.data[j * 2 + 1] = complexInput[i * 2 + 1];
  }

  state.totalStages = log2n(state.size);
  state.currentStage = 0;
  state.forward = false;
  state.groupOffset = 0;
}

bool
fft_partial(FFTState& state, size_t maxGroups, size_t& butterfliesOut)
{
  float* buf = state.data;
  size_t size = state.size;
  int totalStages = state.totalStages;
  bool forward = state.forward;
  butterfliesOut = 0;

  if (state.currentStage >= totalStages)
    return true;

  size_t groupsDone = 0;

  while (groupsDone < maxGroups && state.currentStage < totalStages) {
    size_t stageSize = (size_t)1 << (state.currentStage + 1);
    size_t numGroups = size / stageSize;

    float theta = (forward ? -1.0f : 1.0f) * 2.0f *
                  std::numbers::pi_v<float> / (float)stageSize;
    float wBaseReal = std::cos(theta);
    float wBaseImag = std::sin(theta);

    size_t groupsAllowedInBudget = maxGroups - groupsDone;
    size_t groupsRemainingInStage = numGroups - state.groupOffset;
    size_t groupsThisRound =
      std::min(groupsAllowedInBudget, groupsRemainingInStage);

    for (size_t g = 0; g < groupsThisRound; g++) {
      size_t groupStart = (state.groupOffset + g) * stageSize;
      float wReal = 1.0f, wImag = 0.0f;

      for (size_t k = 0; k < stageSize / 2; k++) {
        size_t u = groupStart + k;
        size_t v = groupStart + k + stageSize / 2;

        float uReal = buf[u * 2];
        float uImag = buf[u * 2 + 1];
        float tReal = wReal * buf[v * 2] - wImag * buf[v * 2 + 1];
        float tImag = wReal * buf[v * 2 + 1] + wImag * buf[v * 2];

        buf[u * 2] = uReal + tReal;
        buf[u * 2 + 1] = uImag + tImag;
        buf[v * 2] = uReal - tReal;
        buf[v * 2 + 1] = uImag - tImag;

        float newWReal = wReal * wBaseReal - wImag * wBaseImag;
        wImag = wReal * wBaseImag + wImag * wBaseReal;
        wReal = newWReal;
      }
    }

    size_t butterfliesPerGroup = stageSize / 2;
    butterfliesOut += groupsThisRound * butterfliesPerGroup;

    state.groupOffset += groupsThisRound;
    groupsDone += groupsThisRound;

    if (state.groupOffset >= numGroups) {
      state.groupOffset = 0;
      state.currentStage++;
    }
  }

  return state.currentStage >= totalStages;
}

void
ifft_extract_real(const FFTState& state, float* output)
{
  for (size_t i = 0; i < state.size; i++)
    output[i] = state.data[i * 2] / (float)state.size;
}

void
ifftReal(const float* input, float* output, size_t size, float* workBuf)
{
  if (workBuf) {
    ifft(input, workBuf, size);
    for (size_t i = 0; i < size; i++)
      output[i] = workBuf[i * 2];
  } else {
    std::vector<float> fullOutput(size * 2);
    ifft(input, fullOutput.data(), size);
    for (size_t i = 0; i < size; i++)
      output[i] = fullOutput[i * 2];
  }
}
