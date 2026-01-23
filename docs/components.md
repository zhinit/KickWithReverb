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
- `ControlStrip` - Transport controls
- `SoundUnit` - Sound layer controls
- `MasterStrip` - Master output controls

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
