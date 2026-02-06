#include "sample_player.h"
#include <algorithm>
#include <cstring>

void SamplePlayer::loadSample(uintptr_t ptr, size_t length)
{
    const float* data = reinterpret_cast<const float*>(ptr);
    samples_.emplace_back(data, data + length);
}

void SamplePlayer::selectSample(int index)
{
    if (index >= 0 && index < static_cast<int>(samples_.size())) {
        activeSampleIndex_ = index;
        position_ = 0;
        playing_ = false;
        releasing_ = false;
        envelopeLevel_ = 1.0f;
    }
}

void SamplePlayer::trigger()
{
    position_ = 0;
    playing_ = true;
    releasing_ = false;
    envelopeLevel_ = 1.0f;
}

void SamplePlayer::stop()
{
    if (!playing_ || releasing_)
        return;

    if (releaseDuration_ <= 0.0f) {
        playing_ = false;
        return;
    }

    releasing_ = true;
    envelopeDecrement_ = 1.0f / (releaseDuration_ * sampleRate_);
}

void SamplePlayer::process(float* left, float* right, int numSamples)
{
    if (samples_.empty() || activeSampleIndex_ < 0
        || activeSampleIndex_ >= static_cast<int>(samples_.size())) {
        std::memset(left, 0, sizeof(float) * numSamples);
        std::memset(right, 0, sizeof(float) * numSamples);
        return;
    }

    const auto& sample = samples_[activeSampleIndex_];

    // Calculate the endpoint based on lengthRatio_
    size_t endPosition = static_cast<size_t>(sample.size() * lengthRatio_);
    size_t fadeStartPosition = endPosition > kFadeOutSamples
        ? endPosition - kFadeOutSamples
        : 0;

    for (int i = 0; i < numSamples; ++i) {
        float out = 0.0f;

        if (playing_) {
            if (position_ >= endPosition) {
                if (looping_) {
                    position_ = 0;
                } else {
                    playing_ = false;
                    releasing_ = false;
                }
            }

            if (playing_ && position_ < endPosition) {
                out = sample[position_] * volume_;

                // Apply fade-out as we approach the end position
                if (position_ >= fadeStartPosition && !looping_) {
                    float fadeProgress = static_cast<float>(position_ - fadeStartPosition)
                        / static_cast<float>(kFadeOutSamples);
                    out *= (1.0f - fadeProgress);
                }

                if (releasing_) {
                    out *= envelopeLevel_;
                    envelopeLevel_ -= envelopeDecrement_;

                    if (envelopeLevel_ <= 0.0f) {
                        envelopeLevel_ = 0.0f;
                        playing_ = false;
                        releasing_ = false;
                    }
                }

                ++position_;
            }
        }

        left[i] = out;
        right[i] = out;
    }
}

void SamplePlayer::setReleaseDuration(float seconds)
{
    releaseDuration_ = std::max(0.0f, seconds);
}

void SamplePlayer::setVolume(float gainLinear)
{
    volume_ = std::max(0.0f, gainLinear);
}

void SamplePlayer::setSampleRate(float sampleRate)
{
    sampleRate_ = sampleRate;
}

void SamplePlayer::setLooping(bool loop)
{
    looping_ = loop;
}

void SamplePlayer::setLengthRatio(float ratio)
{
    lengthRatio_ = std::clamp(ratio, 0.1f, 1.0f);
}
