import { useEffect, useMemo, useState } from "react";
import {
  kickNames,
  mapKnobRangeToCustomRange,
  mapCustomRangeToKnobRange,
  mapKnobToLengthRatio,
  mapLengthRatioToKnob,
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

export const useKickLayer = (
  engine: AudioEngine,
  aiKickNameToIndex: Record<string, number> = {},
): UseKickLayerReturn => {
  const { postMessage, isReady, kickNameToIndex } = engine;

  // Merge stock + AI kick maps for index lookup
  const allKickNameToIndex = useMemo(
    () => ({ ...kickNameToIndex, ...aiKickNameToIndex }),
    [kickNameToIndex, aiKickNameToIndex],
  );

  // Stock kicks + AI kicks (sorted) for the dropdown
  const allKickNames = useMemo(
    () => [...kickNames, ...Object.keys(aiKickNameToIndex).sort()],
    [aiKickNameToIndex],
  );

  const [sample, setSample] = useState(kickNames[0] || "Kick1");
  const [len, setLen] = useState(1.0);
  const [ottAmt, setOttAmt] = useState(0);
  const [distortionAmt, setDistortionAmt] = useState(0);

  useEffect(() => {
    if (!isReady) return;
    const index = allKickNameToIndex[sample];
    if (index !== undefined) {
      postMessage({ type: "selectKickSample", index });
    }
  }, [sample, isReady, postMessage, allKickNameToIndex]);

  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "kickLength", value: len });
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
    dropdownItems: allKickNames,
    dropdownValue: sample,
    dropdownOnChange: setSample,
    layerKnobLabels: ["Length", "Distortion", "OTT"],
    knobValues: [
      mapLengthRatioToKnob(len, 0.1, 1.0),
      mapCustomRangeToKnobRange(distortionAmt, 0, 0.5),
      mapCustomRangeToKnobRange(ottAmt, 0, 1),
    ],
    knobOnChanges: [
      (value) => setLen(mapKnobToLengthRatio(value, 0.1, 1.0)),
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
