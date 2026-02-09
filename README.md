# KickWithReverb

A web-based DAW (Digital Audio Workstation) for creating and processing kick drum sounds with reverb effects.
[kick-with-reverb.vercel.app](https://kick-with-reverb.vercel.app)

<img width="490" height="814" alt="Screenshot 2026-02-09 at 10 09 04 AM" src="https://github.com/user-attachments/assets/ae88eae8-5f13-4533-8c14-348c0a267508" />

## Features

- **Kick Layer** – Sample selection, length control, distortion, and OTT (multiband compression)
- **Noise Layer** – Sample selection with low/high pass filters and volume
- **Reverb Layer** – Impulse response selection with filtering and volume
- **Master Chain** – OTT, distortion, and limiter controls
- **Transport Controls** – BPM adjustment, play/stop, and cue functionality
- **Authentication** – Sign up, login, JWT-based sessions, continue as guest
- **Presets** – Save, load, and delete your own presets; browse shared presets
- **AI Kick Generation** – Generate unique kick drums using a PyTorch diffusion model on a Modal serverless GPU. Per-user library with rate limits (10/day, 30 total). Kicks stored in Supabase Storage.

## Documentation

- **backend.md** – Backend API, auth, presets model, DB, deployment
- **frontend.md** – React app, hooks, audio routing (WASM), env vars
- **components.md** – Component hierarchy and roles
- **connections.md** – Env vars, CORS, local vs production
- **dsp.md** – C++ JUCE audio engine (WASM), build, signal flow, API

## Tech Stack

**Frontend**

- React 19
- TypeScript
- Vite 7
- JUCE/WASM – C++ audio engine compiled with Emscripten

**Backend**

- Django 5.2
- Django REST Framework
- Simple JWT
- PostgreSQL (Supabase)
- Gunicorn
- Modal – Serverless GPU compute (T4) for AI kick generation
- Supabase Storage – Generated WAV file hosting

## Deployment

| Role       | Deployed |
| ---------- | -------- |
| Frontend   | Vercel   |
| Backend    | Railway  |
| Database   | Supabase |
| Storage    | Supabase |
| AI Compute | Modal    |

## Project Structure

```
KickWithReverb/
├── django/          # Backend API
│   ├── config/      # Django settings, URLs
│   ├── users/
│   ├── presets/
│   ├── kickgen/     # AI kick generation (generate, list, delete + rate limits)
│   └── manage.py
├── react/           # Frontend
│   ├── public/
│   │   ├── audio-engine.js   # WASM engine (built from dsp/)
│   │   └── dsp-processor.js  # AudioWorklet bridge
│   └── src/
│       ├── components/
│       │   ├── Daw
│       │   ├── PresetsBar
│       │   ├── KickGenBar    # AI kick mode (generate, browse, delete)
│       │   ├── ControlStrip  # BPM, play, cue
│       │   ├── SoundUnit    # useKickLayer, useNoiseLayer, useReverbLayer
│       │   ├── MasterStrip
│       │   ├── LayerStrip
│       │   ├── Knob
│       │   ├── Selectah
│       │   ├── WelcomeScreen
│       │   ├── LoginForm, RegisterForm
│       │   └── Logout
│       ├── hooks/
│       │   ├── useAudioEngine  # AudioContext, WASM, sample loading
│       │   ├── useAuth
│       │   ├── useKickLayer, useNoiseLayer, useReverbLayer
│       │   ├── useMasterChain, useTransport
│       │   ├── usePresets
│       │   └── useAiKicks     # AI kick lifecycle (fetch, generate, delete)
│       ├── types/    # types.ts, preset.ts, genKick.ts
│       ├── utils/    # api.ts, audioAssets.ts
│       └── assets/ # Kicks, Noises, IRs, knobs, buttons
├── dsp/             # C++ JUCE audio engine (Emscripten → WASM)
├── modal/           # Serverless GPU worker (kick_worker.py)
└── docs/
```

Have fun!
