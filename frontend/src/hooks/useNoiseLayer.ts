import { useEffect, useState } from "react";
import {
  noiseNames,
  mapKnobRangeToCustomRange,
  mapCustomRangeToKnobRange,
  mapKnobToFrequency,
  mapFrequencyToKnob,
} from "../utils/audioAssets";
import type { LayerStripProps } from "../types/types";
import type { AudioEngine } from "./useAudioEngine";

export interface UseNoiseLayerReturn {
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

export const useNoiseLayer = (engine: AudioEngine): UseNoiseLayerReturn => {
  const { postMessage, isReady, noiseNameToIndex } = engine;

  const [sample, setSample] = useState(noiseNames[0] || "greyNoise");
  const [volume, setVolume] = useState(-70);
  const [lowPassFreq, setLowPassFreq] = useState(7000);
  const [highPassFreq, setHighPassFreq] = useState(30);

  useEffect(() => {
    if (!isReady) return;
    const index = noiseNameToIndex[sample];
    if (index !== undefined) {
      postMessage({ type: "selectNoiseSample", index });
    }
  }, [sample, isReady, postMessage, noiseNameToIndex]);

  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "noiseVolume", value: volume });
  }, [volume, isReady, postMessage]);

  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "noiseLowPass", value: lowPassFreq });
  }, [lowPassFreq, isReady, postMessage]);

  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "noiseHighPass", value: highPassFreq });
  }, [highPassFreq, isReady, postMessage]);

  const uiProps: LayerStripProps = {
    layerLabel: "Noise Layer",
    dropdownItems: noiseNames,
    dropdownValue: sample,
    dropdownOnChange: setSample,
    layerKnobLabels: ["Low Pass", "High Pass", "Volume"],
    knobValues: [
      mapFrequencyToKnob(lowPassFreq, 30, 7000),
      mapFrequencyToKnob(highPassFreq, 30, 7000),
      mapCustomRangeToKnobRange(volume, -70, -6),
    ],
    knobOnChanges: [
      (value) => setLowPassFreq(mapKnobToFrequency(value, 30, 7000)),
      (value) => setHighPassFreq(mapKnobToFrequency(value, 30, 7000)),
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
