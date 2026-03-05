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

        // kick layer hot keys
        case "1":
          kick.setLen((len: number) => Math.max(len * 0.9, 0.1));
          break;
        case "2":
          kick.setLen((len: number) => Math.min(len * 1.1, 1));
          break;
        case "3":
          kick.setDistAmt((amt: number) => Math.max(amt - 0.01, 0));
          break;
        case "4":
          kick.setDistAmt((amt: number) => Math.min(amt + 0.01, 0.5));
          break;
        case "5":
          kick.setOttAmt((amt: number) => Math.max(amt - 0.02, 0));
          break;
        case "6":
          kick.setOttAmt((amt: number) => Math.min(amt + 0.02, 1));
          break;

        // noise layer hot keys
        case "q":
          noise.setLowPassFreq((freq: number) => Math.max(freq * 0.9, 30));
          break;
        case "w":
          noise.setLowPassFreq((freq: number) => Math.min(freq * 1.1, 7_000));
          break;
        case "e":
          noise.setHighPassFreq((freq: number) => Math.max(freq * 0.9, 30));
          break;
        case "r":
          noise.setHighPassFreq((freq: number) => Math.min(freq * 1.1, 7_000));
          break;
        case "t":
          noise.setVolume((vol: number) => Math.max(vol - 1, -60));
          break;
        case "y":
          noise.setVolume((vol: number) => Math.min(vol + 1, 0));
          break;

        // reverb layer hot keys
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

        // master layer hot keys
        case "z":
          master.setOttAmt((amt: number) => Math.max(amt - 0.02, 0));
          break;
        case "x":
          master.setOttAmt((amt: number) => Math.min(amt + 0.02, 1));
          break;
        case "c":
          master.setDistAmt((amt: number) => Math.max(amt - 0.01, 0));
          break;
        case "v":
          master.setDistAmt((amt: number) => Math.min(amt + 0.01, 0.5));
          break;
        case "b":
          master.setLimiterAmt((amt: number) => Math.max(amt - 0.1, 1));
          break;
        case "n":
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
