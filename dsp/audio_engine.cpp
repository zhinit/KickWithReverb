#include <emscripten/bind.h>

class AudioEngine
{
public:
    AudioEngine() = default;

    void prepare(float sampleRate)
    {
        sampleRate_ = sampleRate;
    }

    void process(uintptr_t leftPtr, uintptr_t rightPtr, int numSamples)
    {
        float* left = reinterpret_cast<float*>(leftPtr);
        float* right = reinterpret_cast<float*>(rightPtr);

        // Minimal stub: output silence
        for (int i = 0; i < numSamples; ++i) {
            left[i] = 0.0f;
            right[i] = 0.0f;
        }
    }

private:
    float sampleRate_ = 44100.0f;
};

EMSCRIPTEN_BINDINGS(audio_module)
{
    emscripten::class_<AudioEngine>("AudioEngine")
        .constructor()
        .function("prepare", &AudioEngine::prepare)
        .function("process", &AudioEngine::process);
}
