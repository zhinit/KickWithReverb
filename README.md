# KickWithReverb

Fully featured DAW for the average techno producer.

[kick-with-reverb.vercel.app](https://kick-with-reverb.vercel.app)

<img width="519" height="937" alt="Screenshot 2026-02-26 at 10 41 10 AM" src="https://github.com/user-attachments/assets/87d61ac7-746b-4e2c-991d-9f9675d52576" />

## Features

- **Kick Layer** – Sample selection, length control, distortion, and OTT (multiband compression)
- **Noise Layer** – Sample selection with low/high pass filters and volume
- **Reverb Layer** – Impulse response selection with filtering and volume
- **Master Chain** – OTT, distortion, and limiter controls
- **Transport Controls** – BPM adjustment, play/stop, and cue functionality
- **Authentication** – Sign up, login, JWT-based sessions, guest mode
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
├── backend/         # Backend API
│   ├── config/      # Django settings, URLs
│   ├── users/
│   ├── presets/
│   ├── kickgen/     # AI kick generation (generate, list, delete + rate limits)
│   └── manage.py
├── frontend/        # Frontend
│   ├── public/
│   │   ├── audio-engine.js   # WASM engine (built from dsp/)
│   │   └── dsp-processor.js  # AudioWorklet bridge
│   └── src/
│       ├── components/
│       │   ├── Daw
│       │   ├── PresetsBar
│       │   ├── KickGenBar    # AI kick mode (generate, browse, delete)
│       │   ├── ControlStrip  # BPM, play, cue
│       │   ├── LayerStrip    # Kick, Noise, Reverb layers
│       │   ├── MasterStrip
│       │   ├── Knob
│       │   ├── Selectah
│       │   ├── LoginForm, RegisterForm
│       │   └── Logout
│       ├── hooks/
│       │   ├── use-audio-engine  # AudioContext, WASM, sample loading
│       │   ├── use-auth
│       │   ├── use-kick-layer, use-noise-layer, use-reverb-layer
│       │   ├── use-master-chain, use-transport
│       │   ├── use-presets
│       │   └── use-ai-kicks     # AI kick lifecycle (fetch, generate, delete)
│       ├── types/    # types.ts, preset.ts, gen-kick.ts
│       ├── utils/    # api.ts, audio-assets.ts
│       └── assets/ # Kicks, Noises, IRs, knobs, buttons
├── dsp/             # C++ JUCE audio engine (Emscripten → WASM)
├── kick_gen_worker/ # Serverless GPU worker (kick_worker.py)
└── docs/
```

Have fun!
