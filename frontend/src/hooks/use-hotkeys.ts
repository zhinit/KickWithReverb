import { useEffect } from "react";

export const useHotkeys = (
  transport: {
    handlePlayClick: Function;
    handleCueMouseDown: Function;
    handleCueMouseUp: Function;
    setBPM: Function;
  },
  allLoaded: boolean
) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!allLoaded) return;
      switch (e.key) {
        case " ":
          transport.handlePlayClick();
          break;
        case "Enter":
          transport.handleCueMouseDown();
          break;
        case "=":
          transport.setBPM((bpm: number) => Math.min(bpm + 1, 365));
          break;
        case "-":
          transport.setBPM((bpm: number) => Math.max(bpm - 1, 110));
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!allLoaded) return;
      if (e.key === "Enter") {
        transport.handleCueMouseUp();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [transport.handlePlayClick, allLoaded]);
};
