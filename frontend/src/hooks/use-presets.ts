import { useState, useEffect, useCallback, useRef } from "react";

import { useAuth } from "./use-auth";

import {
  getPresets,
  createPreset,
  updatePreset,
  deletePreset as apiDeletePreset,
} from "../utils/api";

import { kickNames, noiseNames, irNames } from "../utils/audio-assets";

import type { PresetData } from "../types/preset";
import type { UseKickLayerReturn } from "./use-kick-layer";
import type { UseNoiseLayerReturn } from "./use-noise-layer";
import type { UseReverbLayerReturn } from "./use-reverb-layer";
import type { UseMasterChainReturn } from "./use-master-chain";
import type { UseTransportReturn } from "./use-transport";

// Default DAW state
const INIT_DEFAULTS = {
  kickSample: kickNames[0] ?? "",
  kickLen: 1.0,
  kickDistAmt: 0,
  kickOttAmt: 0,
  noiseSample: noiseNames[0] ?? "",
  noiseLowPassFreq: 7000,
  noiseHighPassFreq: 30,
  noiseVolume: -70,
  reverbSample: irNames[0] ?? "",
  reverbLowPassFreq: 7000,
  reverbHighPassFreq: 30,
  reverbVolume: -6,
  masterOttAmt: 0,
  masterDistAmt: 0,
  masterLimiterAmt: 1.5,
  bpm: 140,
};

// setters and getters for all layers
interface LayerRefs {
  kick: Pick<UseKickLayerReturn, "setters" | "getState">;
  noise: Pick<UseNoiseLayerReturn, "setters" | "getState">;
  reverb: Pick<UseReverbLayerReturn, "setters" | "getState">;
  master: Pick<UseMasterChainReturn, "setters" | "getState">;
  transport: Pick<UseTransportReturn, "setters" | "getState">;
}

// sort presets so stock come before user
const sortPresets = (data: PresetData[]): PresetData[] => [
  ...data
    .filter((p) => p.isShared)
    .sort((a, b) => a.presetName.localeCompare(b.presetName)),
  ...data
    .filter((p) => !p.isShared)
    .sort((a, b) => a.presetName.localeCompare(b.presetName)),
];

export interface UsePresetsReturn {
  presets: PresetData[];
  currentPresetId: number | null;
  currentPresetName: string;
  isLoading: boolean;
  loadPreset: (id: number) => void;
  savePreset: (name: string) => Promise<{ ok: boolean; error?: string }>;
  deleteCurrentPreset: () => Promise<{ ok: boolean; error?: string }>;
  nextPreset: () => void;
  prevPreset: () => void;
  canDelete: boolean;
}

export const usePresets = (layers: LayerRefs): UsePresetsReturn => {
  // states
  const { userStatus } = useAuth();
  const isMember = userStatus === "member"; // im here as a convienience
  const [presets, setPresets] = useState<PresetData[]>([]);
  const [currentPresetId, setCurrentPresetId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Current preset info
  const currentPreset = presets.find((p) => p.id === currentPresetId);
  const currentPresetName = currentPreset?.presetName ?? "Unsaved";
  const canDelete = currentPreset ? !currentPreset.isShared : false;

  // Stable ref to layers so applyValues doesn't change every render
  const layersRef = useRef(layers);
  layersRef.current = layers;

  // Apply a set of DAW values to all layers (stable — no deps)
  const applyPreset = useCallback((presetValues: typeof INIT_DEFAULTS) => {
    const l = layersRef.current;
    l.kick.setters.setSample(presetValues.kickSample);
    l.kick.setters.setLen(presetValues.kickLen);
    l.kick.setters.setDistAmt(presetValues.kickDistAmt);
    l.kick.setters.setOttAmt(presetValues.kickOttAmt);
    l.noise.setters.setSample(presetValues.noiseSample);
    l.noise.setters.setLowPassFreq(presetValues.noiseLowPassFreq);
    l.noise.setters.setHighPassFreq(presetValues.noiseHighPassFreq);
    l.noise.setters.setVolume(presetValues.noiseVolume);
    l.reverb.setters.setSample(presetValues.reverbSample);
    l.reverb.setters.setLowPassFreq(presetValues.reverbLowPassFreq);
    l.reverb.setters.setHighPassFreq(presetValues.reverbHighPassFreq);
    l.reverb.setters.setVolume(presetValues.reverbVolume);
    l.master.setters.setOttAmt(presetValues.masterOttAmt);
    l.master.setters.setDistAmt(presetValues.masterDistAmt);
    l.master.setters.setLimiterAmt(presetValues.masterLimiterAmt);
    l.transport.setters.setBpm(presetValues.bpm);
  }, []);

  // Fetch presets whenever auth status changes (login or logout)
  useEffect(() => {
    const fetchPresets = async () => {
      setIsLoading(true);
      setCurrentPresetId(null);

      const response = await getPresets();
      if (response.ok && response.data) {
        const sorted = sortPresets(response.data);
        setPresets(sorted);

        const initPreset =
          sorted.find((p) => p.isShared && p.presetName === "Init") ??
          sorted.find((p) => p.isShared);
        if (initPreset) {
          applyPreset(initPreset);
          setCurrentPresetId(initPreset.id);
        }
      }

      setIsLoading(false);
    };

    fetchPresets();
  }, [userStatus, applyPreset]);

  // Load a preset by applying its values to all layers
  const loadPreset = useCallback(
    (id: number) => {
      const preset = presets.find((p) => p.id === id);
      if (!preset) return;

      applyPreset(preset);
      setCurrentPresetId(id);
    },
    [presets, applyPreset]
  );

  // Save current state as preset
  const savePreset = useCallback(
    async (name: string): Promise<{ ok: boolean; error?: string }> => {
      // Guests cannot save presets
      if (!isMember) {
        return { ok: false, error: "Please log in" };
      }

      // Gather current state from all layers
      const kickState = layers.kick.getState();
      const noiseState = layers.noise.getState();
      const reverbState = layers.reverb.getState();
      const masterState = layers.master.getState();
      const transportState = layers.transport.getState();

      const presetData = {
        presetName: name,
        isShared: false,
        ...kickState,
        ...noiseState,
        ...reverbState,
        ...masterState,
        ...transportState,
      };

      // validate name does not match a shared preset
      const sharedMatch = presets.find(
        (p) => p.isShared && p.presetName === name
      );
      if (sharedMatch) {
        return { ok: false, error: "Cannot update shared presets" };
      }

      // Check if preset name already exists, then update or create preset
      const existingPreset = presets.find(
        (p) => !p.isShared && p.presetName === name
      );
      if (existingPreset) {
        const response = await updatePreset(existingPreset.id, presetData);
        if (response.ok && response.data) {
          setPresets((prev) =>
            sortPresets(
              prev.map((p) => (p.id === existingPreset.id ? response.data! : p))
            )
          );
          setCurrentPresetId(existingPreset.id);
          return { ok: true };
        }
        return { ok: false, error: "Failed to update preset" };
      } else {
        const response = await createPreset(presetData);
        if (response.ok && response.data) {
          setPresets((prev) => sortPresets([...prev, response.data!]));
          setCurrentPresetId(response.data.id);
          return { ok: true };
        }
        return { ok: false, error: "Failed to create preset" };
      }
    },
    [isMember, presets, layers]
  );

  // Delete the current preset
  const deleteCurrentPreset = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    if (!canDelete || !currentPresetId) {
      return { ok: false, error: "Cannot delete this preset" };
    }

    const response = await apiDeletePreset(currentPresetId);
    if (response.ok) {
      setPresets((prev) => prev.filter((p) => p.id !== currentPresetId));
      setCurrentPresetId(null);
      return { ok: true };
    }
    return { ok: false, error: "Failed to delete preset" };
  }, [currentPresetId, canDelete]);

  // Navigate to next preset
  const nextPreset = useCallback(() => {
    if (presets.length === 0) return;

    const currentIndex = presets.findIndex((p) => p.id === currentPresetId);
    const nextIndex = (currentIndex + 1) % presets.length;
    loadPreset(presets[nextIndex].id);
  }, [presets, currentPresetId, loadPreset]);

  // Navigate to previous preset
  const prevPreset = useCallback(() => {
    if (presets.length === 0) return;

    const currentIndex = presets.findIndex((p) => p.id === currentPresetId);
    const prevIndex = currentIndex <= 0 ? presets.length - 1 : currentIndex - 1;
    loadPreset(presets[prevIndex].id);
  }, [presets, currentPresetId, loadPreset]);

  return {
    presets,
    currentPresetId,
    currentPresetName,
    isLoading,
    loadPreset,
    savePreset,
    deleteCurrentPreset,
    nextPreset,
    prevPreset,
    canDelete,
  };
};
