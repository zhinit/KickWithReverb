import { useEffect, useState } from "react";
import {
  kickNames,
  mapKnobRangeToCustomRange,
  mapCustomRangeToKnobRange,
} from "../utils/audioAssets";
import type { LayerStripProps } from "../types/types";
import type { AudioEngine } from "./useAudioEngine";

export interface UseKickLayerReturn {
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

export const useKickLayer = (engine: AudioEngine): UseKickLayerReturn => {
  const { postMessage, isReady, kickNameToIndex } = engine;

  const [sample, setSample] = useState(kickNames[0] || "Kick1");
  const [len, setLen] = useState(0.3);
  const [ottAmt, setOttAmt] = useState(0);
  const [distortionAmt, setDistortionAmt] = useState(0);

  useEffect(() => {
    if (!isReady) return;
    const index = kickNameToIndex[sample];
    if (index !== undefined) {
      postMessage({ type: "selectKickSample", index });
    }
  }, [sample, isReady, postMessage, kickNameToIndex]);

  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "kickRelease", value: len });
  }, [len, isReady, postMessage]);

  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "kickDistortion", value: distortionAmt });
  }, [distortionAmt, isReady, postMessage]);

  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "kickOTT", value: ottAmt });
  }, [ottAmt, isReady, postMessage]);

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
