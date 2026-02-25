import { useEffect, useMemo, useState } from "react";

import {
  kickNames,
  mapKnobRangeToCustomRange,
  mapCustomRangeToKnobRange,
  mapKnobToLengthRatio,
  mapLengthRatioToKnob,
} from "../utils/audio-assets";

import type { LayerStripProps } from "../types/types";
import type { AudioEngine } from "./use-audio-engine";

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
  aiKickNameToIndex: Record<string, number> = {}
): UseKickLayerReturn => {
  // states
  const [sample, setSample] = useState(kickNames[0] ?? "");
  const [len, setLen] = useState(1.0);
  const [ottAmt, setOttAmt] = useState(0.0);
  const [distortionAmt, setDistortionAmt] = useState(0.0);

  // get items from audio engine hook
  const { postMessage, isReady, kickNameToIndex } = engine;

  // merge stock kicks map and AI kicks map
  const allKickNameToIndex = useMemo(
    () => ({ ...kickNameToIndex, ...aiKickNameToIndex }),
    [kickNameToIndex, aiKickNameToIndex]
  );

  // merge stock and ai kick names
  const allKickNames = useMemo(
    () => [...kickNames, ...Object.keys(aiKickNameToIndex).sort()],
    [aiKickNameToIndex]
  );

  // send current sample index to dsp
  // when the sample is changed or the sample map is updated
  useEffect(() => {
    if (!isReady) return;
    const index = allKickNameToIndex[sample];
    if (index !== undefined) {
      postMessage({ type: "selectKickSample", index });
    }
  }, [sample, isReady, postMessage, allKickNameToIndex]);

  // send kick len to DSP when knob is moved
  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "kickLength", value: len });
  }, [len, isReady, postMessage]);

  // send distortion amt to DSP when knob is moved
  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "kickDistortion", value: distortionAmt });
  }, [distortionAmt, isReady, postMessage]);

  // send ott amt to DSP when knob is moved
  useEffect(() => {
    if (!isReady) return;
    postMessage({ type: "kickOTT", value: ottAmt });
  }, [ottAmt, isReady, postMessage]);

  // create kick layer props to pass
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

  // create function to get the current state of the kick layer
  // which includes current sample and knob positions
  const getState = () => ({
    kickSample: sample,
    kickLen: len,
    kickDistAmt: distortionAmt,
    kickOttAmt: ottAmt,
  });

  // return helpful info so it can be accessed elsewhere
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
