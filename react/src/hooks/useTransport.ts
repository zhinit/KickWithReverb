import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import type { ControlStripProps } from "../types/types";

export interface TransportTriggers {
  kickTrigger: (time?: Tone.Unit.Time) => void;
  noiseTrigger: (time?: Tone.Unit.Time) => void;
}

export interface UseTransportReturn {
  isPlaying: boolean;
  bpm: number;
  controlProps: ControlStripProps;
}

export const useTransport = (triggers: TransportTriggers): UseTransportReturn => {
  const kickLoopRef = useRef<Tone.Loop | null>(null);
  const noiseLoopRef = useRef<Tone.Loop | null>(null);

  const [isPlayOn, setIsPlayOn] = useState(false);
  const [isCuePressed, setIsCuePressed] = useState(false);
  const [bpm, setBPM] = useState(140);

  // BPM change effect
  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  // Play button functionality
  const handlePlayClick = async () => {
    const newPlayState = !isPlayOn;
    setIsPlayOn(newPlayState);

    if (newPlayState) {
      await Tone.start();

      Tone.getTransport().bpm.value = bpm;

      kickLoopRef.current = new Tone.Loop((time) => {
        triggers.kickTrigger(time);
      }, "4n").start(0);

      noiseLoopRef.current = new Tone.Loop((time) => {
        triggers.noiseTrigger(time);
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

  // Cue button functionality
  const handleCueMouseDown = async () => {
    setIsCuePressed(true);
    await Tone.start();
    triggers.kickTrigger();
    triggers.noiseTrigger();
  };

  const handleCueMouseUp = () => {
    setIsCuePressed(false);
  };

  // Props for ControlStrip component
  const controlProps: ControlStripProps = {
    bpm,
    isPlayOn,
    isCuePressed,
    handleCueMouseDown,
    handleCueMouseUp,
    handlePlayClick,
    setBPM,
  };

  return {
    isPlaying: isPlayOn,
    bpm,
    controlProps,
  };
};
