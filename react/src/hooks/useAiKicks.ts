import { useEffect, useRef, useState } from "react";
import type { AudioEngine } from "./useAudioEngine";
import type { KickData } from "../types/genKick";
import { getKicks } from "../utils/api";
import { useAuth } from "./useAuth";

export interface AiKicksReturn {
  aiKicks: KickData[];
  aiKickNameToIndex: Record<string, number>;
  isLoading: boolean;
  remainingGensToday: number;
  totalGensCount: number;
}

export const useAiKicks = (engine: AudioEngine): AiKicksReturn => {
  const { isReady, loadKickSample } = engine;
  const { userStatus } = useAuth();

  const [aiKicks, setAiKicks] = useState<KickData[]>([]);
  const [aiKickNameToIndex, setAiKickNameToIndex] = useState<
    Record<string, number>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [remainingGensToday, setRemainingGensToday] = useState(0);
  const [totalGensCount, setTotalGensCount] = useState(0);
  const hasLoadedRef = useRef(false);

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

  return {
    aiKicks,
    aiKickNameToIndex,
    isLoading,
    remainingGensToday,
    totalGensCount,
  };
};
