import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import knobImage from "./assets/whiteMarbleKnob.png";
import cueButtonOff from "./assets/cuebuttonOff.png";
import cueButtonOn from "./assets/cuebuttonOn.png";
import playButtonOff from "./assets/playbuttonOff.png";
import playButtonOn from "./assets/playbuttonOn.png";
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
    e.preventDefault();
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
      <img
        src={knobImage}
        alt="knob"
        className="knob"
        style={{ transform: `rotate(${rotation}deg)` }}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

interface SelectahProps {
  dropdownItems: Array<string>;
}

const Selectah = ({ dropdownItems }: SelectahProps) => (
  <select>
    {dropdownItems.map((item, i) => (
      <option key={i} value={item}>
        {item}
      </option>
    ))}
  </select>
);

const ControlStrip = () => {
  const [isPlayOn, setIsPlayOn] = useState(false);
  const [isCuePressed, setIsCuePressed] = useState(false);
  const [bpm, setBPM] = useState(140);

  const playerRef = useRef<Tone.Player | null>(null);
  const noiseRef = useRef<Tone.Noise | null>(null);
  const loopRef = useRef<Tone.Loop | null>(null);

  // mount and unmount effect
  useEffect(() => {
    playerRef.current = new Tone.Player({
      url: "/src/assets/Kick1.wav",
    }).toDestination();

    noiseRef.current = new Tone.Noise("white");

    return () => {
      playerRef.current?.dispose();
    };
  }, []);

  // bpm change effect
  useEffect(() => {
    Tone.Transport.bpm.value = bpm;
  }, [bpm]);

  const handlePlayClick = async () => {
    const newPlayState = !isPlayOn;
    setIsPlayOn(newPlayState);

    if (newPlayState) {
      await Tone.start();
      Tone.Transport.bpm.value = bpm;

      loopRef.current = new Tone.Loop((time) => {
        playerRef.current?.start(time);
      }, "4n").start(0);

      Tone.Transport.start();
    } else {
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current.dispose();
        loopRef.current = null;
      }
      Tone.Transport.stop();
    }
  };

  const handleCueMouseDown = async () => {
    setIsCuePressed(true);
    await Tone.start();
    playerRef.current?.start();
  };

  const handleCueMouseUp = () => {
    setIsCuePressed(false);
  };

  return (
    <div className="control-strip">
      <img
        className="cue-button"
        src={isCuePressed ? cueButtonOn : cueButtonOff}
        alt="CUE"
        onMouseDown={handleCueMouseDown}
        onMouseUp={handleCueMouseUp}
      />
      <img
        className="play-button"
        src={isPlayOn ? playButtonOn : playButtonOff}
        alt="PLAY"
        onClick={handlePlayClick}
      />
      <input
        className="bpm-box"
        type="number"
        value={bpm}
        onChange={(e) => setBPM(Number(e.target.value))}
      />
    </div>
  );
};

interface LayerStripProps {
  layerLabel: string;
  dropdownItems: Array<string>;
  layerKnobLabels: Array<string>;
}

const LayerStrip = ({
  layerLabel,
  dropdownItems,
  layerKnobLabels,
}: LayerStripProps) => (
  <div className="layer-strip">
    <label>{layerLabel}</label>
    <div>
      <Selectah dropdownItems={dropdownItems} />
    </div>
    {layerKnobLabels.map((knobLabel) => (
      <div>
        <Knob label={knobLabel} />
      </div>
    ))}
  </div>
);

const SoundUnit = () => (
  <div className="sound-unit">
    <LayerStrip
      layerLabel="Kick Layer"
      dropdownItems={["Kick1", "Kick2", "Kick3"]}
      layerKnobLabels={["Length", "Transient", "Distortion"]}
    />
    <LayerStrip
      layerLabel="Noise Layer"
      dropdownItems={["white", "charcoal", "gray", "black"]}
      layerKnobLabels={["Low Pass", "High Pass", "Comb"]}
    />
    <LayerStrip
      layerLabel="Reverb Layer"
      dropdownItems={["Club", "Cathedral", "Oil Tank"]}
      layerKnobLabels={["Low Pass", "High Pass", "Size"]}
    />
  </div>
);

const MasterStrip = () => (
  <>
    <h2>Fully Deep Mastering Chain</h2>
    <div className="master-strip-knobs">
      <Knob label="OTT" />
      <Knob label="Distortion" />
      <Knob label="Limiter" />
    </div>
  </>
);

const Daw = () => (
  <div className="daw">
    <h1>KICK WITH REVERB</h1>
    <h2>
      Fully featured fully sophisticated DAW <br />
      for the modern tik tok techno purist.
    </h2>
    <ControlStrip />
    <SoundUnit />
    <MasterStrip />
  </div>
);

function App() {
  return (
    <>
      <Daw />
    </>
  );
}

export default App;
