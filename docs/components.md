# Component Hierarchy

## Overview

```
App
├── AuthProvider (context wrapper)
│   └── AppContent
│       ├── [unknown]
│       │   ├── WelcomeScreen
│       │   ├── LoginForm
│       │   └── RegisterForm
│       ├── [guest]
│       │   ├── Login/Sign Up Buttons (above Daw)
│       │   └── Daw
│       └── [member]
│           ├── Daw
│           └── Logout (below Daw)
│       (Daw is always mounted but hidden for eager loading)
```

```
Daw (mode: "daw" | "kickGen")
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
├── SoundUnit
│   ├── LayerStrip (Kick)
│   │   ├── Selectah (daw mode: stock + AI kicks) OR "Back To DAW" button (kickGen mode)
│   │   └── Knob (multiple)
│   ├── LayerStrip (Noise)
│   │   ├── Selectah
│   │   └── Knob (multiple)
│   └── LayerStrip (Reverb)
│       ├── Selectah
│       └── Knob (multiple)
├── MasterStrip
│   └── Knob (multiple)
└── [daw mode, member only] "Generate AI Kick" Button
```

## Components

### App (`App.tsx`)

Root component that wraps the app in `AuthProvider` and renders `AppContent`.

### AppContent (`App.tsx`)

Handles view routing based on `userStatus`:

- `"unknown"`: Shows welcome screen (or login/register forms)
- `"guest"`: Shows Login/Sign Up buttons above the DAW (no presets)
- `"member"`: Shows DAW with presets + logout button below

The DAW is always mounted but hidden during non-DAW views, so audio samples load eagerly in the background.

### Daw (`Daw.tsx`)

Main DAW interface. Initializes all audio layer hooks and connects the audio routing. Manages `mode` state (`"daw" | "kickGen"`) and `selectedAiKickId` state. Contains:

- Title (switches between "KICK WITH REVERB" and "AI KICK GEN MODE")
- `PresetsBar` (daw mode) or `KickGenBar` (kickGen mode)
- `ControlStrip` - Transport controls
- `SoundUnit` - Sound layer controls (kick Selectah replaced with "Back To DAW" button in kickGen mode via `customDropdown` prop)
- `MasterStrip` - Master output controls
- "Generate AI Kick" button (daw mode, members only) — enters kickGen mode

Hooks initialized: `useAudioEngine`, `useAiKicks`, `useKickLayer` (with AI kick map), `useNoiseLayer`, `useReverbLayer`, `useMasterChain`, `useTransport`, `usePresets`.

The Daw component wires up the `usePresets` hook by passing layer setters and getters from all audio hooks, enabling presets to save and restore the complete DAW state.

### ControlStrip (`ControlStrip.tsx`)

Transport controls for playback:

- Cue button (triggers sounds while held)
- Play button (toggles loop playback)
- BPM input (60-365 range)

### SoundUnit (`SoundUnit.tsx`)

Container for the three sound layer strips:

- Kick layer
- Noise layer
- Reverb layer

Each rendered as a `LayerStrip` component.

### LayerStrip (`LayerStrip.tsx`)

Generic layer control strip containing:

- Layer label
- `Selectah` dropdown (for sample/preset selection), or `customDropdown` if provided (used for "Back To DAW" button in kickGen mode)
- Multiple `Knob` components (for parameters)

### MasterStrip (`MasterStrip.tsx`)

Master output controls section with multiple `Knob` components for master chain parameters.

### Knob (`Knob.tsx`)

Rotary knob control with drag interaction:

- Drag up/down to change value (0-100)
- Visual rotation from -135 to +135 degrees
- Displays label above knob

### Selectah (`Selectah.tsx`)

Dropdown select component for choosing samples or presets.

### PresetsBar (`PresetsBar.tsx`)

Preset management bar displayed at the top of the DAW. Features:

- Previous/Next buttons to navigate through presets
- Dropdown to select a preset by name
- Delete button (disabled for shared presets)
- Save button opens a modal to name the preset

When not authenticated, displays "Login for AI kick generation and presets".

Includes two modals:
- **Save Modal** - Form to enter preset name with validation (alphanumeric, max 32 chars)
- **Delete Confirmation Modal** - Confirms before deleting a user preset

### KickGenBar (`KickGenBar.tsx`)

AI kick management bar, replaces PresetsBar when in kickGen mode. Same visual layout (⇇ ⇉ [dropdown] 🗑️ 🎨). Features:

- Previous/Next buttons to cycle through AI kicks (wraps around)
- Dropdown listing all user's AI kicks alphabetically
- Delete button — calls `DELETE /api/kicks/<id>/`. If presets reference the kick, shows confirmation modal with affected preset names. After delete, selects the next kick in the list.
- Generate button (🎨) — calls `POST /api/kicks/generate/`, shows "..." while generating (~10s). On success, new kick is selected. Shows rate limit messages (daily limit, total cap 30).

Props come from `useAiKicks` hook via Daw.tsx.

### WelcomeScreen (`WelcomeScreen.tsx`)

Landing page displayed when `userStatus` is `"unknown"`. Shows:

- "KICK WITH REVERB" title
- "Welcome to the Loop. What would you like to do?"
- Three buttons stacked vertically: Login, Sign Up, Continue as Guest

### LoginForm (`LoginForm.tsx`)

Login form with:

- Username input
- Password input
- Submit button
- Back button

### RegisterForm (`RegisterForm.tsx`)

Registration form with:

- Username input
- Email input
- Password input
- Submit button
- Back button

### Logout (`Logout.tsx`)

Simple logout button that clears auth tokens and resets `userStatus` to `"unknown"`, returning to the welcome screen.
