import { useEffect } from "react";
import { ControlStrip } from "./ControlStrip";
import { MasterStrip } from "./MasterStrip";
import { SoundUnit } from "./SoundUnit";
import { PresetsBar } from "./PresetsBar";
import { useKickLayer } from "../hooks/useKickLayer";
import { useNoiseLayer } from "../hooks/useNoiseLayer";
import { useReverbLayer } from "../hooks/useReverbLayer";
import { useMasterChain } from "../hooks/useMasterChain";
import { useTransport } from "../hooks/useTransport";
import { usePresets } from "../hooks/usePresets";
import { useAuth } from "../hooks/useAuth";

export const Daw = () => {
  const { isAuthenticated } = useAuth();

  // Layer hooks
  const kick = useKickLayer();
  const noise = useNoiseLayer();
  const reverb = useReverbLayer();
  const master = useMasterChain();

  // Transport hook
  const transport = useTransport({
    kickTrigger: kick.trigger,
    noiseTrigger: noise.trigger,
    noiseStop: noise.stop,
  });

  // Presets hook
  const presets = usePresets({
    kick: { setters: kick.setters, getState: kick.getState },
    noise: { setters: noise.setters, stop: noise.stop, getState: noise.getState },
    reverb: { setters: reverb.setters, getState: reverb.getState },
    master: { setters: master.setters, getState: master.getState },
    transport: { setters: transport.setters, getState: transport.getState, scheduleNoiseRetrigger: transport.scheduleNoiseRetrigger },
  });

  // Connect kick output to reverb and master when ready
  useEffect(() => {
    if (kick.output && reverb.input && master.input) {
      kick.output.connect(reverb.input);
      kick.output.connect(master.input);
    }
  }, [kick.output, reverb.input, master.input]);

  // Connect noise output to reverb and master when ready
  useEffect(() => {
    if (noise.output && reverb.input && master.input) {
      noise.output.connect(reverb.input);
      noise.output.connect(master.input);
    }
  }, [noise.output, reverb.input, master.input]);

  // Connect reverb output to master when ready
  useEffect(() => {
    if (reverb.output && master.input) {
      reverb.output.connect(master.input);
    }
  }, [reverb.output, master.input]);

  return (
    <div className="daw">
      <h1>KICK WITH REVERB</h1>
      {!isAuthenticated && (
        <h2>
          Fully featured fully sophisticated DAW <br />
          for the modern tik tok techno purist.
        </h2>
      )}
      <PresetsBar
        isAuthenticated={isAuthenticated}
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
