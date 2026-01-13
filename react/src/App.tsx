import { useEffect, useRef, useState, type MouseEventHandler } from "react";
import * as Tone from "tone";
import knobImage from "./assets/whiteMarbleKnob.png";
import cueButtonOff from "./assets/cuebuttonOff.png";
import cueButtonOn from "./assets/cuebuttonOn.png";
import playButtonOff from "./assets/playbuttonOff.png";
import playButtonOn from "./assets/playbuttonOn.png";
import kick1 from "./assets/kicks/Kick1.wav";
import kick2 from "./assets/kicks/Kick2.wav";
import kick3 from "./assets/kicks/Kick3.wav";
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

interface ControlStripProps {
  bpm: number;
  isPlayOn: boolean;
  isCuePressed: boolean;
  handleCueMouseDown: MouseEventHandler;
  handleCueMouseUp: MouseEventHandler;
  handlePlayClick: MouseEventHandler;
  setBPM: Function;
}

const ControlStrip = ({
  bpm,
  isPlayOn,
  isCuePressed,
  handleCueMouseDown,
  handleCueMouseUp,
  handlePlayClick,
  setBPM,
}: ControlStripProps) => {
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
    {layerKnobLabels.map((knobLabel, index) => (
      <div key={index}>
        <Knob label={knobLabel} />
      </div>
    ))}
  </div>
);

const SoundUnit = () => {
  return (
    <div className="sound-unit">
      <LayerStrip
        layerLabel="Kick Layer"
        dropdownItems={["Kick1", "Kick2", "Kick3"]}
        layerKnobLabels={["Length", "Distortion", "OTT"]}
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
};

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

const Daw = () => {
  // control strip states and refs
  const loopRef = useRef<Tone.Loop | null>(null);

  const [isPlayOn, setIsPlayOn] = useState(false);
  const [isCuePressed, setIsCuePressed] = useState(false);
  const [bpm, setBPM] = useState(140);

  // kick layer states and refs
  const kickSamplerRef = useRef<Tone.Sampler | null>(null);
  const kickEnvelopeRef = useRef<Tone.AmplitudeEnvelope | null>(null);
  const kickDistortionRef = useRef<Tone.Distortion | null>(null);
  const kickOttEqRef = useRef<Tone.EQ3 | null>(null);
  const kickOttMbRef = useRef<Tone.MultibandCompressor | null>(null);
  const kickOttGainRef = useRef<Tone.Gain | null>(null);

  const [kickLen, setKickLen] = useState(0.5);
  const [kickOttAmt, setKickOttAmt] = useState(0);
  const [kickDistortionAmt, setKickDistortionAmt] = useState(0);

  // noise layer states and refs
  const noiseRef = useRef<Tone.Noise | null>(null);
  const noiseDistortionRef = useRef<Tone.Distortion | null>(null);
  const noiseLowPassRef = useRef<Tone.Filter | null>(null);
  const noiseHighPassRef = useRef<Tone.Filter | null>(null);

  const [noiseDistortionAmt, setNoiseDistortionAmt] = useState(0);
  const [noiseLowPassFreq, setNoiseLowPassFreq] = useState(200);
  const [noiseHighPassFreq, setNoiseHighPassFreq] = useState(30);

  // reverb layer states and refs
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const reverbLowPassRef = useRef<Tone.Filter | null>(null);
  const reverbHighPassRef = useRef<Tone.Filter | null>(null);

  const [reverbLowPassFreq, setReverbLowPassFreq] = useState(500);
  const [reverbHighPassFreq, setReverbHighPassFreq] = useState(100);
  const [reverbDecay, setReverbDecay] = useState(3.0);

  // master chain states and refs
  const masterOttEqRef = useRef<Tone.EQ3 | null>(null);
  const masterOttMbRef = useRef<Tone.MultibandCompressor | null>(null);
  const masterOttGainRef = useRef<Tone.Gain | null>(null);
  const masterDistortionRef = useRef<Tone.Distortion | null>(null);
  const masterLimiterGainRef = useRef<Tone.Gain | null>(null);
  const masterLimiterRef = useRef<Tone.Limiter | null>(null);

  const [masterOttAmt, setMasterOttAmt] = useState(0);
  const [masterDistortionAmt, setMasterDistortionAmt] = useState(0);
  const [masterLimiterAmt, setMasterLimiterAmt] = useState(0.5);

  // mount and unmount effect
  useEffect(() => {
    // initialize kick layer
    kickSamplerRef.current = new Tone.Sampler({
      urls: {
        C1: kick1,
        C2: kick2,
        C3: kick3,
      },
    });
    kickEnvelopeRef.current = new Tone.AmplitudeEnvelope({
      attack: 0.1,
      decay: 0.2,
      sustain: 1.0,
      release: 0.8,
    });
    kickDistortionRef.current = new Tone.Distortion(kickDistortionAmt);
    kickOttEqRef.current = new Tone.EQ3({});
    kickOttMbRef.current = new Tone.MultibandCompressor({
      lowFrequency: 200,
      highFrequency: 1300,
    });
    kickOttGainRef.current = new Tone.Gain(1);

    kickSamplerRef.current.connect(kickEnvelopeRef.current);
    kickEnvelopeRef.current.connect(kickDistortionRef.current);
    kickDistortionRef.current.connect(kickOttEqRef.current);
    kickOttEqRef.current.connect(kickOttMbRef.current);
    kickOttMbRef.current.connect(kickOttGainRef.current);
    kickOttGainRef.current.toDestination();

    // initialize noise layer
    noiseRef.current = new Tone.Noise("brown");
    noiseRef.current.volume.value = -10;

    noiseDistortionRef.current = new Tone.Distortion(noiseDistortionAmt);
    noiseLowPassRef.current = new Tone.Filter(noiseLowPassFreq, "lowpass");
    noiseHighPassRef.current = new Tone.Filter(noiseHighPassFreq, "highpass");

    noiseRef.current.connect(noiseDistortionRef.current);
    noiseDistortionRef.current.connect(noiseLowPassRef.current);
    noiseLowPassRef.current.connect(noiseHighPassRef.current);
    noiseHighPassRef.current.toDestination();

    // initialize reverb layer
    reverbRef.current = new Tone.Reverb(reverbDecay);
    reverbRef.current.wet.value = 1;
    reverbLowPassRef.current = new Tone.Filter(reverbLowPassFreq, "lowpass");
    reverbHighPassRef.current = new Tone.Filter(reverbHighPassFreq, "highpass");

    kickOttGainRef.current.connect(reverbRef.current);
    noiseHighPassRef.current.connect(reverbRef.current);
    reverbRef.current.connect(reverbLowPassRef.current);
    reverbLowPassRef.current.connect(reverbHighPassRef.current);
    reverbHighPassRef.current.toDestination();

    return () => {
      kickSamplerRef.current?.dispose();
      noiseRef.current?.dispose();
    };
  }, []);

  // bpm change effect
  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  const handlePlayClick = async () => {
    const newPlayState = !isPlayOn;
    setIsPlayOn(newPlayState);

    if (newPlayState) {
      await Tone.start();

      Tone.getTransport().bpm.value = bpm;

      loopRef.current = new Tone.Loop((time) => {
        kickSamplerRef.current?.triggerAttackRelease("C1", 0.5, time);
        kickEnvelopeRef.current?.triggerAttackRelease(0.5, time);
      }, "4n").start(0);

      noiseRef.current?.start();

      Tone.getTransport().start();
    } else {
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current.dispose();
        loopRef.current = null;
      }
      noiseRef.current?.stop();
      Tone.getTransport().stop();
    }
  };

  const handleCueMouseDown = async () => {
    setIsCuePressed(true);
    await Tone.start();
    kickSamplerRef.current?.triggerAttackRelease("C1", 0.5);
    kickEnvelopeRef.current?.triggerAttackRelease(0.5);
  };

  const handleCueMouseUp = () => {
    setIsCuePressed(false);
  };

  return (
    <div className="daw">
      <h1>KICK WITH REVERB</h1>
      <h2>
        Fully featured fully sophisticated DAW <br />
        for the modern tik tok techno purist.
      </h2>
      <ControlStrip
        bpm={bpm}
        isPlayOn={isPlayOn}
        isCuePressed={isCuePressed}
        handleCueMouseDown={handleCueMouseDown}
        handleCueMouseUp={handleCueMouseUp}
        handlePlayClick={handlePlayClick}
        setBPM={setBPM}
      />
      <SoundUnit />
      <MasterStrip />
    </div>
  );
};

function App() {
  return (
    <>
      <Daw />
    </>
  );
}

export default App;
