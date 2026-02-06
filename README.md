# KickWithReverb

A web-based DAW (Digital Audio Workstation) for creating and processing kick drum sounds with reverb effects.
[kick-with-reverb.vercel.app](https://kick-with-reverb.vercel.app)

<img width="528" height="857" alt="Screenshot 2026-01-16 at 11 44 15 PM" src="https://github.com/user-attachments/assets/d95ed697-beac-47af-b6cf-c14df50fd4f2" />

## Features

- **Kick Layer** – Sample selection, length control, distortion, and OTT (multiband compression)
- **Noise Layer** – Sample selection with low/high pass filters and volume
- **Reverb Layer** – Impulse response selection with filtering and volume
- **Master Chain** – OTT, distortion, and limiter controls
- **Transport Controls** – BPM adjustment, play/stop, and cue functionality
- **Authentication** – Sign up, login, JWT-based sessions, continue as guest
- **Presets** – Save, load, and delete your own presets; browse shared presets

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

## Deployment

| Role     | Deployed |
| -------- | -------- |
| Frontend | Vercel   |
| Backend  | Railway  |
| Database | Supabase |

## Project Structure

```
KickWithReverb/
├── django/          # Backend API
│   ├── config/      # Django settings, URLs
│   ├── users/
│   ├── presets/
│   └── manage.py
├── react/           # Frontend
│   ├── public/
│   │   ├── audio-engine.js   # WASM engine (built from dsp/)
│   │   └── dsp-processor.js  # AudioWorklet bridge
│   └── src/
│       ├── components/
│       │   ├── Daw
│       │   ├── PresetsBar
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
│       │   └── usePresets
│       ├── types/
│       ├── utils/   # api.ts, audioAssets.ts
│       └── assets/ # Kicks, Noises, IRs, knobs, buttons
├── dsp/             # C++ JUCE audio engine (Emscripten → WASM)
└── docs/
```

Have fun!
