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
  uiProps: LayerStripProps;
}

export const useNoiseLayer = (): UseNoiseLayerReturn => {
  // Audio node refs
  const samplerRef = useRef<Tone.Sampler | null>(null);
  const distortionRef = useRef<Tone.Distortion | null>(null);
  const lowPassRef = useRef<Tone.Filter | null>(null);
  const highPassRef = useRef<Tone.Filter | null>(null);

  // Ref for real-time access in loops
  const sampleRef = useRef<string>("C1");

  // State for UI
  const [sample, setSample] = useState(noiseNames[0] || "greyNoise");
  const [distortionAmt, setDistortionAmt] = useState(0);
  const [lowPassFreq, setLowPassFreq] = useState(30);
  const [highPassFreq, setHighPassFreq] = useState(7000);

  // Output ref for external connections
  const [output, setOutput] = useState<Tone.Filter | null>(null);

  // Initialize audio nodes
  useEffect(() => {
    const noiseUrls: Record<string, string> = {};
    noiseNames.forEach((noiseName, index) => {
      const note = `C${index + 1}`;
      noiseUrls[note] = noiseFiles[noiseName];
    });

    samplerRef.current = new Tone.Sampler({ urls: noiseUrls });
    samplerRef.current.volume.value = -12;

    distortionRef.current = new Tone.Distortion(0.3);
    lowPassRef.current = new Tone.Filter(lowPassFreq, "lowpass");
    highPassRef.current = new Tone.Filter(highPassFreq, "highpass");

    // Connect the chain
    samplerRef.current.connect(distortionRef.current);
    distortionRef.current.connect(lowPassRef.current);
    lowPassRef.current.connect(highPassRef.current);

    setOutput(highPassRef.current);

    return () => {
      samplerRef.current?.dispose();
      distortionRef.current?.dispose();
      lowPassRef.current?.dispose();
      highPassRef.current?.dispose();
    };
  }, []);

  // Sample change effect
  useEffect(() => {
    const noteMap: Record<string, string> = {};
    noiseNames.forEach((noiseName, index) => {
      noteMap[noiseName] = `C${index + 1}`;
    });
    sampleRef.current = noteMap[sample] || "C1";
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

  // Distortion change effect
  useEffect(() => {
    if (distortionRef.current) {
      distortionRef.current.wet.value = distortionAmt;
    }
  }, [distortionAmt]);

  // Trigger function for transport
  const trigger = (time?: Tone.Unit.Time) => {
    samplerRef.current?.triggerAttackRelease(sampleRef.current, 4, time);
  };

  // UI props for LayerStrip
  const uiProps: LayerStripProps = {
    layerLabel: "Noise Layer",
    dropdownItems: noiseNames,
    dropdownValue: sample,
    dropdownOnChange: setSample,
    layerKnobLabels: ["Low Pass", "High Pass", "Distortion"],
    knobValues: [
      mapCustomRangeToKnobRange(lowPassFreq, 30, 7000),
      mapCustomRangeToKnobRange(highPassFreq, 30, 7000),
      mapCustomRangeToKnobRange(distortionAmt, 0, 0.5),
    ],
    knobOnChanges: [
      (value) => setLowPassFreq(mapKnobRangeToCustomRange(value, 30, 7000)),
      (value) => setHighPassFreq(mapKnobRangeToCustomRange(value, 30, 7000)),
      (value) => setDistortionAmt(mapKnobRangeToCustomRange(value, 0, 0.5)),
    ],
  };

  return {
    output,
    trigger,
    uiProps,
  };
};
