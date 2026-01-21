# DAW Component Refactoring Plan

## Problem
`Daw.tsx` is 530 lines with 27 state variables and 19 refs. The component handles:
- Asset loading
- Audio node initialization (~140 lines in one useEffect)
- 15+ parameter update effects
- Transport control logic
- UI rendering

## Recommended Approach: Custom Hooks

Extract audio logic into **layer-specific hooks** that encapsulate state, refs, initialization, and effects together. This keeps related code colocated while reducing `Daw.tsx` to an orchestrator role.

## Files to Create

### 1. `react/src/utils/audioAssets.ts` (~40 lines)
Extract asset loading logic outside the component:
- `kickFiles`, `kickNames` - kick sample mapping
- `noiseFiles`, `noiseNames` - noise sample mapping
- `irFiles`, `irNames` - impulse response mapping
- `mapKnobRangeToCustomRange()`, `mapCustomRangeToKnobRange()` utility functions

### 2. `react/src/hooks/useKickLayer.ts` (~100 lines)
Encapsulates the kick signal chain:
- **State**: `kickSample`, `kickLen`, `kickOttAmt`, `kickDistortionAmt`
- **Refs**: sampler, distortion, OTT chain (EQ + MB compressor + gain)
- **Effects**: Sample change, length change, distortion change, OTT change
- **Returns**: `{ output, trigger, state, setters, uiProps }`

### 3. `react/src/hooks/useNoiseLayer.ts` (~90 lines)
Encapsulates the noise signal chain:
- **State**: `noiseSample`, `noiseDistortionAmt`, `lowPassFreq`, `highPassFreq`
- **Refs**: sampler, distortion, lowpass filter, highpass filter
- **Effects**: Sample change, distortion change, filter changes
- **Returns**: `{ output, trigger, state, setters, uiProps }`

### 4. `react/src/hooks/useReverbLayer.ts` (~80 lines)
Encapsulates the reverb chain:
- **State**: `reverbIr`, `lowPassFreq`, `highPassFreq`, `phaserWetness`
- **Refs**: convolver, lowpass, highpass, phaser
- **Effects**: IR load, filter changes, phaser wetness
- **Returns**: `{ input, output, state, setters, uiProps }`

### 5. `react/src/hooks/useMasterChain.ts` (~90 lines)
Encapsulates master processing:
- **State**: `ottAmt`, `distortionAmt`, `limiterAmt`
- **Refs**: OTT chain, distortion, limiter gain, limiter
- **Effects**: OTT change, distortion change, limiter change
- **Returns**: `{ input, state, setters, uiProps }`
- Note: Automatically connects to `Tone.Destination`

### 6. `react/src/hooks/useTransport.ts` (~60 lines)
Encapsulates transport logic:
- **State**: `isPlaying`, `isCueing`, `bpm`
- **Refs**: kickLoop, noiseLoop
- **Params**: `{ kickTrigger, noiseTrigger }` - callbacks from layer hooks
- **Returns**: `{ handlePlay, handleCue, bpm, setBpm, controlProps }`

## Refactored Daw.tsx Structure (~80-100 lines)

```tsx
export const Daw = () => {
  // Create layer hooks
  const kick = useKickLayer();
  const noise = useNoiseLayer();
  const reverb = useReverbLayer();
  const master = useMasterChain();

  // Create transport with trigger functions
  const transport = useTransport({
    kickTrigger: kick.trigger,
    noiseTrigger: noise.trigger,
  });

  // Audio routing (runs once when nodes ready)
  useEffect(() => {
    if (!kick.output || !noise.output || !reverb.input || !master.input) return;

    // kick -> reverb + master
    kick.output.connect(reverb.input);
    kick.output.connect(master.input);

    // noise -> reverb + master
    noise.output.connect(reverb.input);
    noise.output.connect(master.input);

    // reverb -> master
    reverb.output.connect(master.input);

    return () => { /* disconnect */ };
  }, [kick.output, noise.output, reverb.input, reverb.output, master.input]);

  return (
    <div className="daw">
      <h1>KICK WITH REVERB</h1>
      <h2>...</h2>
      <ControlStrip {...transport.controlProps} />
      <SoundUnit
        kickKnobProps={kick.uiProps}
        noiseKnobProps={noise.uiProps}
        reverbKnobProps={reverb.uiProps}
      />
      <MasterStrip {...master.uiProps} />
    </div>
  );
};
```

## Implementation Order

1. **Create `audioAssets.ts`** - Extract asset loading (no breaking changes)
2. **Create `useKickLayer.ts`** - First layer hook
3. **Update `Daw.tsx`** - Integrate kick hook, keep other code
4. **Create `useNoiseLayer.ts`** - Second layer hook
5. **Update `Daw.tsx`** - Integrate noise hook
6. **Create `useReverbLayer.ts`** - Third layer hook
7. **Update `Daw.tsx`** - Integrate reverb hook
8. **Create `useMasterChain.ts`** - Master processing hook
9. **Update `Daw.tsx`** - Integrate master hook
10. **Create `useTransport.ts`** - Transport hook
11. **Final cleanup** - Remove old code from `Daw.tsx`

## Audio Routing Diagram

```
KickSampler → Distortion → OTT(MB+EQ+Gain) ──┬──→ Convolver → LP → HP → Phaser ──┐
                                             │                                    │
NoiseSampler → Distortion → LP → HP ─────────┴───────────────────────────────────┤
                                                                                  │
                                                    MasterOTT(EQ+MB+Gain) ←───────┘
                                                          ↓
                                              Distortion → LimiterGain → Limiter → Out
```

## Verification Steps

1. Run `npm run dev` and verify app loads
2. Test kick layer: change sample, adjust length/distortion/OTT knobs
3. Test noise layer: change sample, adjust filter/distortion knobs
4. Test reverb layer: change IR, adjust filter/phaser knobs
5. Test master chain: adjust OTT/distortion/limiter knobs
6. Test transport: play/stop, cue button, BPM changes
7. Run `npm run build` to verify no TypeScript errors

## Estimated Result

| File | Before | After |
|------|--------|-------|
| Daw.tsx | 530 lines | ~80-100 lines |
| New hooks | - | ~460 lines total |
| audioAssets.ts | - | ~40 lines |

Total codebase grows slightly but with much better organization and maintainability.
