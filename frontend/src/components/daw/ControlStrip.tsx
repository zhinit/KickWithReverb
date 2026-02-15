import "./control-strip.css";
import { useState, useEffect } from "react";
import type { ControlStripProps } from "../../types/types";
import cueButtonOff from "../../assets/buttons/cue-button-off.png";
import cueButtonOn from "../../assets/buttons/cue-button-on.png";
import playButtonOff from "../../assets/buttons/play-button-off.png";
import playButtonOn from "../../assets/buttons/play-button-on.png";

export const ControlStrip = ({
  bpm,
  isPlayOn,
  isCuePressed,
  handleCueMouseDown,
  handleCueMouseUp,
  handlePlayClick,
  setBPM,
}: ControlStripProps) => {
  const [inputValue, setInputValue] = useState(bpm.toString());

  // Sync inputValue when bpm prop changes (e.g., from preset load)
  useEffect(() => {
    setInputValue(bpm.toString());
  }, [bpm]);

  const handleCuePointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    handleCueMouseDown();
  };

  const handleCuePointerUp = (e: React.PointerEvent<HTMLImageElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    handleCueMouseUp();
  };

  const handleLocalInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Update BPM in real-time if valid
    const numValue = Number(value);
    if (!isNaN(numValue) && numValue >= 60 && numValue <= 365) {
      setBPM(numValue);
    }
  };

  const handleBlur = () => {
    const numValue = Number(inputValue);
    if (!isNaN(numValue)) {
      const clampedValue = Math.min(365, Math.max(110, numValue));
      setBPM(clampedValue);
      setInputValue(clampedValue.toString());
    } else {
      // If invalid, reset to current BPM
      setInputValue(bpm.toString());
    }
  };

  const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur(); // Triggers handleBlur
    }
  };

  return (
    <div className="control-strip">
      <img
        className="cue-button"
        src={isCuePressed ? cueButtonOn : cueButtonOff}
        alt="CUE"
        draggable={false}
        onPointerDown={handleCuePointerDown}
        onPointerUp={handleCuePointerUp}
      />
      <img
        className="play-button"
        src={isPlayOn ? playButtonOn : playButtonOff}
        alt="PLAY"
        draggable={false}
        onClick={handlePlayClick}
      />
      <input
        className="bpm-box"
        type="number"
        value={inputValue}
        min="110"
        max="365" 
        onChange={handleLocalInput}
        onBlur={handleBlur}
        onKeyDown={handleEnter}
      />
    </div>
  );
};