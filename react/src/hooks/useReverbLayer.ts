import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import {
  irFiles,
  irNames,
  mapKnobRangeToCustomRange,
  mapCustomRangeToKnobRange,
} from "../utils/audioAssets";
import type { LayerStripProps } from "../types/types";

export interface UseReverbLayerReturn {
  input: Tone.Convolver | null;
  output: Tone.Gain | null;
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

export const useReverbLayer = (): UseReverbLayerReturn => {
  // Audio node refs
  const convolverRef = useRef<Tone.Convolver | null>(null);
  const lowPassRef = useRef<Tone.Filter | null>(null);
  const highPassRef = useRef<Tone.Filter | null>(null);
  const gainRef = useRef<Tone.Gain | null>(null);

  // State for UI
  const [ir, setIr] = useState(irNames[0] || "JFKUnderpass");
  const [lowPassFreq, setLowPassFreq] = useState(1000);
  const [highPassFreq, setHighPassFreq] = useState(30);
  const [volume, setVolume] = useState(-6);

  // Input/output refs for external connections
  const [input, setInput] = useState<Tone.Convolver | null>(null);
  const [output, setOutput] = useState<Tone.Gain | null>(null);

  // Initialize audio nodes
  useEffect(() => {
    convolverRef.current = new Tone.Convolver(
      irFiles[ir] || irFiles[irNames[0]]
    );
    lowPassRef.current = new Tone.Filter(lowPassFreq, "lowpass");
    highPassRef.current = new Tone.Filter(highPassFreq, "highpass");
    gainRef.current = new Tone.Gain(Tone.dbToGain(volume));

    // Connect the chain
    convolverRef.current.connect(lowPassRef.current);
    lowPassRef.current.connect(highPassRef.current);
    highPassRef.current.connect(gainRef.current);

    setInput(convolverRef.current);
    setOutput(gainRef.current);

    return () => {
      convolverRef.current?.dispose();
      lowPassRef.current?.dispose();
      highPassRef.current?.dispose();
      gainRef.current?.dispose();
    };
  }, []);

  // IR change effect
  useEffect(() => {
    if (convolverRef.current && irFiles[ir]) {
      convolverRef.current.load(irFiles[ir]).catch(console.error);
    }
  }, [ir]);

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
    if (gainRef.current) {
      gainRef.current.gain.value = Tone.dbToGain(volume);
    }
  }, [volume]);

  // UI props for LayerStrip
  const uiProps: LayerStripProps = {
    layerLabel: "Reverb Layer",
    dropdownItems: irNames,
    dropdownValue: ir,
    dropdownOnChange: setIr,
    layerKnobLabels: ["Low Pass", "High Pass", "Volume"],
    knobValues: [
      mapCustomRangeToKnobRange(lowPassFreq, 30, 7000),
      mapCustomRangeToKnobRange(highPassFreq, 30, 7000),
      mapCustomRangeToKnobRange(volume, -60, 0),
    ],
    knobOnChanges: [
      (value) => setLowPassFreq(mapKnobRangeToCustomRange(value, 30, 7000)),
      (value) => setHighPassFreq(mapKnobRangeToCustomRange(value, 30, 7000)),
      (value) => setVolume(mapKnobRangeToCustomRange(value, -60, 0)),
    ],
  };

  const getState = () => ({
    reverbSample: ir,
    reverbLowPassFreq: lowPassFreq,
    reverbHighPassFreq: highPassFreq,
    reverbVolume: volume,
  });

  return {
    input,
    output,
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
