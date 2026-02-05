#pragma once

#include <vector>
#include <cstddef>
#include <cstdint>

class SamplePlayer
{
public:
    SamplePlayer() = default;

    // Copies Float32Array data from WASM heap into internal storage
    void loadSample(uintptr_t ptr, size_t length);

    // Switch active sample buffer (resets playback position)
    void selectSample(int index);

    // Reset playback to position 0
    void trigger();

    // Initiate fade-out envelope, then stop
    void stop();

    // Read from active sample, apply volume and fade envelope
    void process(float* left, float* right, int numSamples);

    void setReleaseDuration(float seconds);
    void setVolume(float gainLinear);
    void setSampleRate(float sampleRate);

private:
    float sampleRate_ = 44100.0f;

    std::vector<std::vector<float>> samples_;
    int activeSampleIndex_ = 0;
    size_t position_ = 0;
    bool playing_ = false;

    float volume_ = 1.0f;

    // Fade-out envelope
    float releaseDuration_ = 0.0f;
    bool releasing_ = false;
    float envelopeLevel_ = 1.0f;
    float envelopeDecrement_ = 0.0f; // per-sample decrement during release
};
