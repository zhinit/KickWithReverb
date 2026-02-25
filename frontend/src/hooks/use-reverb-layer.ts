import { useEffect, useState } from "react";

import {
  irNames,
  mapKnobRangeToCustomRange,
  mapCustomRangeToKnobRange,
  mapKnobToFrequency,
  mapFrequencyToKnob,
} from "../utils/audio-assets";

import type { LayerStripProps } from "../types/types";
import type { AudioEngine } from "./use-audio-engine";

export interface UseReverbLayerReturn {
  uiProps: LayerStripProps;
  setters: {
    setSample: (value: string) => void;
    setLowPassFreq: (value: number) => void;
    setHighPassFreq: (value: number) => void;
    setVolume: (value: number) => void;
  };
  getState: () => {
    reverbSample: string;
    reverbLowPassFreq: number;
    reverbHighPassFreq: number;
    reverbVolume: number;
  };
}

export const useReverbLayer = (engine: AudioEngine): UseReverbLayerReturn => {
  // states
  const [ir, setIr] = useState(irNames[0] || "JFKUnderpass");
  const [lowPassFreq, setLowPassFreq] = useState(7000);
  const [highPassFreq, setHighPassFreq] = useState(30);
  const [volume, setVolume] = useState(-6);

  // get items from audio engine hook
  const { postMessage, isReady, irNameToIndex } = engine;

  // send current ir sample to dsp when sample is changed in dropdown
  useEffect(() => {
    if (!isReady) return;
    const index = irNameToIndex[ir];
    if (index !== undefined) {
      postMessage({ type: "selectIR", index });
    }
  }, [ir, isReady, postMessage, irNameToIndex]);

  // send low pass freq to dsp when knob is moved
  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "reverbLowPass", value: lowPassFreq });
  }, [lowPassFreq, isReady, postMessage]);

  // send high pass freq to dsp when knob is moved
  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "reverbHighPass", value: highPassFreq });
  }, [highPassFreq, isReady, postMessage]);

  // send volume to dsp when knob is moved
  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "reverbVolume", value: volume });
  }, [volume, isReady, postMessage]);

  // create noise layer props to pass
  const uiProps: LayerStripProps = {
    layerLabel: "Reverb Layer",
    dropdownItems: irNames,
    dropdownValue: ir,
    dropdownOnChange: setIr,
    layerKnobLabels: ["Low Pass", "High Pass", "Volume"],
    knobValues: [
      mapFrequencyToKnob(lowPassFreq, 30, 7000),
      mapFrequencyToKnob(highPassFreq, 30, 7000),
      mapCustomRangeToKnobRange(volume, -60, 0),
    ],
    knobOnChanges: [
      (value) => setLowPassFreq(mapKnobToFrequency(value, 30, 7000)),
      (value) => setHighPassFreq(mapKnobToFrequency(value, 30, 7000)),
      (value) => setVolume(mapKnobRangeToCustomRange(value, -60, 0)),
    ],
  };

  // create function to get the current state of the noise layer
  // which includes current sample and knob positions
  const getState = () => ({
    reverbSample: ir,
    reverbLowPassFreq: lowPassFreq,
    reverbHighPassFreq: highPassFreq,
    reverbVolume: volume,
  });

  // return helpful info so it can be accessed elsewhere
  return {
    uiProps,
    setters: {
      setSample: setIr,
      setLowPassFreq,
      setHighPassFreq,
      setVolume,
    },
    getState,
  };
};
