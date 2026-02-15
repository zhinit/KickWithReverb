import "./knob.css";
import { useRef, useState } from "react";
import type { KnobProps } from "../types/types";
import knobImage from "../assets/knobs/marble-with-notch.png";

export const Knob = ({ value: propValue = 50, onChange, label }: KnobProps) => {
  const [value, setValue] = useState(propValue);
  const rotation = (value / 100) * 270 - 135; // maps 0 to 100 -> -135deg to 135deg

  const imgRef = useRef<HTMLImageElement>(null);
  const startY = useRef(0);
  const startValue = useRef(0);

  // Sync internal state when prop changes (e.g., loading a preset)
  const prevPropValue = useRef(propValue);
  if (propValue !== prevPropValue.current) {
    prevPropValue.current = propValue;
    setValue(propValue);
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    imgRef.current?.setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    startValue.current = value;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!imgRef.current?.hasPointerCapture(e.pointerId)) return;

    const deltaY = startY.current - e.clientY;
    const sensitivity = 0.5;
    const newValue = Math.min(
      100,
      Math.max(0, startValue.current + deltaY * sensitivity)
    );
    setValue(newValue);
    onChange?.(newValue);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    imgRef.current?.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="knob-container">
      <label>{label}</label>
      <img
        ref={imgRef}
        src={knobImage}
        alt="knob"
        className="knob"
        style={{ transform: `rotate(${rotation}deg)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
};
