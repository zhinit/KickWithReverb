import { useEffect } from "react";

export const useHotkeys = (
  transport: {
    handlePlayClick: Function;
    handleCueMouseDown: Function;
    handleCueMouseUp: Function;
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
