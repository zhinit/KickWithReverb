import { useEffect } from "react";

export const useHotkeys = (transport: { handlePlayClick: Function }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        transport.handlePlayClick();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [transport.handlePlayClick]);
};
