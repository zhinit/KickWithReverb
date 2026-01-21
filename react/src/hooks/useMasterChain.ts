import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import {
  mapKnobRangeToCustomRange,
  mapCustomRangeToKnobRange,
} from "../utils/audioAssets";
import type { MasterStripProps } from "../types/types";

export interface UseMasterChainReturn {
  input: Tone.EQ3 | null;
  uiProps: MasterStripProps;
}

export const useMasterChain = (): UseMasterChainReturn => {
  // Audio node refs
  const ottEqRef = useRef<Tone.EQ3 | null>(null);
  const ottMbRef = useRef<Tone.MultibandCompressor | null>(null);
  const ottGainRef = useRef<Tone.Gain | null>(null);
  const distortionRef = useRef<Tone.Distortion | null>(null);
  const limiterGainRef = useRef<Tone.Gain | null>(null);
  const limiterRef = useRef<Tone.Limiter | null>(null);

  // State for UI
  const [ottAmt, setOttAmt] = useState(0);
  const [distortionAmt, setDistortionAmt] = useState(0);
  const [limiterAmt, setLimiterAmt] = useState(1.5);

  // Input ref for external connections
  const [input, setInput] = useState<Tone.EQ3 | null>(null);

  // Initialize audio nodes
  useEffect(() => {
    ottEqRef.current = new Tone.EQ3({
      lowFrequency: 88.3,
      highFrequency: 2500,
      low: 0,
      mid: 0,
      high: 0,
    });
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
    ottGainRef.current = new Tone.Gain(1);
    distortionRef.current = new Tone.Distortion(0.3);
    limiterGainRef.current = new Tone.Gain(limiterAmt);
    limiterRef.current = new Tone.Limiter(0);

    // Connect the chain
    ottEqRef.current.connect(ottMbRef.current);
    ottMbRef.current.connect(ottGainRef.current);
    ottGainRef.current.connect(distortionRef.current);
    distortionRef.current.connect(limiterGainRef.current);
    limiterGainRef.current.connect(limiterRef.current);
    limiterRef.current.toDestination();

    setInput(ottEqRef.current);

    return () => {
      ottEqRef.current?.dispose();
      ottMbRef.current?.dispose();
      ottGainRef.current?.dispose();
      distortionRef.current?.dispose();
      limiterGainRef.current?.dispose();
      limiterRef.current?.dispose();
    };
  }, []);

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

  // Distortion change effect
  useEffect(() => {
    if (distortionRef.current) {
      distortionRef.current.wet.value = distortionAmt;
    }
  }, [distortionAmt]);

  // Limiter change effect
  useEffect(() => {
    if (limiterGainRef.current) {
      limiterGainRef.current.gain.value = limiterAmt;
    }
  }, [limiterAmt]);

  // UI props for MasterStrip
  const uiProps: MasterStripProps = {
    layerKnobLabels: ["OTT", "Distortion", "Limiter"],
    knobValues: [
      mapCustomRangeToKnobRange(ottAmt, 0, 1),
      mapCustomRangeToKnobRange(distortionAmt, 0, 0.5),
      mapCustomRangeToKnobRange(limiterAmt, 1, 4),
    ],
    knobOnChanges: [
      (value) => setOttAmt(mapKnobRangeToCustomRange(value, 0, 1)),
      (value) => setDistortionAmt(mapKnobRangeToCustomRange(value, 0, 0.5)),
      (value) => setLimiterAmt(mapKnobRangeToCustomRange(value, 1, 4)),
    ],
  };

  return {
    input,
    uiProps,
  };
};
