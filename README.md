# KickWithReverb

A web-based DAW (Digital Audio Workstation) for creating and processing kick drum sounds with reverb effects.

<img width="528" height="857" alt="Screenshot 2026-01-16 at 11 44 15 PM" src="https://github.com/user-attachments/assets/d95ed697-beac-47af-b6cf-c14df50fd4f2" />

## Features

- **Kick Layer** – Sample selection, length control, distortion, and OTT (multiband compression)
- **Noise Layer** – Sample selection with low/high pass filters and volume
- **Reverb Layer** – Impulse response selection with filtering and volume
- **Master Chain** – OTT, distortion, and limiter controls
- **Transport Controls** – BPM adjustment, play/stop, and cue functionality
- **Authentication** – Sign up, login, and JWT-based sessions
- **Presets** – Save, load, and delete your own presets; browse shared presets

## Documentation

- **backend.md** – Backend API, auth user model, presets model, DB
- **frontend.md** – React app, Frontend API, hooks, audio routing
- **components.md** – Component hierarchy and roles
- **connections.md** – Env vars, CORS, local vs production

## Tech Stack

**Frontend**

- React 19
- TypeScript
- Vite 7
- Tone.js

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
├── django/ # Backend API
│   ├── config/ # Django settings, URLs
│   ├── users/
│   ├── presets/
│   └── manage.py
├── react/ # Frontend
│   └── src/
│       ├── components/
│       │   ├── Daw
│       │   ├── PresetsBar
│       │   ├── ControlStrip — controls bpm, play, pause, cur
│       │   ├── SoundUnit — useKickLayer, useNoiseLayer, useReverbLayer
│       │   ├── MasterStrip — controls master
│       │   ├── LayerStrip
│       │   ├── Knob
│       │   ├── Selectah
│       │   ├── LoginForm
│       │   ├── RegisterForm
│       │   ├── LoginRegister
│       │   └── Logout — useAuth
│       ├── hooks/
│       │   ├── useAuth
│       │   ├── useKickLayer
│       │   ├── useNoiseLayer
│       │   ├── useReverbLayer
│       │   ├── useMasterChain
│       │   ├── useTransport
│       │   └── usePresets
│       ├── types/
│       ├── utils/ # api is here
│       └── assets/ # Kicks, Noises, Impulse Responses, UI images
└── docs/
```

Have fun!
