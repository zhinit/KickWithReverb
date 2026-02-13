import { useEffect, useState } from "react";
import type { ControlStripProps } from "../types/types";
import type { AudioEngine } from "./use-audio-engine";

export interface UseTransportReturn {
  isPlaying: boolean;
  bpm: number;
  controlProps: ControlStripProps;
  stop: () => void;
  setters: {
    setBpm: (value: number) => void;
  };
  getState: () => {
    bpm: number;
  };
}

export const useTransport = (engine: AudioEngine): UseTransportReturn => {
  const { postMessage, resume, isReady } = engine;

  const [isPlayOn, setIsPlayOn] = useState(false);
  const [isCuePressed, setIsCuePressed] = useState(false);
  const [bpm, setBPM] = useState(140);

  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "bpm", value: bpm });
  }, [bpm, isReady, postMessage]);

  const handlePlayClick = async () => {
    await resume();
    const newPlayState = !isPlayOn;
    setIsPlayOn(newPlayState);
    postMessage({ type: "loop", enabled: newPlayState });
  };

  const handleCueMouseDown = async () => {
    await resume();
    setIsCuePressed(true);
    postMessage({ type: "cue" });
  };

  const handleCueMouseUp = () => {
    setIsCuePressed(false);
    postMessage({ type: "cueRelease" });
  };

  const stop = () => {
    if (isPlayOn) {
      setIsPlayOn(false);
      postMessage({ type: "loop", enabled: false });
    }
  };

  const controlProps: ControlStripProps = {
    bpm,
    isPlayOn,
    isCuePressed,
    handleCueMouseDown,
    handleCueMouseUp,
    handlePlayClick,
    setBPM,
  };

  const getState = () => ({
    bpm,
  });

  return {
    isPlaying: isPlayOn,
    bpm,
    controlProps,
    stop,
    setters: {
      setBpm: setBPM,
    },
    getState,
  };
};
