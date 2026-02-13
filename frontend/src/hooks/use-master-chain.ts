import { useEffect, useState } from "react";
import {
  mapKnobRangeToCustomRange,
  mapCustomRangeToKnobRange,
} from "../utils/audio-assets";
import type { MasterStripProps } from "../types/types";
import type { AudioEngine } from "./use-audio-engine";

export interface UseMasterChainReturn {
  uiProps: MasterStripProps;
  setters: {
    setOttAmt: (value: number) => void;
    setDistAmt: (value: number) => void;
    setLimiterAmt: (value: number) => void;
  };
  getState: () => {
    masterOttAmt: number;
    masterDistAmt: number;
    masterLimiterAmt: number;
  };
}

export const useMasterChain = (engine: AudioEngine): UseMasterChainReturn => {
  const { postMessage, isReady } = engine;

  const [ottAmt, setOttAmt] = useState(0);
  const [distortionAmt, setDistortionAmt] = useState(0);
  const [limiterAmt, setLimiterAmt] = useState(1.5);

  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "masterOTT", value: ottAmt });
  }, [ottAmt, isReady, postMessage]);

  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "masterDistortion", value: distortionAmt });
  }, [distortionAmt, isReady, postMessage]);

  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "masterLimiter", value: limiterAmt });
  }, [limiterAmt, isReady, postMessage]);

  const uiProps: MasterStripProps = {
    layerKnobLabels: ["OTT", "Distortion", "Limiter"],
    knobValues: [
      mapCustomRangeToKnobRange(ottAmt, 0, 1),
      mapCustomRangeToKnobRange(distortionAmt, 0, 0.5),
      mapCustomRangeToKnobRange(limiterAmt, 1, 8),
    ],
    knobOnChanges: [
      (value) => setOttAmt(mapKnobRangeToCustomRange(value, 0, 1)),
      (value) => setDistortionAmt(mapKnobRangeToCustomRange(value, 0, 0.5)),
      (value) => setLimiterAmt(mapKnobRangeToCustomRange(value, 1, 8)),
    ],
  };

  const getState = () => ({
    masterOttAmt: ottAmt,
    masterDistAmt: distortionAmt,
    masterLimiterAmt: limiterAmt,
  });

  return {
    uiProps,
    setters: {
      setOttAmt,
      setDistAmt: setDistortionAmt,
      setLimiterAmt,
    },
    getState,
  };
};
