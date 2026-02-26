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
frontend/
├── src/
│   ├── main.tsx              # App entry point
│   ├── App.tsx               # Root component with auth routing
│   ├── App.css               # App-level styles (layout, form, guest auth)
│   ├── index.css             # Base resets and variables
│   ├── components/
│   │   ├── auth/             # Auth-flow components (LoginForm, RegisterForm, Logout)
│   │   ├── daw/              # DAW components (Daw, ControlStrip, LayerStrip, MasterStrip, PresetsBar, KickGenBar, LoadingOverlay)
│   │   └── ui/               # Reusable primitives (Knob, Selectah, modal.css)
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

- `use-audio-engine.ts` - Central hook: creates AudioContext, loads AudioWorklet + WASM, decodes and loads all samples/IRs upfront, provides `postMessage` and `resume` for child hooks. Also exposes `loadKickSample(url)` for dynamically loading AI kick audio into WASM at runtime (returns the WASM index).
- `use-auth.tsx` - Authentication context with `UserStatus` (`"guest" | "member"`), provides `login`, `register`, `logout`
- `use-kick-layer.ts` - Kick drum layer (React state + postMessage to WASM). Accepts optional `aiKickNameToIndex` map to merge AI kicks into the dropdown and index lookup.
- `use-noise-layer.ts` - Noise generator layer (React state + postMessage to WASM)
- `use-reverb-layer.ts` - Reverb effect layer (React state + postMessage to WASM)
- `use-master-chain.ts` - Master output chain (React state + postMessage to WASM)
- `use-transport.ts` - Playback transport controls (play, cue, BPM via postMessage). Exposes a `stop()` function that stops loop playback (used by Daw on logout).
- `use-presets.ts` - Preset management (load, save, delete, navigate). Defines `INIT_DEFAULTS` constant matching hook initial values. Uses a stable `applyValues` helper (via `useRef` for layers) to apply preset values to all layers. On member login, fetches presets and loads the shared "Init" preset values. On logout (member → guest transition, detected via `prevStatusRef`), resets the DAW to `INIT_DEFAULTS`. `loadPreset` also uses `applyValues` internally.
- `use-ai-kicks.ts` - AI kick generation management. On startup (if member), fetches user's AI kicks from `GET /api/kicks/`, decodes audio from Supabase URLs, loads into WASM via `loadKickSample`. Exposes `generate()` and `remove()` functions that handle the full flow (API call + WASM loading + state update). Tracks `aiKicks`, `aiKickNameToIndex`, `isGenerating`, `remainingGensToday`, `totalGensCount`. Clears all state and resets `hasLoadedRef` on logout (`userStatus !== "member"`) so kicks are re-fetched per user session.

Each audio layer hook:
- Takes an `AudioEngine` handle (from `useAudioEngine`) as its parameter
- Keeps React state for UI display
- Sends `postMessage` to the AudioWorklet when state changes
- Guards postMessage calls with `isReady` check (messages sent once WASM is initialized)
- Exposes `setters` and `getState` for preset loading/saving

### `/src/types/`

TypeScript interfaces for component props:

- `types.ts` - Defines `KnobProps`, `SelectahProps`, `ControlStripProps`, `LayerStripProps` (includes optional `customDropdown` for replacing Selectah), `MasterStripProps`
- `preset.ts` - Defines `PresetData` interface for preset state (all layer parameters, BPM, timestamps)
- `gen-kick.ts` - Defines `KickData` (id, name, audioUrl), `KickListResponse` (kicks + counts), `GenerateKickResponse` (single kick + counts)

### `/src/utils/`

- `api.ts` - API functions for authentication, presets, and AI kicks. Uses `VITE_API_URL` env var for backend URL.
  - Authentication: `loginUser`, `registerUser`
  - Presets: `getPresets`, `createPreset`, `updatePreset`, `deletePreset`
  - AI Kicks: `getKicks`, `generateKick`, `deleteKick(id, confirm?)`
  - Includes `authenticatedFetch` helper with automatic token refresh on 401 responses
- `audio-assets.ts` - Audio file imports/exports and knob range mapping utilities:
  - Linear mapping: `mapKnobRangeToCustomRange`, `mapCustomRangeToKnobRange`
  - Log scale (for filter frequencies): `mapKnobToFrequency`, `mapFrequencyToKnob`
  - Power curve (for kick length, where 50% knob = 25% range): `mapKnobToLengthRatio`, `mapLengthRatioToKnob`

### `/src/assets/`

Static assets including:

- `/kicks/` - Kick drum samples (WAV files)
- `/noises/` - Noise samples (MP3 files)
- `/IRs/` - Impulse response files (WAV files, may be stereo)
- `/knobs/` - Knob images
- `/buttons/` - Transport button images

## Authentication Flow

The app uses JWT-based authentication with a two-state user status model:

- **`"guest"`** - Default state (no token). Sees Login/Sign Up buttons above the DAW. Limited features (no presets, no AI kick gen).
- **`"member"`** - Logged in or registered. Sees the DAW with presets, AI kick gen, and logout button below.

1. `AuthProvider` wraps the app and provides auth context (`userStatus`, `login`, `register`, `logout`)
2. On mount, if tokens exist in `localStorage`, status initializes to `"member"`; otherwise `"guest"`
3. The app loads directly into the DAW with the loading overlay — no welcome screen gate
4. Guest users can click Login/Sign Up buttons above the DAW, which shows the auth form (DAW hidden while form is open)
5. On successful login, the auth form auto-closes and the DAW appears as member
6. Logging out resets status to `"guest"`, returning to guest mode with presets reset

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
- `useKickLayer` → `selectKickSample`, `kickLength`, `kickDistortion`, `kickOTT`
- `useNoiseLayer` → `selectNoiseSample`, `noiseVolume`, `noiseLowPass`, `noiseHighPass`
- `useReverbLayer` → `selectIR`, `reverbLowPass`, `reverbHighPass`, `reverbVolume`
- `useMasterChain` → `masterOTT`, `masterDistortion`, `masterLimiter`
- `useTransport` → `bpm`, `loop`, `cue`

## AI Kick Gen Mode

The Daw has two modes controlled by `mode` state (`"daw" | "kickGen"`):

**DAW mode (default):**
- PresetsBar shown at top
- Kick Selectah shows stock kicks + AI kicks (AI kicks appended alphabetically, prefixed with "AI: ")
- "Generate AI Kick" button shown below MasterStrip (members only)

**KickGen mode:**
- KickGenBar replaces PresetsBar (same layout: ⇇ ⇉ [dropdown] 🗑️ 🎨)
- Title changes to "AI KICK GEN MODE"
- Kick Selectah replaced with "Back To DAW" button
- All knob/noise/reverb/master settings remain untouched during mode switches

**Mode transitions:**
- Entering kickGen: loads first AI kick alphabetically into sampler (if any exist) via `kick.setters.setSample()`
- Exiting kickGen: kick stays in sampler, Selectah shows the AI kick name (stays in sync because selection goes through `useKickLayer`)
- On `userStatus` change (logout/login): mode resets to `"daw"`, `selectedAiKickId` resets to `null`

**Kick selection sync:**
- `selectAiKick` and `handleGenerate` in Daw.tsx use `kick.setters.setSample(name)` (not direct `engine.postMessage`), which keeps `useKickLayer`'s `sample` state, the Selectah dropdown, and WASM all in sync.
- After generating, Daw's `handleGenerate` wrapper selects the new kick (KickGenBar does not call `onSelectKick` after generate).

**KickGenBar features:**
- Prev/next arrows to cycle through AI kicks
- Dropdown listing all AI kicks
- 🎨 button generates a new kick (calls Modal GPU worker, ~10s). Shows "..." while generating. New kick auto-selected in sampler.
- 🗑️ button deletes selected kick. If presets reference the kick, shows confirmation modal listing affected presets
- Rate limit warnings when remaining daily gens <= 3
- Total cap message at 30/30

**Rate limits:** 10 generations per day (midnight EST reset), 30 total kicks max.

**Session reset:**
- Since the Daw component stays mounted across login/logout (for eager audio loading), all state must be explicitly reset on user change.
- `usePresets` resets DAW to Init defaults on logout (member → guest, detected via `prevStatusRef`), loads Init preset on member login.
- `useAiKicks` clears AI kick state and resets `hasLoadedRef` on logout so kicks are re-fetched per user.
- Daw resets `mode`, `selectedAiKickId`, and stops transport playback on `userStatus` change.
- Daw re-shows the loading overlay on any `userStatus` change (covers preset fetch transition).

**Loading screen:**
- `LoadingOverlay` component renders a full-viewport overlay with an animated kick waveform SVG and "Loading..." text.
- Shown inside Daw whenever audio engine hasn't finished loading OR presets are still being fetched (`engine.isReady && !presets.isLoading`).
- On `userStatus` change (login/guest), the overlay re-appears to cover the preset fetch.
- Fades out over 400ms once all loading completes. A `setTimeout` fallback handles the case where the Daw is hidden (`display: none`) and `onTransitionEnd` doesn't fire.

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
