import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioEngine } from "./useAudioEngine";
import type { KickData } from "../types/genKick";
import { getKicks, generateKick, deleteKick } from "../utils/api";
import { useAuth } from "./useAuth";

export interface AiKicksReturn {
  aiKicks: KickData[];
  aiKickNameToIndex: Record<string, number>;
  isLoading: boolean;
  isGenerating: boolean;
  remainingGensToday: number;
  totalGensCount: number;
  generate: () => Promise<{ ok: boolean; error?: string; kick?: KickData; wasmIndex?: number }>;
  remove: (
    id: number,
    confirm?: boolean,
  ) => Promise<{ ok: boolean; status?: number; error?: string; presets?: string[] }>;
}

export const useAiKicks = (engine: AudioEngine): AiKicksReturn => {
  const { isReady, loadKickSample } = engine;
  const { userStatus } = useAuth();

  const [aiKicks, setAiKicks] = useState<KickData[]>([]);
  const [aiKickNameToIndex, setAiKickNameToIndex] = useState<
    Record<string, number>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [remainingGensToday, setRemainingGensToday] = useState(0);
  const [totalGensCount, setTotalGensCount] = useState(0);
  const hasLoadedRef = useRef(false);

  // Fetch and load all AI kicks on startup
  useEffect(() => {
    if (!isReady || userStatus !== "member" || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    async function loadAiKicks() {
      setIsLoading(true);

      const response = await getKicks();
      if (!response.ok || !response.data) {
        setIsLoading(false);
        return;
      }

      const { kicks, remainingGensToday, totalGensCount } = response.data;
      setRemainingGensToday(remainingGensToday);
      setTotalGensCount(totalGensCount);

      const nameToIndex: Record<string, number> = {};
      for (const kick of kicks) {
        const index = await loadKickSample(kick.audioUrl);
        nameToIndex[kick.name] = index;
      }

      setAiKicks(kicks);
      setAiKickNameToIndex(nameToIndex);
      setIsLoading(false);
    }

    loadAiKicks().catch(console.error);
  }, [isReady, userStatus, loadKickSample]);

  // Generate a new AI kick
  const generate = useCallback(async () => {
    setIsGenerating(true);

    const response = await generateKick();
    if (!response.ok || !response.data) {
      setIsGenerating(false);
      const error = (response.data as { error?: string } | null)?.error
        ?? "Generation failed";
      return { ok: false, error };
    }

    const { id, name, audioUrl, remainingGensToday, totalGensCount } =
      response.data;

    // Decode and load audio into WASM
    const index = await loadKickSample(audioUrl);

    const newKick: KickData = { id, name, audioUrl };
    setAiKicks((prev) => [...prev, newKick]);
    setAiKickNameToIndex((prev) => ({ ...prev, [name]: index }));
    setRemainingGensToday(remainingGensToday);
    setTotalGensCount(totalGensCount);
    setIsGenerating(false);

    return { ok: true, kick: newKick, wasmIndex: index };
  }, [loadKickSample]);

  // Delete an AI kick
  const remove = useCallback(
    async (id: number, confirm = false) => {
      const response = await deleteKick(id, confirm);

      // 409 = presets affected, needs confirmation
      if (response.status === 409) {
        const data = response.data as {
          error: string;
          presets: string[];
        };
        return { ok: false, status: 409, presets: data.presets };
      }

      if (!response.ok) {
        const error = (response.data as { error?: string } | null)?.error
          ?? "Delete failed";
        return { ok: false, error };
      }

      const data = response.data as { totalCount: number };

      // Remove from state
      setAiKicks((prev) => prev.filter((k) => k.id !== id));
      setAiKickNameToIndex((prev) => {
        const kick = aiKicks.find((k) => k.id === id);
        if (!kick) return prev;
        const next = { ...prev };
        delete next[kick.name];
        return next;
      });
      setTotalGensCount(data.totalCount);

      return { ok: true };
    },
    [aiKicks],
  );

  return {
    aiKicks,
    aiKickNameToIndex,
    isLoading,
    isGenerating,
    remainingGensToday,
    totalGensCount,
    generate,
    remove,
  };
};
