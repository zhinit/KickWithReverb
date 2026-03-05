import { useEffect } from "react";

export const useHotkeys = (
  transport: {
    handlePlayClick: Function;
    handleCueMouseDown: Function;
    handleCueMouseUp: Function;
    setBPM: Function;
  },
  reverb: {
    setLowPassFreq: Function;
    setHighPassFreq: Function;
    setVolume: Function;
  },
  allLoaded: boolean,
) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!allLoaded) return;
      switch (e.key) {
        // transport hot heys
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

        // reverb hot keys
        case "a":
          reverb.setLowPassFreq((freq: number) => Math.max(freq * 0.9, 30));
          break;
        case "s":
          reverb.setLowPassFreq((freq: number) => Math.min(freq * 1.1, 7_000));
          break;
        case "d":
          reverb.setHighPassFreq((freq: number) => Math.max(freq * 0.9, 30));
          break;
        case "f":
          reverb.setHighPassFreq((freq: number) => Math.min(freq * 1.1, 7_000));
          break;
        case "g":
          reverb.setVolume((vol: number) => Math.max(vol - 1, -60));
          break;
        case "h":
          reverb.setVolume((vol: number) => Math.min(vol + 1, 0));
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
