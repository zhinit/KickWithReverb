import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import {
  noiseFiles,
  noiseNames,
  mapKnobRangeToCustomRange,
  mapCustomRangeToKnobRange,
} from "../utils/audioAssets";
import type { LayerStripProps } from "../types/types";

export interface UseNoiseLayerReturn {
  output: Tone.Filter | null;
  trigger: (time?: Tone.Unit.Time) => void;
  stop: () => void;
  uiProps: LayerStripProps;
  setters: {
    setSample: (value: string) => void;
    setLowPassFreq: (value: number) => void;
    setHighPassFreq: (value: number) => void;
    setVolume: (value: number) => void;
  };
  getState: () => {
    noiseSample: string;
    noiseLowPassFreq: number;
    noiseHighPassFreq: number;
    noiseVolume: number;
  };
}

export const useNoiseLayer = (): UseNoiseLayerReturn => {
  // Audio node refs
  const playerRef = useRef<Tone.Player | null>(null);
  const lowPassRef = useRef<Tone.Filter | null>(null);
  const highPassRef = useRef<Tone.Filter | null>(null);

  // State for UI
  const [sample, setSample] = useState(noiseNames[0] || "greyNoise");
  const [volume, setVolume] = useState(-10);
  const [lowPassFreq, setLowPassFreq] = useState(30);
  const [highPassFreq, setHighPassFreq] = useState(7000);

  // Output ref for external connections
  const [output, setOutput] = useState<Tone.Filter | null>(null);

  // Initialize audio nodes
  useEffect(() => {
    const initialUrl =
      noiseFiles[noiseNames[0]] || Object.values(noiseFiles)[0];

    playerRef.current = new Tone.Player(initialUrl);
    playerRef.current.volume.value = volume;
    playerRef.current.fadeOut = 0.1;

    lowPassRef.current = new Tone.Filter(lowPassFreq, "lowpass");
    highPassRef.current = new Tone.Filter(highPassFreq, "highpass");

    // Connect the chain
    playerRef.current.connect(lowPassRef.current);
    lowPassRef.current.connect(highPassRef.current);

    setOutput(highPassRef.current);

    return () => {
      playerRef.current?.dispose();
      lowPassRef.current?.dispose();
      highPassRef.current?.dispose();
    };
  }, []);

  // Sample change effect - load new buffer
  useEffect(() => {
    if (playerRef.current && noiseFiles[sample]) {
      playerRef.current.load(noiseFiles[sample]);
    }
  }, [sample]);

  // Low pass change effect
  useEffect(() => {
    if (lowPassRef.current) {
      lowPassRef.current.frequency.value = lowPassFreq;
    }
  }, [lowPassFreq]);

  // High pass change effect
  useEffect(() => {
    if (highPassRef.current) {
      highPassRef.current.frequency.value = highPassFreq;
    }
  }, [highPassFreq]);

  // Volume change effect
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.volume.value = volume;
    }
  }, [volume]);

  // Stop any currently playing noise
  const stop = () => {
    playerRef.current?.stop();
  };

  // Trigger function for transport
  const trigger = (time?: Tone.Unit.Time) => {
    if (playerRef.current?.loaded) {
      playerRef.current.stop();
      playerRef.current.start(time);
    }
  };

  // UI props for LayerStrip
  const uiProps: LayerStripProps = {
    layerLabel: "Noise Layer",
    dropdownItems: noiseNames,
    dropdownValue: sample,
    dropdownOnChange: setSample,
    layerKnobLabels: ["Low Pass", "High Pass", "Volume"],
    knobValues: [
      mapCustomRangeToKnobRange(lowPassFreq, 30, 7000),
      mapCustomRangeToKnobRange(highPassFreq, 30, 7000),
      mapCustomRangeToKnobRange(volume, -70, -6),
    ],
    knobOnChanges: [
      (value) => setLowPassFreq(mapKnobRangeToCustomRange(value, 30, 7000)),
      (value) => setHighPassFreq(mapKnobRangeToCustomRange(value, 30, 7000)),
      (value) => setVolume(mapKnobRangeToCustomRange(value, -70, -6)),
    ],
  };

  const getState = () => ({
    noiseSample: sample,
    noiseLowPassFreq: lowPassFreq,
    noiseHighPassFreq: highPassFreq,
    noiseVolume: volume,
  });

  return {
    output,
    trigger,
    stop,
    uiProps,
    setters: {
      setSample,
      setLowPassFreq,
      setHighPassFreq,
      setVolume,
    },
    getState,
  };
};
