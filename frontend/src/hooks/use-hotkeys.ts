import { useEffect } from "react";

export const useHotkeys = (
  transport: {
    handlePlayClick: Function;
    handleCueMouseDown: Function;
    handleCueMouseUp: Function;
    setBPM: Function;
  },
  kick: {
    setLen: Function;
    setDistAmt: Function;
    setOttAmt: Function;
  },
  noise: {
    setLowPassFreq: Function;
    setHighPassFreq: Function;
    setVolume: Function;
  },
  reverb: {
    setLowPassFreq: Function;
    setHighPassFreq: Function;
    setVolume: Function;
  },
  master: {
    setOttAmt: Function;
    setDistAmt: Function;
    setLimiterAmt: Function;
  },
  allLoaded: boolean
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

        // kick layer hot keys
        case "q":
          kick.setLen((len: number) => Math.max(len * 0.95, 0.1));
          break;
        case "w":
          kick.setLen((len: number) => Math.min(len * 1.05, 1));
          break;
        case "a":
          kick.setDistAmt((amt: number) => Math.max(amt - 0.01, 0));
          break;
        case "s":
          kick.setDistAmt((amt: number) => Math.min(amt + 0.01, 0.5));
          break;
        case "z":
          kick.setOttAmt((amt: number) => Math.max(amt - 0.02, 0));
          break;
        case "x":
          kick.setOttAmt((amt: number) => Math.min(amt + 0.02, 1));
          break;

        // noise layer hot keys
        case "e":
          noise.setLowPassFreq((freq: number) => Math.max(freq * 0.9, 30));
          break;
        case "r":
          noise.setLowPassFreq((freq: number) => Math.min(freq * 1.1, 7_000));
          break;
        case "d":
          noise.setHighPassFreq((freq: number) => Math.max(freq * 0.9, 30));
          break;
        case "f":
          noise.setHighPassFreq((freq: number) => Math.min(freq * 1.1, 7_000));
          break;
        case "c":
          noise.setVolume((vol: number) => Math.max(vol - 1, -70));
          break;
        case "v":
          noise.setVolume((vol: number) => Math.min(vol + 1, -6));
          break;

        // reverb layer hot keys
        case "t":
          reverb.setLowPassFreq((freq: number) => Math.max(freq * 0.9, 30));
          break;
        case "y":
          reverb.setLowPassFreq((freq: number) => Math.min(freq * 1.1, 7_000));
          break;
        case "g":
          reverb.setHighPassFreq((freq: number) => Math.max(freq * 0.9, 30));
          break;
        case "h":
          reverb.setHighPassFreq((freq: number) => Math.min(freq * 1.1, 7_000));
          break;
        case "b":
          reverb.setVolume((vol: number) => Math.max(vol - 1, -60));
          break;
        case "n":
          reverb.setVolume((vol: number) => Math.min(vol + 1, 0));
          break;

        // master layer hot keys
        case "u":
          master.setOttAmt((amt: number) => Math.max(amt - 0.02, 0));
          break;
        case "i":
          master.setOttAmt((amt: number) => Math.min(amt + 0.02, 1));
          break;
        case "j":
          master.setDistAmt((amt: number) => Math.max(amt - 0.01, 0));
          break;
        case "k":
          master.setDistAmt((amt: number) => Math.min(amt + 0.01, 0.5));
          break;
        case "m":
          master.setLimiterAmt((amt: number) => Math.max(amt - 0.1, 1));
          break;
        case ",":
          master.setLimiterAmt((amt: number) => Math.min(amt + 0.1, 8));
          break;

        // combo hot keys
        case "[":
          kick.setOttAmt((amt: number) => Math.max(amt - 0.02, 0));
          master.setOttAmt((amt: number) => Math.max(amt - 0.02, 0));
          reverb.setVolume((vol: number) => Math.min(vol + 1, 0));
          break;
        case "]":
          kick.setOttAmt((amt: number) => Math.min(amt + 0.02, 1));
          master.setOttAmt((amt: number) => Math.min(amt + 0.02, 1));
          reverb.setVolume((vol: number) => Math.max(vol - 1, -60));
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
