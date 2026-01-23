import { useEffect } from "react";
import { ControlStrip } from "./ControlStrip";
import { MasterStrip } from "./MasterStrip";
import { SoundUnit } from "./SoundUnit";
import { useKickLayer } from "../hooks/useKickLayer";
import { useNoiseLayer } from "../hooks/useNoiseLayer";
import { useReverbLayer } from "../hooks/useReverbLayer";
import { useMasterChain } from "../hooks/useMasterChain";
import { useTransport } from "../hooks/useTransport";
import { PresetsBar } from "./PresetsBar";

export const Daw = () => {
  // Layer hooks
  const kick = useKickLayer();
  const noise = useNoiseLayer();
  const reverb = useReverbLayer();
  const master = useMasterChain();

  // Transport hook
  const transport = useTransport({
    kickTrigger: kick.trigger,
    noiseTrigger: noise.trigger,
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
      <h2>
        Fully featured fully sophisticated DAW <br />
        for the modern tik tok techno purist.
      </h2>
      {/* <PresetsBar /> */}
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
