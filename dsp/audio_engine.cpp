#include "sample_player.h"
#include <emscripten/bind.h>
#include <cstring>

class AudioEngine
{
public:
    AudioEngine() = default;

    void prepare(float sampleRate)
    {
        sampleRate_ = sampleRate;
        kickPlayer_.setSampleRate(sampleRate);
        noisePlayer_.setSampleRate(sampleRate);
    }

    void process(uintptr_t leftPtr, uintptr_t rightPtr, int numSamples)
    {
        float* left = reinterpret_cast<float*>(leftPtr);
        float* right = reinterpret_cast<float*>(rightPtr);

        // Kick player
        kickPlayer_.process(left, right, numSamples);

        // TODO: noise, effects, reverb, master chain (Steps 3-4)
    }

    // Kick sample management
    void loadKickSample(uintptr_t ptr, size_t length) { kickPlayer_.loadSample(ptr, length); }
    void selectKickSample(int index) { kickPlayer_.selectSample(index); }
    void setKickRelease(float seconds) { kickPlayer_.setReleaseDuration(seconds); }

    // Noise sample management
    void loadNoiseSample(uintptr_t ptr, size_t length) { noisePlayer_.loadSample(ptr, length); }
    void selectNoiseSample(int index) { noisePlayer_.selectSample(index); }
    void setNoiseVolume(float gainLinear) { noisePlayer_.setVolume(gainLinear); }

    // Transport
    void cue() { kickPlayer_.trigger(); }

private:
    float sampleRate_ = 44100.0f;
    SamplePlayer kickPlayer_;
    SamplePlayer noisePlayer_;
};

EMSCRIPTEN_BINDINGS(audio_module)
{
    emscripten::class_<AudioEngine>("AudioEngine")
        .constructor()
        .function("prepare", &AudioEngine::prepare)
        .function("process", &AudioEngine::process)
        .function("loadKickSample", &AudioEngine::loadKickSample)
        .function("selectKickSample", &AudioEngine::selectKickSample)
        .function("setKickRelease", &AudioEngine::setKickRelease)
        .function("loadNoiseSample", &AudioEngine::loadNoiseSample)
        .function("selectNoiseSample", &AudioEngine::selectNoiseSample)
        .function("setNoiseVolume", &AudioEngine::setNoiseVolume)
        .function("cue", &AudioEngine::cue);
}
