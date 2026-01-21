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
  output: Tone.Phaser | null;
  uiProps: LayerStripProps;
}

export const useReverbLayer = (): UseReverbLayerReturn => {
  // Audio node refs
  const convolverRef = useRef<Tone.Convolver | null>(null);
  const lowPassRef = useRef<Tone.Filter | null>(null);
  const highPassRef = useRef<Tone.Filter | null>(null);
  const phaserRef = useRef<Tone.Phaser | null>(null);

  // State for UI
  const [ir, setIr] = useState(irNames[0] || "JFKUnderpass");
  const [lowPassFreq, setLowPassFreq] = useState(1000);
  const [highPassFreq, setHighPassFreq] = useState(30);
  const [phaserWetness, setPhaserWetness] = useState(0);

  // Input/output refs for external connections
  const [input, setInput] = useState<Tone.Convolver | null>(null);
  const [output, setOutput] = useState<Tone.Phaser | null>(null);

  // Initialize audio nodes
  useEffect(() => {
    convolverRef.current = new Tone.Convolver(
      irFiles[ir] || irFiles[irNames[0]]
    );
    lowPassRef.current = new Tone.Filter(lowPassFreq, "lowpass");
    highPassRef.current = new Tone.Filter(highPassFreq, "highpass");
    phaserRef.current = new Tone.Phaser({
      frequency: 0.5,
      octaves: 3,
      baseFrequency: 350,
      wet: phaserWetness,
    });

    // Connect the chain
    convolverRef.current.connect(lowPassRef.current);
    lowPassRef.current.connect(highPassRef.current);
    highPassRef.current.connect(phaserRef.current);

    setInput(convolverRef.current);
    setOutput(phaserRef.current);

    return () => {
      convolverRef.current?.dispose();
      lowPassRef.current?.dispose();
      highPassRef.current?.dispose();
      phaserRef.current?.dispose();
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

  // Phaser wetness change effect
  useEffect(() => {
    if (phaserRef.current) {
      phaserRef.current.wet.value = phaserWetness;
    }
  }, [phaserWetness]);

  // UI props for LayerStrip
  const uiProps: LayerStripProps = {
    layerLabel: "Reverb Layer",
    dropdownItems: irNames,
    dropdownValue: ir,
    dropdownOnChange: setIr,
    layerKnobLabels: ["Low Pass", "High Pass", "Phaser"],
    knobValues: [
      mapCustomRangeToKnobRange(lowPassFreq, 30, 7000),
      mapCustomRangeToKnobRange(highPassFreq, 30, 7000),
      mapCustomRangeToKnobRange(phaserWetness, 0, 1),
    ],
    knobOnChanges: [
      (value) => setLowPassFreq(mapKnobRangeToCustomRange(value, 30, 7000)),
      (value) => setHighPassFreq(mapKnobRangeToCustomRange(value, 30, 7000)),
      (value) => setPhaserWetness(mapKnobRangeToCustomRange(value, 0, 1)),
    ],
  };

  return {
    input,
    output,
    uiProps,
  };
};
