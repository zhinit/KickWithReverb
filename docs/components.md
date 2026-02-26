# Component Hierarchy

## Overview

```
App
├── AuthProvider (context wrapper)
│   └── AppContent
│       ├── [authForm open]
│       │   ├── LoginForm
│       │   └── RegisterForm
│       ├── [guest, no auth form]
│       │   ├── Login/Sign Up Buttons (above Daw)
│       │   ├── "LOGIN FOR AI KICK GEN AND SAVING PRESETS" message
│       │   └── Daw
│       └── [member]
│           ├── Daw
│           └── Logout (below Daw)
│       (Daw hidden when auth form is open, otherwise always mounted)
```

```
Daw (mode: "daw" | "kickGen")
├── LoadingOverlay (shown until engine ready + presets loaded)
├── [daw mode] PresetsBar
│   ├── Navigation Buttons (prev/next)
│   ├── Preset Dropdown
│   ├── Delete Button
│   ├── Save Button
│   ├── Save Modal
│   └── Delete Confirmation Modal
├── [kickGen mode] KickGenBar
│   ├── Navigation Buttons (prev/next)
│   ├── AI Kick Dropdown
│   ├── Delete Button
│   ├── Generate Button (🎨)
│   └── Delete Confirmation Modal (preset conflict)
├── ControlStrip
│   ├── Cue Button (img)
│   ├── Play Button (img)
│   └── BPM Input
├── LayerStrip (Kick)
│   ├── Selectah (daw mode: stock + AI kicks) OR "Back To DAW" button (kickGen mode)
│   └── Knob (multiple)
├── LayerStrip (Noise)
│   ├── Selectah
│   └── Knob (multiple)
├── LayerStrip (Reverb)
│   ├── Selectah
│   └── Knob (multiple)
├── MasterStrip
│   └── Knob (multiple)
└── [daw mode, member only] "Generate AI Kick From The Ether" Button
```

## File Organization

Components are organized into three subfolders:

- **`auth/`** — Auth-flow views: LoginForm, RegisterForm, Logout
- **`daw/`** — DAW interface: Daw, ControlStrip, LayerStrip, MasterStrip, PresetsBar, KickGenBar, LoadingOverlay
- **`ui/`** — Reusable primitives: Knob, Selectah, modal.css

Each component has a co-located CSS file (e.g. `daw/knob.css` next to `daw/Knob.tsx`). Shared styles like `modal.css` live in `ui/` and are imported where needed.

## Components

### App (`App.tsx`)

Root component that wraps the app in `AuthProvider` and renders `AppContent`.

### AppContent (`App.tsx`)

Manages `authForm` state (`"none" | "login" | "register"`) and renders based on `userStatus`:

- `"guest"` (no auth form): Shows Login/Sign Up buttons and message above the DAW
- `"guest"` (auth form open): Shows LoginForm or RegisterForm (DAW hidden)
- `"member"`: Shows DAW with presets + logout button below

On successful login (`userStatus` becomes `"member"`), the auth form auto-closes via a `useEffect`. The DAW is hidden while auth forms are open but stays mounted for eager audio loading.

### Daw (`daw/Daw.tsx`)

Main DAW interface. Initializes all audio layer hooks and connects the audio routing. Manages `mode` state (`"daw" | "kickGen"`), `selectedAiKickId` state, and `showOverlay` state. On `userStatus` change, resets mode, stops transport playback, and re-shows the loading overlay to cover the preset fetch transition. Contains:

- Title (switches between "KICK WITH REVERB" and "AI KICK GEN MODE")
- `PresetsBar` (daw mode) or `KickGenBar` (kickGen mode)
- `ControlStrip` - Transport controls
- Three `LayerStrip` components (Kick, Noise, Reverb) inside a `div.sound-unit` wrapper — kick Selectah replaced with "Back To DAW" button in kickGen mode via `customDropdown` prop
- `MasterStrip` - Master output controls
- "Generate AI Kick From The Ether" button (daw mode, members only) — enters kickGen mode

Hooks initialized: `useAudioEngine`, `useAiKicks`, `useKickLayer` (with AI kick map), `useNoiseLayer`, `useReverbLayer`, `useMasterChain`, `useTransport`, `usePresets`.

The Daw component wires up the `usePresets` hook by passing layer setters and getters from all audio hooks, enabling presets to save and restore the complete DAW state. AI kick selection (`selectAiKick`, `handleGenerate`) goes through `kick.setters.setSample()` to keep `useKickLayer` state, the Selectah, and WASM in sync.

### ControlStrip (`daw/ControlStrip.tsx`)

Transport controls for playback:

- Cue button (triggers sounds while held)
- Play button (toggles loop playback)
- BPM input (60-365 range)

### LayerStrip (`daw/LayerStrip.tsx`)

Generic layer control strip containing:

- Layer label
- `Selectah` dropdown (for sample/preset selection), or `customDropdown` if provided (used for "Back To DAW" button in kickGen mode)
- Multiple `Knob` components (for parameters)

### MasterStrip (`daw/MasterStrip.tsx`)

Master output controls section with multiple `Knob` components for master chain parameters.

### Knob (`ui/Knob.tsx`)

Rotary knob control with drag interaction:

- Drag up/down to change value (0-100)
- Visual rotation from -135 to +135 degrees
- Displays label above knob

### Selectah (`ui/Selectah.tsx`)

Dropdown select component for choosing samples or presets.

### PresetsBar (`daw/PresetsBar.tsx`)

Preset management bar displayed at the top of the DAW. Features:

- Previous/Next buttons to navigate through presets
- Dropdown to select a preset by name
- Delete button (disabled for shared presets)
- Save button opens a modal to name the preset

When not authenticated, displays "Login for AI kick generation and presets".

Includes two modals:
- **Save Modal** - Form to enter preset name with validation (alphanumeric, max 32 chars)
- **Delete Confirmation Modal** - Confirms before deleting a user preset

### KickGenBar (`daw/KickGenBar.tsx`)

AI kick management bar, replaces PresetsBar when in kickGen mode. Same visual layout (⇇ ⇉ [dropdown] 🗑️ 🎨). Features:

- Previous/Next buttons to cycle through AI kicks (wraps around)
- Dropdown listing all user's AI kicks alphabetically
- Delete button — calls `DELETE /api/kicks/<id>/`. If presets reference the kick, shows confirmation modal with affected preset names. After delete, selects the next kick in the list.
- Generate button (🎨) — calls `POST /api/kicks/generate/`, shows "..." while generating (~10s). On success, new kick is selected. Shows rate limit messages (daily limit, total cap 30).

Props come from `useAiKicks` hook via Daw.tsx.

### LoadingOverlay (`daw/LoadingOverlay.tsx`)

Full-viewport loading screen shown inside Daw while audio assets and presets are loading. Features:

- Animated kick waveform SVG (scrolling transient, dark theme — from `assets/svgs/kick-wav.svg` adapted inline)
- "Loading..." text label
- Fixed positioning covers entire viewport (`z-index: 1000`)
- Accepts `isReady` prop — when true, triggers a 400ms opacity fade-out
- `onFaded` callback fires after transition ends to unmount the overlay
- Re-shown on login/guest entry to cover the preset fetch transition

### LoginForm (`auth/LoginForm.tsx`)

Login form with:

- Username input
- Password input
- Submit button
- Back button

### RegisterForm (`auth/RegisterForm.tsx`)

Registration form with:

- Username input
- Email input
- Password input
- Submit button
- Back button

### Logout (`auth/Logout.tsx`)

Simple logout button that clears auth tokens and resets `userStatus` to `"guest"`.
