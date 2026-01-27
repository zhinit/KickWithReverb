# Frontend Structure

## Overview

The frontend is a React 19 application built with TypeScript and Vite. It provides a web-based DAW (Digital Audio Workstation) interface for creating kick drum sounds with reverb.

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite 7** - Build tool and dev server
- **Tone.js** - Web Audio library for sound synthesis

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
├── public/                   # Public static files
├── package.json
├── tsconfig.json
├── vite.config.ts
└── eslint.config.js
```

## Key Directories

### `/src/hooks/`

Custom hooks that encapsulate audio logic and state management:

- `useAuth.tsx` - Authentication context and auth state management
- `useKickLayer.ts` - Kick drum synthesis layer
- `useNoiseLayer.ts` - Noise generator layer
- `useReverbLayer.ts` - Reverb effect processing
- `useMasterChain.ts` - Master output chain with effects
- `useTransport.ts` - Playback transport controls (play, cue, BPM)
- `usePresets.ts` - Preset management (load, save, delete, navigate)

Each audio layer hook exposes:
- `setters` - Functions to update layer parameters programmatically
- `getState` - Function to retrieve current layer state for saving presets
- `releaseAll` - Function to stop all playing sounds (kick and noise layers)

### `/src/types/`

TypeScript interfaces for component props:

- `types.ts` - Defines `KnobProps`, `SelectahProps`, `ControlStripProps`, `LayerStripProps`, `SoundUnitProps`, `MasterStripProps`
- `preset.ts` - Defines `PresetData` interface for preset state (all layer parameters, BPM, timestamps)

### `/src/utils/`

- `api.ts` - API functions for authentication and presets. Uses `VITE_API_URL` env var for backend URL.
  - Authentication: `loginUser`, `registerUser`
  - Presets: `getPresets`, `createPreset`, `updatePreset`, `deletePreset`
  - Includes `authenticatedFetch` helper with automatic token refresh on 401 responses
- `audioAssets.ts` - Audio file imports/exports

### `/src/assets/`

Static assets including:

- `/kicks/` - Kick drum samples (WAV files)
- `/knobs/` - Knob images
- `/buttons/` - Transport button images

## Authentication Flow

The app uses JWT-based authentication:

1. `AuthProvider` wraps the app and provides auth context
2. Unauthenticated users see login/register buttons above the DAW
3. Authenticated users see the DAW with a logout button
4. Tokens are stored in `localStorage`

## Audio Architecture

The audio signal flow is managed through hooks:

```
              ┌──────────────────────────────┐
              │                              ▼
Kick Layer  ──┼──► Reverb Layer ──────► Master Chain ──► Output
              │          ▲                   ▲
Noise Layer ──┼──────────┘                   │
              │                              │
              └──────────────────────────────┘
```

Each layer hook returns:

- `output` - Tone.js audio node for routing
- `trigger` - Function to trigger the sound
- `uiProps` - Props for the UI component

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
