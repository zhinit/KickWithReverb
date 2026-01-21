import { useEffect, useRef, useState } from "react";
import { ControlStrip } from "./ControlStrip";
import { MasterStrip } from "./MasterStrip";
import { SoundUnit } from "./SoundUnit";
import * as Tone from "tone";
import { useKickLayer } from "../hooks/useKickLayer";
import { useNoiseLayer } from "../hooks/useNoiseLayer";
import { useReverbLayer } from "../hooks/useReverbLayer";
import { useMasterChain } from "../hooks/useMasterChain";

export const Daw = () => {
  // Layer hooks
  const kick = useKickLayer();
  const noise = useNoiseLayer();
  const reverb = useReverbLayer();
  const master = useMasterChain();

  // control strip states and refs
  const kickLoopRef = useRef<Tone.Loop | null>(null);
  const noiseLoopRef = useRef<Tone.Loop | null>(null);

  const [isPlayOn, setIsPlayOn] = useState(false);
  const [isCuePressed, setIsCuePressed] = useState(false);
  const [bpm, setBPM] = useState(140);

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

  // bpm change effect
  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  // play button functionality
  const handlePlayClick = async () => {
    const newPlayState = !isPlayOn;
    setIsPlayOn(newPlayState);

    if (newPlayState) {
      await Tone.start();

      Tone.getTransport().bpm.value = bpm;

      kickLoopRef.current = new Tone.Loop((time) => {
        kick.trigger(time, kick.lenRef.current);
      }, "4n").start(0);

      noiseLoopRef.current = new Tone.Loop((time) => {
        noise.trigger(time, 4);
      }, "1n").start(0);

      Tone.getTransport().start();
    } else {
      if (kickLoopRef.current) {
        kickLoopRef.current.stop();
        kickLoopRef.current.dispose();
        kickLoopRef.current = null;
      }
      if (noiseLoopRef.current) {
        noiseLoopRef.current.stop();
        noiseLoopRef.current.dispose();
        noiseLoopRef.current = null;
      }
      Tone.getTransport().stop();
    }
  };

  // cue button functionality
  const handleCueMouseDown = async () => {
    setIsCuePressed(true);
    await Tone.start();
    kick.trigger(undefined, 0.5);
    noise.trigger(undefined, 0.5);
  };

  const handleCueMouseUp = () => {
    setIsCuePressed(false);
  };

  return (
    <div className="daw">
      <h1>KICK WITH REVERB</h1>
      <h2>
        Fully featured fully sophisticated DAW <br />
        for the modern tik tok techno purist.
      </h2>
      <ControlStrip
        bpm={bpm}
        isPlayOn={isPlayOn}
        isCuePressed={isCuePressed}
        handleCueMouseDown={handleCueMouseDown}
        handleCueMouseUp={handleCueMouseUp}
        handlePlayClick={handlePlayClick}
        setBPM={setBPM}
      />
      <SoundUnit
        kickKnobProps={kick.uiProps}
        noiseKnobProps={noise.uiProps}
        reverbKnobProps={reverb.uiProps}
      />
      <MasterStrip {...master.uiProps} />
    </div>
  );
};
