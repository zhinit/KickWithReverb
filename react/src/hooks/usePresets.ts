import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import {
  getPresets,
  createPreset,
  updatePreset,
  deletePreset as apiDeletePreset,
} from "../utils/api";
import type { PresetData } from "../types/preset";

// Types for the layer setters and getState functions
interface KickSetters {
  setSample: (value: string) => void;
  setLen: (value: number) => void;
  setDistAmt: (value: number) => void;
  setOttAmt: (value: number) => void;
}

interface NoiseSetters {
  setSample: (value: string) => void;
  setLowPassFreq: (value: number) => void;
  setHighPassFreq: (value: number) => void;
  setVolume: (value: number) => void;
}

interface ReverbSetters {
  setSample: (value: string) => void;
  setLowPassFreq: (value: number) => void;
  setHighPassFreq: (value: number) => void;
  setVolume: (value: number) => void;
}

interface MasterSetters {
  setOttAmt: (value: number) => void;
  setDistAmt: (value: number) => void;
  setLimiterAmt: (value: number) => void;
}

interface TransportSetters {
  setBpm: (value: number) => void;
}

interface LayerRefs {
  kick: {
    setters: KickSetters;
    getState: () => {
      kickSample: string;
      kickLen: number;
      kickDistAmt: number;
      kickOttAmt: number;
    };
  };
  noise: {
    setters: NoiseSetters;
    getState: () => {
      noiseSample: string;
      noiseLowPassFreq: number;
      noiseHighPassFreq: number;
      noiseVolume: number;
    };
  };
  reverb: {
    setters: ReverbSetters;
    getState: () => {
      reverbSample: string;
      reverbLowPassFreq: number;
      reverbHighPassFreq: number;
      reverbVolume: number;
    };
  };
  master: {
    setters: MasterSetters;
    getState: () => {
      masterOttAmt: number;
      masterDistAmt: number;
      masterLimiterAmt: number;
    };
  };
  transport: {
    setters: TransportSetters;
    getState: () => {
      bpm: number;
    };
  };
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
  const { isAuthenticated } = useAuth();

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

  // Fetch presets when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setUserPresets([]);
      setSharedPresets([]);
      setCurrentPresetId(null);
      return;
    }

    const fetchPresets = async () => {
      setIsLoading(true);
      const [userRes] = await Promise.all([getPresets()]);

      if (userRes.ok && userRes.data) {
        const shared = userRes.data.filter((p) => p.isShared);
        const user = userRes.data.filter((p) => !p.isShared);
        setSharedPresets(shared);
        setUserPresets(user);
      }

      if (userRes.data) {
        const initPreset = userRes.data.find((p) => p.presetName == "Init");
        if (initPreset) {
          setCurrentPresetId(initPreset.id);
        }
      }

      setIsLoading(false);
    };

    fetchPresets();
  }, [isAuthenticated]);

  // Load a preset by applying its values to all layers
  const loadPreset = useCallback(
    (id: number) => {
      const allPresets = [...sharedPresets, ...userPresets];
      const preset = allPresets.find((p) => p.id === id);
      if (!preset) return;

      // Apply to kick layer
      layers.kick.setters.setSample(preset.kickSample);
      layers.kick.setters.setLen(preset.kickLen);
      layers.kick.setters.setDistAmt(preset.kickDistAmt);
      layers.kick.setters.setOttAmt(preset.kickOttAmt);

      // Apply to noise layer
      layers.noise.setters.setSample(preset.noiseSample);
      layers.noise.setters.setLowPassFreq(preset.noiseLowPassFreq);
      layers.noise.setters.setHighPassFreq(preset.noiseHighPassFreq);
      layers.noise.setters.setVolume(preset.noiseVolume);

      // Apply to reverb layer
      layers.reverb.setters.setSample(preset.reverbSample);
      layers.reverb.setters.setLowPassFreq(preset.reverbLowPassFreq);
      layers.reverb.setters.setHighPassFreq(preset.reverbHighPassFreq);
      layers.reverb.setters.setVolume(preset.reverbVolume);

      // Apply to master chain
      layers.master.setters.setOttAmt(preset.masterOttAmt);
      layers.master.setters.setDistAmt(preset.masterDistAmt);
      layers.master.setters.setLimiterAmt(preset.masterLimiterAmt);

      // Apply to transport
      layers.transport.setters.setBpm(preset.bpm);

      setCurrentPresetId(id);
    },
    [sharedPresets, userPresets, layers]
  );

  // Save current state as a preset
  const savePreset = useCallback(
    async (name: string): Promise<{ ok: boolean; error?: string }> => {
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
    [userPresets, sharedPresets, layers]
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
