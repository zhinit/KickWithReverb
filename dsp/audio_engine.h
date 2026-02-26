#pragma once

#include "sample_player.h"
#include "distortion.h"
#include "ott.h"
#include "convolution.h"
#include "filter.h"
#include "limiter.h"

#include <array>
#include <cmath>
#include <cstdint>
#include <vector>

class AudioEngine
{
public:
    AudioEngine();

    void prepare(float sampleRate);
    void process(uintptr_t leftPtr, uintptr_t rightPtr, int numSamples);

    // Kick
    void loadKickSample(uintptr_t ptr, size_t length);
    void selectKickSample(int index);
    void setKickLength(float ratio);
    void setKickDistortion(float amount);
    void setKickOTT(float amount);

    // Noise
    void loadNoiseSample(uintptr_t ptr, size_t length);
    void selectNoiseSample(int index);
    void setNoiseVolume(float db);
    void setNoiseLowPass(float hz);
    void setNoiseHighPass(float hz);

    // Reverb
    void loadIR(uintptr_t ptr, size_t irLength, size_t numChannels);
    void selectIR(int index);
    void setReverbLowPass(float hz);
    void setReverbHighPass(float hz);
    void setReverbVolume(float db);

    // Master chain
    void setMasterOTT(float amount);
    void setMasterDistortion(float amount);
    void setMasterLimiter(float amount);

    // Transport
    void setBPM(float bpm);
    void setLooping(bool enabled);
    void cue();
    void cueRelease();

private:
    static constexpr int kBlockSize = 128;

    float sampleRate_ = 44100.0f;

    // Players
    SamplePlayer kickPlayer_;
    SamplePlayer noisePlayer_;

    // Kick effects
    Distortion kickDistortion_;
    OTTCompressor kickOTT_{ 10.0f, 9.0f, -3.0f, 0.0f };
    float kickDistortionMix_ = 0.0f;

    // Noise filters
    Filter noiseLowPass_;
    Filter noiseHighPass_;

    // Reverb
    StereoConvolutionReverb convolution_;
    Filter reverbLowPass_;
    Filter reverbHighPass_;
    float reverbGain_ = 1.0f;

    // IR storage for selectIR
    struct IRData
    {
        std::vector<float> samples;
        size_t lengthPerChannel;
        int numChannels;
    };
    std::vector<IRData> irStorage_;
    int activeIRIndex_ = -1;

    // Master chain
    OTTCompressor masterOTT_{ 8.0f, 3.0f, -3.0f, 0.0f };
    Distortion masterDistortion_;
    float masterDistortionMix_ = 0.0f;
    float masterLimiterGain_ = 1.0f;
    Limiter masterLimiter_;

    // Transport
    float bpm_ = 140.0f;
    bool looping_ = false;
    int samplesPerBeat_ = 0;
    int samplesSinceBeat_ = 0;
    int noiseBeatCount_ = 0;
    bool pendingNoiseTrigger_ = false;

    // Scratch buffers (fixed at AudioWorklet block size)
    std::array<float, kBlockSize> kickL_{};
    std::array<float, kBlockSize> kickR_{};
    std::array<float, kBlockSize> noiseL_{};
    std::array<float, kBlockSize> noiseR_{};
    std::array<float, kBlockSize> reverbL_{};
    std::array<float, kBlockSize> reverbR_{};
    std::array<float, kBlockSize> tempL_{};
    std::array<float, kBlockSize> tempR_{};

    void recalcSamplesPerBeat();
};
