import { useEffect, useRef, useState } from "react";
import type { KnobProps } from "../types/types"
import knobImage from "../assets/knobs/whiteMarbleKnob2.png";

export const Knob = ({ value: initialValue = 50, onChange, label }: KnobProps) => {
  const [value, setValue] = useState(initialValue);
  const [isDragging, setIsDragging] = useState(false);
  const rotation = (value / 100) * 270 - 135; // maps 0 to 100 -> -135deg to 135deg

  const startY = useRef(0);
  const startValue = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const deltaY = startY.current - e.clientY;
      const sensitivity = 0.5;
      const newValue = Math.min(
        100,
        Math.max(0, startValue.current + deltaY * sensitivity)
      );
      setValue(newValue);
      onChange?.(newValue);
    };

    const handlePointerUp = () => setIsDragging(false);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging]);

  return (
    <div className="knob-container">
      <label>{label}</label>
      <img
        src={knobImage}
        alt="knob"
        className="knob"
        style={{ transform: `rotate(${rotation}deg)` }}
        onPointerDown={handlePointerDown}
      />
    </div>
  );
};