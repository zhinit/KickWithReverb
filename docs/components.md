# Component Hierarchy

## Overview

```
App
├── AuthProvider (context wrapper)
│   └── AppContent
│       ├── [Unauthenticated]
│       │   ├── LoginRegister
│       │   ├── LoginForm
│       │   ├── RegisterForm
│       │   └── Daw
│       └── [Authenticated]
│           ├── Daw
│           └── Logout
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

Handles routing based on auth state:

- Not authenticated: Shows login/register options + DAW
- Authenticated: Shows DAW + logout button

### Daw (`Daw.tsx`)

Main DAW interface. Initializes all audio layer hooks and connects the audio routing. Contains:

- Title and description
- `PresetsBar` - Preset management controls (authenticated users only)
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

### LoginRegister (`LoginRegister.tsx`)

Two buttons displayed when not authenticated:

- "Log In" - Navigates to login form
- "Sign Up" - Navigates to register form

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

Simple logout button that clears auth tokens and resets auth state.
