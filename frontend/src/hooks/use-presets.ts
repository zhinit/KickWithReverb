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

// Default DAW state matches shared "Init" preset
const INIT_DEFAULTS = {
  kickSample: kickNames[0] || "Kick1",
  kickLen: 1.0,
  kickDistAmt: 0,
  kickOttAmt: 0,
  noiseSample: noiseNames[0] || "greyNoise",
  noiseLowPassFreq: 7000,
  noiseHighPassFreq: 30,
  noiseVolume: -70,
  reverbSample: irNames[0] || "JFKUnderpass",
  reverbLowPassFreq: 7000,
  reverbHighPassFreq: 30,
  reverbVolume: -6,
  masterOttAmt: 0,
  masterDistAmt: 0,
  masterLimiterAmt: 1.5,
  bpm: 140,
};

interface LayerRefs {
  kick: Pick<UseKickLayerReturn, "setters" | "getState">;
  noise: Pick<UseNoiseLayerReturn, "setters" | "getState">;
  reverb: Pick<UseReverbLayerReturn, "setters" | "getState">;
  master: Pick<UseMasterChainReturn, "setters" | "getState">;
  transport: Pick<UseTransportReturn, "setters" | "getState">;
}

export interface PresetItem {
  id: number;
  presetName: string;
  isShared: boolean;
}

export interface UsePresetsReturn {
  // State
  presets: PresetItem[];
  currentPresetId: number | null;
  currentPresetName: string;
  isLoading: boolean;
  // Actions
  loadPreset: (id: number) => void;
  savePreset: (name: string) => Promise<{ ok: boolean; error?: string }>;
  deleteCurrentPreset: () => Promise<{ ok: boolean; error?: string }>;
  nextPreset: () => void;
  prevPreset: () => void;
  // Helpers
  canDelete: boolean;
}

export const usePresets = (layers: LayerRefs): UsePresetsReturn => {
  const { userStatus } = useAuth();
  const isMember = userStatus === "member";

  const [userPresets, setUserPresets] = useState<PresetData[]>([]);
  const [sharedPresets, setSharedPresets] = useState<PresetData[]>([]);
  const [currentPresetId, setCurrentPresetId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Combined and sorted preset list for dropdown
  const presets: PresetItem[] = [
    ...sharedPresets
      .sort((a, b) => a.presetName.localeCompare(b.presetName))
      .map((p) => ({ id: p.id, presetName: p.presetName, isShared: true })),
    ...userPresets
      .sort((a, b) => a.presetName.localeCompare(b.presetName))
      .map((p) => ({ id: p.id, presetName: p.presetName, isShared: false })),
  ];

  // Current preset info
  const currentPreset = presets.find((p) => p.id === currentPresetId);
  const currentPresetName = currentPreset?.presetName ?? "Unsaved";
  const canDelete = currentPreset ? !currentPreset.isShared : false;

  // Stable ref to layers so applyValues doesn't change every render
  const layersRef = useRef(layers);
  layersRef.current = layers;

  // Apply a set of DAW values to all layers (stable — no deps)
  const applyValues = useCallback((values: typeof INIT_DEFAULTS) => {
    const l = layersRef.current;
    l.kick.setters.setSample(values.kickSample);
    l.kick.setters.setLen(values.kickLen);
    l.kick.setters.setDistAmt(values.kickDistAmt);
    l.kick.setters.setOttAmt(values.kickOttAmt);
    l.noise.setters.setSample(values.noiseSample);
    l.noise.setters.setLowPassFreq(values.noiseLowPassFreq);
    l.noise.setters.setHighPassFreq(values.noiseHighPassFreq);
    l.noise.setters.setVolume(values.noiseVolume);
    l.reverb.setters.setSample(values.reverbSample);
    l.reverb.setters.setLowPassFreq(values.reverbLowPassFreq);
    l.reverb.setters.setHighPassFreq(values.reverbHighPassFreq);
    l.reverb.setters.setVolume(values.reverbVolume);
    l.master.setters.setOttAmt(values.masterOttAmt);
    l.master.setters.setDistAmt(values.masterDistAmt);
    l.master.setters.setLimiterAmt(values.masterLimiterAmt);
    l.transport.setters.setBpm(values.bpm);
  }, []);

  const prevStatusRef = useRef(userStatus);

  // Fetch presets when authenticated or as guest, reset to Init on logout
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = userStatus;

    // Reset to defaults when logging out (member -> guest)
    if (prev === "member" && userStatus === "guest") {
      setUserPresets([]);
      setSharedPresets([]);
      setCurrentPresetId(null);
      applyValues(INIT_DEFAULTS);
    }

    const fetchPresets = async () => {
      setIsLoading(true);
      const [userRes] = await Promise.all([getPresets()]);

      if (userRes.ok && userRes.data) {
        const shared = userRes.data.filter((p) => p.isShared);
        const user = userRes.data.filter((p) => !p.isShared);
        setSharedPresets(shared);
        setUserPresets(user);

        // Load Init preset for members and guests (if available)
        if (isMember) {
          const initPreset = userRes.data.find((p) => p.presetName === "Init");
          if (initPreset) {
            applyValues(initPreset);
            setCurrentPresetId(initPreset.id);
          }
        } else if (shared.length > 0) {
          // For guests, try to load Init preset first, otherwise first shared preset
          const initPreset = shared.find((p) => p.presetName === "Init");
          if (initPreset) {
            applyValues(initPreset);
            setCurrentPresetId(initPreset.id);
          } else {
            applyValues(shared[0]);
            setCurrentPresetId(shared[0].id);
          }
        }
      }

      setIsLoading(false);
    };

    fetchPresets();
  }, [isMember, userStatus, applyValues]);

  // Load a preset by applying its values to all layers
  const loadPreset = useCallback(
    (id: number) => {
      const allPresets = [...sharedPresets, ...userPresets];
      const preset = allPresets.find((p) => p.id === id);
      if (!preset) return;

      applyValues(preset);
      setCurrentPresetId(id);
    },
    [sharedPresets, userPresets, applyValues]
  );

  // Save current state as a preset
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

      // Check if name matches a shared preset
      const sharedMatch = sharedPresets.find((p) => p.presetName === name);
      if (sharedMatch) {
        return { ok: false, error: "Cannot update shared presets" };
      }

      // Check if updating existing preset with same name
      const existingPreset = userPresets.find((p) => p.presetName === name);

      if (existingPreset) {
        const response = await updatePreset(existingPreset.id, presetData);
        if (response.ok && response.data) {
          setUserPresets((prev) =>
            prev.map((p) => (p.id === existingPreset.id ? response.data! : p))
          );
          setCurrentPresetId(existingPreset.id);
          return { ok: true };
        }
        return { ok: false, error: "Failed to update preset" };
      } else {
        const response = await createPreset(presetData);
        if (response.ok && response.data) {
          setUserPresets((prev) => [...prev, response.data!]);
          setCurrentPresetId(response.data.id);
          return { ok: true };
        }
        return { ok: false, error: "Failed to create preset" };
      }
    },
    [isMember, userPresets, sharedPresets, layers]
  );

  // Delete the current preset
  const deleteCurrentPreset = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    if (!currentPresetId || !canDelete) {
      return { ok: false, error: "Cannot delete this preset" };
    }

    const response = await apiDeletePreset(currentPresetId);
    if (response.ok) {
      setUserPresets((prev) => prev.filter((p) => p.id !== currentPresetId));
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
