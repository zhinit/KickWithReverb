import { useEffect, useRef, useState } from "react";
import "./App.css";

interface KnobProps {
  value?: number;
  onChange?: (value: number) => void;
  label: string;
}

const Knob = ({ value: initialValue = 50, onChange, label }: KnobProps) => {
  const [value, setValue] = useState(initialValue);
  const [isDragging, setIsDragging] = useState(false);
  const rotation = (value / 100) * 270 - 135; // maps 0 to 100 -> -135deg to 135deg

  const startY = useRef(0);
  const startValue = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startY.current - e.clientY;
      const sensitivity = 0.5;
      const newValue = Math.min(
        100,
        Math.max(0, startValue.current + deltaY * sensitivity)
      );
      setValue(newValue);
      onChange?.(newValue);
    };

    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="knob-container">
      <label>{label}</label>
      <div
        className="knob"
        style={{ transform: `rotate( ${rotation}deg )` }}
        onMouseDown={handleMouseDown}
      >
        <div className="knob-line"></div>
      </div>
    </div>
  );
};

const Selectah = () => (
  <select>
    <option>option 1</option>
    <option>option 2</option>
    <option>option 3</option>
  </select>
);

const ControlStrip = () => (
  <div className="control-strip">
    <button>CUE</button>
    <button>PLAY</button>
    <button>BPM</button>
  </div>
);

const LayerStrip = () => (
  <div className="layer-strip">
    <div>
      <Selectah />
    </div>
    <div>
      <Knob label="label1" />
    </div>
    <div>
      <Knob label="label2" />
    </div>
    <div>
      <Knob label="label3" />
    </div>
  </div>
);

const SoundUnit = () => (
  <div className="sound-unit">
    <LayerStrip />
    <LayerStrip />
    <LayerStrip />
  </div>
);

const MasterStrip = () => (
  <>
    <p>Fully Deep Mastering Chain</p>
    <div className="master-strip-knobs">
      <Knob label="OTT" />
      <Knob label="Distortion" />
      <Knob label="Limiter" />
    </div>
  </>
);

const Daw = () => (
  <>
    <h1>KICK WITH REVERB</h1>
    <h2>Fully featured fully sophisticated DAW</h2>
    <h2>for the modern tik tok techno purist.</h2>
    <ControlStrip />
    <SoundUnit />
    <MasterStrip />
  </>
);

function App() {
  return (
    <>
      <Daw />
    </>
  );
}

export default App;
