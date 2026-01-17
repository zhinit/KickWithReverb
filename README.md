# KickWithReverb

A web-based DAW (Digital Audio Workstation) for creating and processing kick drum sounds with reverb effects.
Have Fun!
<img width="528" height="857" alt="Screenshot 2026-01-16 at 11 44 15 PM" src="https://github.com/user-attachments/assets/d95ed697-beac-47af-b6cf-c14df50fd4f2" />

## Features

- **Kick Layer**: Sample selection, length control, distortion, and OTT (multiband compression)
- **Noise Layer**: Sample selection with low/high pass filters and distortion
- **Reverb Layer**: Impulse response selection with filtering and phaser effects
- **Master Chain**: OTT, distortion, and limiter controls
- **Transport Controls**: BPM adjustment, play/stop, and cue functionality

## Tech Stack

- React
- TypeScript
- Vite
- Tone.js

## Project Structure

- src
  - assets
    - images for UI, kicks, noises, and reverb impulse response files
  - components
    - ControlStrip
      - Controls for cue button, play button, and bpm
    - Daw
      - The Big Kahuna. This is the component where most states are defined and passed into other components
    - Knob
      - Makes the knob work
    - LayerStrip
      - Audio layer component with selectah and knobs
    - MasterStrip
      - Master chain component with knobs
    - Selectah
      - A dropdown
    - SoundUnit
      - Combines the audio layer strips (Kick layer, Noise Layer, Reverb Layer)
  - hooks
    - not yet implemented
  - types
    - interfaces for typescript types
