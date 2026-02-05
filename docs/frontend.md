# Frontend Structure

## Overview

The frontend is a React 19 application built with TypeScript and Vite. It provides a web-based DAW (Digital Audio Workstation) interface for creating kick drum sounds with reverb.

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite 7** - Build tool and dev server
- **JUCE/WASM** - C++ audio engine compiled to WebAssembly via Emscripten

## Project Structure

```
react/
├── src/
│   ├── main.tsx              # App entry point
│   ├── App.tsx               # Root component with auth routing
│   ├── App.css               # Global styles
│   ├── index.css             # Base styles
│   ├── components/           # UI components
│   ├── hooks/                # Custom React hooks
│   ├── types/                # TypeScript type definitions
│   ├── utils/                # Utility functions
│   └── assets/               # Static assets (images, audio)
├── public/
│   ├── audio-engine.js       # WASM engine (built from dsp/)
│   └── dsp-processor.js      # AudioWorklet processor (bridges React ↔ WASM)
├── package.json
├── tsconfig.json
├── vite.config.ts
└── eslint.config.js
```

## Key Directories

### `/src/hooks/`

Custom hooks that encapsulate audio logic and state management:

- `useAudioEngine.ts` - Central hook: creates AudioContext, loads AudioWorklet + WASM, decodes and loads all samples/IRs upfront, provides `postMessage` and `resume` for child hooks
- `useAuth.tsx` - Authentication context and auth state management
- `useKickLayer.ts` - Kick drum layer (React state + postMessage to WASM)
- `useNoiseLayer.ts` - Noise generator layer (React state + postMessage to WASM)
- `useReverbLayer.ts` - Reverb effect layer (React state + postMessage to WASM)
- `useMasterChain.ts` - Master output chain (React state + postMessage to WASM)
- `useTransport.ts` - Playback transport controls (play, cue, BPM via postMessage)
- `usePresets.ts` - Preset management (load, save, delete, navigate)

Each audio layer hook:
- Takes an `AudioEngine` handle (from `useAudioEngine`) as its parameter
- Keeps React state for UI display
- Sends `postMessage` to the AudioWorklet when state changes
- Guards postMessage calls with `isReady` check (messages sent once WASM is initialized)
- Exposes `setters` and `getState` for preset loading/saving

### `/src/types/`

TypeScript interfaces for component props:

- `types.ts` - Defines `KnobProps`, `SelectahProps`, `ControlStripProps`, `LayerStripProps`, `SoundUnitProps`, `MasterStripProps`
- `preset.ts` - Defines `PresetData` interface for preset state (all layer parameters, BPM, timestamps)

### `/src/utils/`

- `api.ts` - API functions for authentication and presets. Uses `VITE_API_URL` env var for backend URL.
  - Authentication: `loginUser`, `registerUser`
  - Presets: `getPresets`, `createPreset`, `updatePreset`, `deletePreset`
  - Includes `authenticatedFetch` helper with automatic token refresh on 401 responses
- `audioAssets.ts` - Audio file imports/exports and knob range mapping utilities

### `/src/assets/`

Static assets including:

- `/kicks/` - Kick drum samples (WAV files)
- `/noises/` - Noise samples (MP3 files)
- `/IRs/` - Impulse response files (WAV files, may be stereo)
- `/knobs/` - Knob images
- `/buttons/` - Transport button images

## Authentication Flow

The app uses JWT-based authentication:

1. `AuthProvider` wraps the app and provides auth context
2. Unauthenticated users see login/register buttons above the DAW
3. Authenticated users see the DAW with a logout button
4. Tokens are stored in `localStorage`

## Audio Architecture

All audio routing and DSP is handled inside the C++ WASM engine. The React hooks only manage UI state and send parameter messages to the AudioWorklet.

```
React Hooks ──postMessage──► AudioWorklet (dsp-processor.js) ──► WASM AudioEngine (C++)
                                                                       │
                                                                  AudioContext.destination
```

### Initialization Flow (in `useAudioEngine`)

1. Create `AudioContext` (starts suspended)
2. Fetch `audio-engine.js` (Emscripten glue code)
3. Load `dsp-processor.js` as AudioWorklet
4. Create `AudioWorkletNode`, connect to destination
5. Send glue code to worklet → worklet instantiates WASM → sends "ready"
6. Decode all kick/noise/IR audio files → send as Float32Array to worklet
7. Set `isReady = true` → all hooks sync their current state to the engine

### Hook → Engine Message Flow

Each hook watches its React state and sends typed messages:
- `useKickLayer` → `selectKickSample`, `kickRelease`, `kickDistortion`, `kickOTT`
- `useNoiseLayer` → `selectNoiseSample`, `noiseVolume`, `noiseLowPass`, `noiseHighPass`
- `useReverbLayer` → `selectIR`, `reverbLowPass`, `reverbHighPass`, `reverbVolume`
- `useMasterChain` → `masterOTT`, `masterDistortion`, `masterLimiter`
- `useTransport` → `bpm`, `loop`, `cue`

## Environment Variables

- `VITE_API_URL` - Backend API URL (defaults to `http://localhost:8000` for local dev)

## Scripts

- `npm run dev` - Start dev server (port 5173)
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Production Deployment

Deployed on **Vercel**.

- **URL**: `https://kick-with-reverb.vercel.app`
- **Environment variable**: `VITE_API_URL=https://kickwithreverb-production.up.railway.app`

Vercel auto-deploys from the `main` branch. After adding/changing environment variables, a manual redeploy is required.
