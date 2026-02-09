import { ControlStrip } from "./ControlStrip";
import { MasterStrip } from "./MasterStrip";
import { SoundUnit } from "./SoundUnit";
import { PresetsBar } from "./PresetsBar";
import { useAudioEngine } from "../hooks/useAudioEngine";
import { useKickLayer } from "../hooks/useKickLayer";
import { useNoiseLayer } from "../hooks/useNoiseLayer";
import { useReverbLayer } from "../hooks/useReverbLayer";
import { useMasterChain } from "../hooks/useMasterChain";
import { useTransport } from "../hooks/useTransport";
import { usePresets } from "../hooks/usePresets";
import { useAiKicks } from "../hooks/useAiKicks";
import { useAuth } from "../hooks/useAuth";
import { useState } from "react";

export const Daw = () => {
  const { userStatus } = useAuth();
  const isMember = userStatus === "member";

  const [mode, setMode] = useState<"daw" | "kickGen">("daw");

  // Audio engine (AudioContext + WASM worklet)
  const engine = useAudioEngine();

  // AI kicks (fetch + decode + load into WASM on startup)
  const aiKicks = useAiKicks(engine);

  // Layer hooks — all routing is internal to the C++ engine
  const kick = useKickLayer(engine);
  const noise = useNoiseLayer(engine);
  const reverb = useReverbLayer(engine);
  const master = useMasterChain(engine);

  // Transport hook
  const transport = useTransport(engine);

  // Presets hook
  const presets = usePresets({
    kick: { setters: kick.setters, getState: kick.getState },
    noise: { setters: noise.setters, getState: noise.getState },
    reverb: { setters: reverb.setters, getState: reverb.getState },
    master: { setters: master.setters, getState: master.getState },
    transport: { setters: transport.setters, getState: transport.getState },
  });

  return (
    <div className="daw">
      <h1>KICK WITH REVERB</h1>
      <PresetsBar
        isMember={isMember}
        presets={presets.presets}
        currentPresetId={presets.currentPresetId}
        currentPresetName={presets.currentPresetName}
        canDelete={presets.canDelete}
        onLoadPreset={presets.loadPreset}
        onSave={presets.savePreset}
        onDelete={presets.deleteCurrentPreset}
        onNext={presets.nextPreset}
        onPrev={presets.prevPreset}
      />
      <div className="daw-grid">
        <ControlStrip {...transport.controlProps} />
        <SoundUnit
          kickKnobProps={kick.uiProps}
          noiseKnobProps={noise.uiProps}
          reverbKnobProps={reverb.uiProps}
        />
        <MasterStrip {...master.uiProps} />
      </div>
    </div>
  );
};
