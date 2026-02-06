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
│       │   └── Daw
│       └── [member]
│           ├── Daw
│           └── Logout
│       (Daw is always mounted but hidden for eager loading)
```

```
Daw
├── PresetsBar
│   ├── Navigation Buttons (prev/next)
│   ├── Preset Dropdown
│   ├── Delete Button
│   ├── Save Button
│   ├── Save Modal
│   └── Delete Confirmation Modal
├── ControlStrip
│   ├── Cue Button (img)
│   ├── Play Button (img)
│   └── BPM Input
├── SoundUnit
│   ├── LayerStrip (Kick)
│   │   ├── Selectah
│   │   └── Knob (multiple)
│   ├── LayerStrip (Noise)
│   │   ├── Selectah
│   │   └── Knob (multiple)
│   └── LayerStrip (Reverb)
│       ├── Selectah
│       └── Knob (multiple)
└── MasterStrip
    └── Knob (multiple)
```

## Components

### App (`App.tsx`)

Root component that wraps the app in `AuthProvider` and renders `AppContent`.

### AppContent (`App.tsx`)

Handles view routing based on `userStatus`:

- `"unknown"`: Shows welcome screen (or login/register forms)
- `"guest"`: Shows DAW (no presets, no logout)
- `"member"`: Shows DAW with presets + logout button

The DAW is always mounted but hidden during non-DAW views, so audio samples load eagerly in the background.

### Daw (`Daw.tsx`)

Main DAW interface. Initializes all audio layer hooks and connects the audio routing. Contains:

- Title
- `PresetsBar` - Preset management controls (members only; guests see "Log in to use presets")
- `ControlStrip` - Transport controls
- `SoundUnit` - Sound layer controls
- `MasterStrip` - Master output controls

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
- `Selectah` dropdown (for sample/preset selection)
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

When not authenticated, displays a message prompting users to log in.

Includes two modals:
- **Save Modal** - Form to enter preset name with validation (alphanumeric, max 32 chars)
- **Delete Confirmation Modal** - Confirms before deleting a user preset

### WelcomeScreen (`WelcomeScreen.tsx`)

Landing page displayed when `userStatus` is `"unknown"`. Shows:

- "KICK WITH REVERB" title
- Tagline: "Fully featured fully sophisticated DAW for the modern tik tok techno purist."
- "Welcome to the Loop. What would you like to do?"
- Three buttons: Login, Sign Up, Continue as Guest

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
