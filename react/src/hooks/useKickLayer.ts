import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import {
  kickFiles,
  kickNames,
  mapKnobRangeToCustomRange,
  mapCustomRangeToKnobRange,
} from "../utils/audioAssets";
import type { LayerStripProps } from "../types/types";

export interface UseKickLayerReturn {
  output: Tone.Gain | null;
  trigger: (time?: Tone.Unit.Time) => void;
  uiProps: LayerStripProps;
  setters: {
    setSample: (value: string) => void;
    setLen: (value: number) => void;
    setDistAmt: (value: number) => void;
    setOttAmt: (value: number) => void;
  };
  getState: () => {
    kickSample: string;
    kickLen: number;
    kickDistAmt: number;
    kickOttAmt: number;
  };
}

export const useKickLayer = (): UseKickLayerReturn => {
  // Audio node refs
  const samplerRef = useRef<Tone.Sampler | null>(null);
  const distortionRef = useRef<Tone.Distortion | null>(null);
  const ottEqRef = useRef<Tone.EQ3 | null>(null);
  const ottMbRef = useRef<Tone.MultibandCompressor | null>(null);
  const ottGainRef = useRef<Tone.Gain | null>(null);

  // Refs for real-time access in loops
  const sampleRef = useRef<string>("C1");
  const lenRef = useRef<number>(0.5);

  // State for UI
  const [sample, setSample] = useState(kickNames[0] || "Kick1");
  const [len, setLen] = useState(0.3);
  const [ottAmt, setOttAmt] = useState(0);
  const [distortionAmt, setDistortionAmt] = useState(0);

  // Output ref for external connections
  const [output, setOutput] = useState<Tone.Gain | null>(null);

  // Initialize audio nodes
  useEffect(() => {
    const kickUrls: Record<string, string> = {};
    kickNames.forEach((kickName, index) => {
      const note = `C${index + 1}`;
      kickUrls[note] = kickFiles[kickName];
    });

    samplerRef.current = new Tone.Sampler({ urls: kickUrls });
    distortionRef.current = new Tone.Distortion(0.3);
    ottMbRef.current = new Tone.MultibandCompressor({
      lowFrequency: 88.3,
      highFrequency: 2500,
      high: {
        threshold: -35.5,
        ratio: 1,
        attack: 0.0135,
        release: 0.132,
      },
      mid: {
        threshold: -30.2,
        ratio: 1,
        attack: 0.0224,
        release: 0.282,
      },
      low: {
        threshold: -33.8,
        ratio: 1,
        attack: 0.0447,
        release: 0.282,
      },
    });
    ottEqRef.current = new Tone.EQ3({
      lowFrequency: 88.3,
      highFrequency: 2500,
      low: 0,
      mid: 0,
      high: 0,
    });
    ottGainRef.current = new Tone.Gain(1);
    samplerRef.current.volume.value = -1;

    // Connect the chain
    samplerRef.current.connect(distortionRef.current);
    distortionRef.current.connect(ottMbRef.current);
    ottMbRef.current.connect(ottEqRef.current);
    ottEqRef.current.connect(ottGainRef.current);

    setOutput(ottGainRef.current);

    return () => {
      samplerRef.current?.dispose();
      distortionRef.current?.dispose();
      ottMbRef.current?.dispose();
      ottEqRef.current?.dispose();
      ottGainRef.current?.dispose();
    };
  }, []);

  // Sample change effect
  useEffect(() => {
    const noteMap: Record<string, string> = {};
    kickNames.forEach((kickName, index) => {
      noteMap[kickName] = `C${index + 1}`;
    });
    sampleRef.current = noteMap[sample] || "C1";
  }, [sample]);

  // Length change effect
  useEffect(() => {
    lenRef.current = len;
  }, [len]);

  // Distortion change effect
  useEffect(() => {
    if (distortionRef.current) {
      distortionRef.current.wet.value = distortionAmt;
    }
  }, [distortionAmt]);

  // OTT change effect
  useEffect(() => {
    if (ottEqRef.current && ottMbRef.current && ottGainRef.current) {
      ottEqRef.current.mid.value = -3 * ottAmt;
      ottMbRef.current.high.ratio.value = 1 + 10 * ottAmt;
      ottMbRef.current.mid.ratio.value = 1 + 10 * ottAmt;
      ottMbRef.current.low.ratio.value = 1 + 10 * ottAmt;
      ottGainRef.current.gain.value = 1 + 1 * ottAmt;
    }
  }, [ottAmt]);

  // Trigger function for transport
  const trigger = (time?: Tone.Unit.Time) => {
    samplerRef.current?.triggerAttackRelease(
      sampleRef.current,
      lenRef.current,
      time
    );
  };

  // UI props for LayerStrip
  const uiProps: LayerStripProps = {
    layerLabel: "Kick Layer",
    dropdownItems: kickNames,
    dropdownValue: sample,
    dropdownOnChange: setSample,
    layerKnobLabels: ["Length", "Distortion", "OTT"],
    knobValues: [
      mapCustomRangeToKnobRange(len, 0, 0.3),
      mapCustomRangeToKnobRange(distortionAmt, 0, 0.5),
      mapCustomRangeToKnobRange(ottAmt, 0, 1),
    ],
    knobOnChanges: [
      (value) => setLen(mapKnobRangeToCustomRange(value, 0, 0.3)),
      (value) => setDistortionAmt(mapKnobRangeToCustomRange(value, 0, 0.5)),
      (value) => setOttAmt(mapKnobRangeToCustomRange(value, 0, 1)),
    ],
  };

  const getState = () => ({
    kickSample: sample,
    kickLen: len,
    kickDistAmt: distortionAmt,
    kickOttAmt: ottAmt,
  });

  return {
    output,
    trigger,
    uiProps,
    setters: {
      setSample,
      setLen,
      setDistAmt: setDistortionAmt,
      setOttAmt,
    },
    getState,
  };
};
