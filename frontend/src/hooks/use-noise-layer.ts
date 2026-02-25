import { useEffect, useState } from "react";

import {
  noiseNames,
  mapKnobRangeToCustomRange,
  mapCustomRangeToKnobRange,
  mapKnobToFrequency,
  mapFrequencyToKnob,
} from "../utils/audio-assets";

import type { LayerStripProps } from "../types/types";
import type { AudioEngine } from "./use-audio-engine";

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
  // states
  const [sample, setSample] = useState(noiseNames[0] ?? "");
  const [volume, setVolume] = useState(-70);
  const [lowPassFreq, setLowPassFreq] = useState(7000);
  const [highPassFreq, setHighPassFreq] = useState(30);

  // get items from audio engine hook
  const { postMessage, isReady, noiseNameToIndex } = engine;

  // send current noise sample to dsp when sample is changed in dropdown
  useEffect(() => {
    if (!isReady) return;
    const index = noiseNameToIndex[sample];
    if (index !== undefined) {
      postMessage({ type: "selectNoiseSample", index });
    }
  }, [sample, isReady, postMessage, noiseNameToIndex]);

  // send volume to dsp when knob is moved
  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "noiseVolume", value: volume });
  }, [volume, isReady, postMessage]);

  // send low pass freq to dsp when knob is moved
  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "noiseLowPass", value: lowPassFreq });
  }, [lowPassFreq, isReady, postMessage]);

  // send high pass freq to dsp when knob is moved
  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "noiseHighPass", value: highPassFreq });
  }, [highPassFreq, isReady, postMessage]);

  // create noise layer props to pass
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

  // create function to get the current state of the kick layer
  // which includes current sample and knob positions
  const getState = () => ({
    noiseSample: sample,
    noiseLowPassFreq: lowPassFreq,
    noiseHighPassFreq: highPassFreq,
    noiseVolume: volume,
  });

  // return helpful info so it can be accessed elsewhere
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
