import { useEffect } from "react";

export const useHotkeys = (transport: {
  handlePlayClick: Function;
  handleCueMouseDown: Function;
  handleCueMouseUp: Function;
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [transport.handlePlayClick]);
};
