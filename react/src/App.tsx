import { useEffect, useRef, useState, type MouseEventHandler } from "react";
import * as Tone from "tone";
import knobImage from "./assets/knobs/whiteMarbleKnob.png";
import cueButtonOff from "./assets/buttons/cuebuttonOff.png";
import cueButtonOn from "./assets/buttons/cuebuttonOn.png";
import playButtonOff from "./assets/buttons/playbuttonOff.png";
import playButtonOn from "./assets/buttons/playbuttonOn.png";
import "./App.css";

// Import all kick files
const kickModules = import.meta.glob("./assets/kicks/*.wav", { eager: true });

const kickFiles: Record<string, string> = {};
Object.keys(kickModules).forEach((path) => {
  const fileName = path.split("/").pop()?.replace(".wav", "") || "";
  kickFiles[fileName] = (kickModules[path] as { default: string }).default;
});

const kickNames = Object.keys(kickFiles).sort();

// Import all noise files using import.meta.glob
const noiseModules = import.meta.glob("./assets/noises/*.mp3", { eager: true });

const noiseFiles: Record<string, string> = {};
Object.keys(noiseModules).forEach((path) => {
  const fileName = path.split("/").pop()?.replace(".mp3", "") || "";
  noiseFiles[fileName] = (noiseModules[path] as { default: string }).default;
});

const noiseNames = Object.keys(noiseFiles).sort();

// Import all IR files
const irModules = import.meta.glob("./assets/IRs/*.wav", { eager: true });

const irFiles: Record<string, string> = {};
Object.keys(irModules).forEach((path) => {
  const fileName = path.split("/").pop()?.replace(".wav", "") || "";
  irFiles[fileName] = (irModules[path] as { default: string }).default;
});

const irNames = Object.keys(irFiles);

// maps 0-100 to custom min-max
const mapKnobRangeToCustomRange = (
  knobValue: number,
  min: number,
  max: number
): number => {
  return min + (knobValue / 100) * (max - min);
};

const mapCustomRangeToKnobRange = (
  value: number,
  min: number,
  max: number
): number => {
  return ((value - min) / (max - min)) * 100;
};

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
  value?: string;
  onChange?: (value: string) => void;
}

const Selectah = ({ dropdownItems, value, onChange }: SelectahProps) => (
  <select value={value} onChange={(e) => onChange?.(e.target.value)}>
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
  dropdownValue?: string;
  dropdownOnChange?: (value: string) => void;
  layerKnobLabels: Array<string>;
  knobValues: Array<number>;
  knobOnChanges: Array<(value: number) => void>;
}

const LayerStrip = ({
  layerLabel,
  dropdownItems,
  dropdownValue,
  dropdownOnChange,
  layerKnobLabels,
  knobValues,
  knobOnChanges,
}: LayerStripProps) => (
  <div className="layer-strip">
    <label>{layerLabel}</label>
    <div>
      <Selectah
        dropdownItems={dropdownItems}
        value={dropdownValue}
        onChange={dropdownOnChange}
      />
    </div>
    {layerKnobLabels.map((knobLabel, index) => (
      <div key={index}>
        <Knob
          label={knobLabel}
          value={knobValues[index]}
          onChange={knobOnChanges[index]}
        />
      </div>
    ))}
  </div>
);

interface SoundUnitProps {
  kickKnobProps: LayerStripProps;
  noiseKnobProps: LayerStripProps;
  reverbKnobProps: LayerStripProps;
}

const SoundUnit = ({
  kickKnobProps,
  noiseKnobProps,
  reverbKnobProps,
}: SoundUnitProps) => {
  return (
    <div className="sound-unit">
      <LayerStrip {...kickKnobProps} />
      <LayerStrip {...noiseKnobProps} />
      <LayerStrip {...reverbKnobProps} />
    </div>
  );
};

interface MasterStripProps {
  layerKnobLabels: Array<string>;
  knobValues: Array<number>;
  knobOnChanges: Array<(value: number) => void>;
}

const MasterStrip = ({
  layerKnobLabels,
  knobValues,
  knobOnChanges,
}: MasterStripProps) => (
  <>
    <h2>Fully Deep Mastering Chain</h2>
    <div className="master-strip-knobs">
      {layerKnobLabels.map((knobLabel, index) => (
        <div key={index}>
          <Knob
            label={knobLabel}
            value={knobValues[index]}
            onChange={knobOnChanges[index]}
          />
        </div>
      ))}
    </div>
  </>
);

const Daw = () => {
  // control strip states and refs
  const kickLoopRef = useRef<Tone.Loop | null>(null);
  const noiseLoopRef = useRef<Tone.Loop | null>(null);

  const [isPlayOn, setIsPlayOn] = useState(false);
  const [isCuePressed, setIsCuePressed] = useState(false);
  const [bpm, setBPM] = useState(140);

  // kick layer states and refs
  const kickSamplerRef = useRef<Tone.Sampler | null>(null);
  const kickSampleRef = useRef<string>("C1");
  const kickLenRef = useRef<number>(0.5);
  const kickDistortionRef = useRef<Tone.Distortion | null>(null);
  const kickOttEqRef = useRef<Tone.EQ3 | null>(null);
  const kickOttMbRef = useRef<Tone.MultibandCompressor | null>(null);
  const kickOttGainRef = useRef<Tone.Gain | null>(null);

  const [kickSample, setKickSample] = useState(kickNames[0] || "Kick1");
  const [kickLen, setKickLen] = useState(0.3);
  const [kickOttAmt, setKickOttAmt] = useState(0);
  const [kickDistortionAmt, setKickDistortionAmt] = useState(0);

  // noise layer states and refs
  const noiseRef = useRef<Tone.Sampler | null>(null);
  const noiseSampleRef = useRef<string>("C1");
  const noiseDistortionRef = useRef<Tone.Distortion | null>(null);
  const noiseLowPassRef = useRef<Tone.Filter | null>(null);
  const noiseHighPassRef = useRef<Tone.Filter | null>(null);

  const [noiseSample, setNoiseSample] = useState(noiseNames[0] || "greyNoise");
  const [noiseDistortionAmt, setNoiseDistortionAmt] = useState(0);
  const [noiseLowPassFreq, setNoiseLowPassFreq] = useState(1000);
  const [noiseHighPassFreq, setNoiseHighPassFreq] = useState(30);

  // reverb layer states and refs
  const reverbRef = useRef<Tone.Convolver | null>(null);
  const reverbLowPassRef = useRef<Tone.Filter | null>(null);
  const reverbHighPassRef = useRef<Tone.Filter | null>(null);
  const reverbPhaserRef = useRef<Tone.Phaser | null>(null);

  const [reverbIr, setReverbIr] = useState(irNames[0] || "JFKUnderpass");
  const [reverbLowPassFreq, setReverbLowPassFreq] = useState(1000);
  const [reverbHighPassFreq, setReverbHighPassFreq] = useState(30);
  const [reverbPhaserWetness, setReverbPhaserWetness] = useState(0);

  // master chain states and refs
  const masterOttEqRef = useRef<Tone.EQ3 | null>(null);
  const masterOttMbRef = useRef<Tone.MultibandCompressor | null>(null);
  const masterOttGainRef = useRef<Tone.Gain | null>(null);
  const masterDistortionRef = useRef<Tone.Distortion | null>(null);
  const masterLimiterGainRef = useRef<Tone.Gain | null>(null);
  const masterLimiterRef = useRef<Tone.Limiter | null>(null);

  const [masterOttAmt, setMasterOttAmt] = useState(0);
  const [masterDistortionAmt, setMasterDistortionAmt] = useState(0);
  const [masterLimiterAmt, setMasterLimiterAmt] = useState(2.5);

  // mount and unmount effect
  useEffect(() => {
    // initialize kick layer
    // Dynamically create urls object from kickFiles
    const kickUrls: Record<string, string> = {};
    kickNames.forEach((kickName, index) => {
      const note = `C${index + 1}`;
      kickUrls[note] = kickFiles[kickName];
    });
    kickSamplerRef.current = new Tone.Sampler({
      urls: kickUrls,
    });
    kickDistortionRef.current = new Tone.Distortion(kickDistortionAmt);
    kickOttMbRef.current = new Tone.MultibandCompressor({
      lowFrequency: 88.3,
      highFrequency: 2500,
      high: {
        threshold: -35.5,
        ratio: 1,
        attack: 0.0135,
        release: 0.132,
      },
      mid: {
        threshold: -30.2,
        ratio: 1,
        attack: 0.0224,
        release: 0.282,
      },
      low: {
        threshold: -33.8,
        ratio: 1,
        attack: 0.0447,
        release: 0.282,
      },
    });
    kickOttEqRef.current = new Tone.EQ3({
      lowFrequency: 88.3,
      highFrequency: 2500,
    });
    kickOttGainRef.current = new Tone.Gain(1);

    kickSamplerRef.current.connect(kickDistortionRef.current);
    kickDistortionRef.current.connect(kickOttMbRef.current);
    kickOttMbRef.current.connect(kickOttEqRef.current);
    kickOttEqRef.current.connect(kickOttGainRef.current);

    // initialize noise layer
    // Dynamically create urls object from noiseFiles
    const noiseUrls: Record<string, string> = {};
    noiseNames.forEach((noiseName, index) => {
      const note = `C${index + 1}`;
      noiseUrls[note] = noiseFiles[noiseName];
    });
    noiseRef.current = new Tone.Sampler({
      urls: noiseUrls,
    });
    noiseRef.current.volume.value = -15;

    noiseDistortionRef.current = new Tone.Distortion(noiseDistortionAmt);
    noiseLowPassRef.current = new Tone.Filter(noiseLowPassFreq, "lowpass");
    noiseHighPassRef.current = new Tone.Filter(noiseHighPassFreq, "highpass");

    noiseRef.current.connect(noiseDistortionRef.current);
    noiseDistortionRef.current.connect(noiseLowPassRef.current);
    noiseLowPassRef.current.connect(noiseHighPassRef.current);

    // initialize reverb layer
    reverbRef.current = new Tone.Convolver(
      irFiles[reverbIr] || irFiles[irNames[0]]
    );
    reverbLowPassRef.current = new Tone.Filter(reverbLowPassFreq, "lowpass");
    reverbHighPassRef.current = new Tone.Filter(reverbHighPassFreq, "highpass");
    reverbPhaserRef.current = new Tone.Phaser({
      frequency: 0.5,
      octaves: 3,
      baseFrequency: 350,
      wet: reverbPhaserWetness,
    });

    kickOttGainRef.current.connect(reverbRef.current);
    noiseHighPassRef.current.connect(reverbRef.current);
    reverbRef.current.connect(reverbLowPassRef.current);
    reverbLowPassRef.current.connect(reverbHighPassRef.current);
    reverbHighPassRef.current.connect(reverbPhaserRef.current);

    // initialized master layer
    masterOttEqRef.current = new Tone.EQ3();
    masterOttMbRef.current = new Tone.MultibandCompressor({
      lowFrequency: 200,
      highFrequency: 1300,
    });
    masterOttGainRef.current = new Tone.Gain(1);
    masterDistortionRef.current = new Tone.Distortion(masterDistortionAmt);
    masterLimiterGainRef.current = new Tone.Gain(masterLimiterAmt);
    masterLimiterRef.current = new Tone.Limiter(0);

    kickOttGainRef.current.connect(masterOttEqRef.current);
    noiseHighPassRef.current.connect(masterOttEqRef.current);
    reverbPhaserRef.current.connect(masterOttEqRef.current);
    masterOttEqRef.current.connect(masterOttMbRef.current);
    masterOttMbRef.current.connect(masterOttGainRef.current);
    masterOttGainRef.current.connect(masterDistortionRef.current);
    masterDistortionRef.current.connect(masterLimiterGainRef.current);
    masterLimiterGainRef.current.connect(masterLimiterRef.current);
    masterLimiterRef.current.toDestination();

    return () => {
      kickSamplerRef.current?.dispose();
      noiseRef.current?.dispose();
      reverbRef.current?.dispose();
      reverbPhaserRef.current?.dispose();
    };
  }, []);

  // bpm change effect
  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  // kick sample change
  useEffect(() => {
    const noteMap: Record<string, string> = {};
    kickNames.forEach((kickName, index) => {
      noteMap[kickName] = `C${index + 1}`;
    });
    kickSampleRef.current = noteMap[kickSample] || `C1`;
  }, [kickSample]);

  // kick length change
  useEffect(() => {
    kickLenRef.current = kickLen;
  }, [kickLen]);

  // kick distortion change
  useEffect(() => {
    if (kickDistortionRef.current) {
      kickDistortionRef.current.distortion = kickDistortionAmt;
    }
  }, [kickDistortionAmt]);

  // kick ott change
  useEffect(() => {
    if (
      kickOttEqRef.current &&
      kickOttMbRef.current &&
      kickOttGainRef.current
    ) {
      kickOttEqRef.current.mid.value = -3 * kickOttAmt;

      kickOttMbRef.current.high.ratio.value = 1 + 10 * kickOttAmt;
      kickOttMbRef.current.mid.ratio.value = 1 + 10 * kickOttAmt;
      kickOttMbRef.current.low.ratio.value = 1 + 10 * kickOttAmt;

      kickOttGainRef.current.gain.value = 1 + 1 * kickOttAmt;
    }
  }, [kickOttAmt]);

  // noise sample change
  useEffect(() => {
    const noiseMap: Record<string, string> = {};
    noiseNames.forEach((noiseName, index) => {
      noiseMap[noiseName] = `C${index + 1}`;
    });
    noiseSampleRef.current = noiseMap[noiseSample] || `C1`;
  }, [noiseSample]);

  // noise low pass change
  useEffect(() => {
    if (noiseLowPassRef.current) {
      noiseLowPassRef.current.frequency.value = noiseLowPassFreq;
    }
  }, [noiseLowPassFreq]);

  // noise high pass change
  useEffect(() => {
    if (noiseHighPassRef.current) {
      noiseHighPassRef.current.frequency.value = noiseHighPassFreq;
    }
  }, [noiseHighPassFreq]);

  // noise distortion change
  useEffect(() => {
    if (noiseDistortionRef.current) {
      noiseDistortionRef.current.distortion = noiseDistortionAmt;
    }
  }, [noiseDistortionAmt]);

  // reverb ir change
  useEffect(() => {
    if (reverbRef.current && irFiles[reverbIr]) {
      reverbRef.current.load(irFiles[reverbIr]).catch(console.error);
    }
  }, [reverbIr]);

  // reverb low pass change
  useEffect(() => {
    if (reverbLowPassRef.current) {
      reverbLowPassRef.current.frequency.value = reverbLowPassFreq;
    }
  }, [reverbLowPassFreq]);

  // reverb high pass change
  useEffect(() => {
    if (reverbHighPassRef.current) {
      reverbHighPassRef.current.frequency.value = reverbHighPassFreq;
    }
  }, [reverbHighPassFreq]);

  // phaser wetness change
  useEffect(() => {
    if (reverbPhaserRef.current) {
      reverbPhaserRef.current.wet.value = reverbPhaserWetness;
    }
  }, [reverbPhaserWetness]);

  // master ott change
  useEffect(() => {
    if (
      masterOttEqRef.current &&
      masterOttMbRef.current &&
      masterOttGainRef.current
    ) {
      masterOttEqRef.current.mid.value = -3 * masterOttAmt;

      masterOttMbRef.current.high.ratio.value = 1 + 10 * masterOttAmt;
      masterOttMbRef.current.mid.ratio.value = 1 + 10 * masterOttAmt;
      masterOttMbRef.current.low.ratio.value = 1 + 10 * masterOttAmt;

      masterOttGainRef.current.gain.value = 1 + 1 * masterOttAmt;
    }
  }, [masterOttAmt]);

  // master distortion change
  useEffect(() => {
    if (masterDistortionRef.current) {
      masterDistortionRef.current.distortion = masterDistortionAmt;
    }
  }, [masterDistortionAmt]);

  // master limiter change
  useEffect(() => {
    if (masterLimiterGainRef.current) {
      masterLimiterGainRef.current.gain.value = masterLimiterAmt;
    }
  });

  // play button functionality
  const handlePlayClick = async () => {
    const newPlayState = !isPlayOn;
    setIsPlayOn(newPlayState);

    if (newPlayState) {
      await Tone.start();

      Tone.getTransport().bpm.value = bpm;

      kickLoopRef.current = new Tone.Loop((time) => {
        kickSamplerRef.current?.triggerAttackRelease(
          kickSampleRef.current,
          kickLenRef.current,
          time
        );
      }, "4n").start(0);

      noiseLoopRef.current = new Tone.Loop((time) => {
        noiseRef.current?.triggerAttackRelease(noiseSampleRef.current, 4, time);
      }, "1n").start(0);

      Tone.getTransport().start();
    } else {
      if (kickLoopRef.current) {
        kickLoopRef.current.stop();
        kickLoopRef.current.dispose();
        kickLoopRef.current = null;
      }
      if (noiseLoopRef.current) {
        noiseLoopRef.current.stop();
        noiseLoopRef.current.dispose();
        noiseLoopRef.current = null;
      }
      Tone.getTransport().stop();
    }
  };

  // cue button functionality
  const handleCueMouseDown = async () => {
    setIsCuePressed(true);
    await Tone.start();
    kickSamplerRef.current?.triggerAttackRelease(kickSampleRef.current, 0.5);
    noiseRef.current?.triggerAttackRelease(noiseSampleRef.current, 0.5);
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
      <SoundUnit
        kickKnobProps={{
          layerLabel: "Kick Layer",
          dropdownItems: kickNames,
          dropdownValue: kickSample,
          dropdownOnChange: setKickSample,
          layerKnobLabels: ["Length", "Distortion", "OTT"],
          knobValues: [
            mapCustomRangeToKnobRange(kickLen, 0, 0.3),
            mapCustomRangeToKnobRange(kickDistortionAmt, 0, 0.2),
            mapCustomRangeToKnobRange(kickOttAmt, 0, 1),
          ],
          knobOnChanges: [
            (value) => setKickLen(mapKnobRangeToCustomRange(value, 0, 0.3)),
            (value) =>
              setKickDistortionAmt(mapKnobRangeToCustomRange(value, 0, 0.2)),
            (value) => setKickOttAmt(mapKnobRangeToCustomRange(value, 0, 1)),
          ],
        }}
        noiseKnobProps={{
          layerLabel: "Noise Layer",
          dropdownItems: noiseNames,
          dropdownValue: noiseSample,
          dropdownOnChange: setNoiseSample,
          layerKnobLabels: ["Low Pass", "High Pass", "Distortion"],
          knobValues: [
            mapCustomRangeToKnobRange(noiseLowPassFreq, 30, 7000),
            mapCustomRangeToKnobRange(noiseHighPassFreq, 30, 7000),
            mapCustomRangeToKnobRange(noiseDistortionAmt, 0, 0.2),
          ],
          knobOnChanges: [
            (value) =>
              setNoiseLowPassFreq(mapKnobRangeToCustomRange(value, 30, 7000)),
            (value) =>
              setNoiseHighPassFreq(mapKnobRangeToCustomRange(value, 30, 7000)),
            (value) =>
              setNoiseDistortionAmt(mapKnobRangeToCustomRange(value, 0, 0.2)),
          ],
        }}
        reverbKnobProps={{
          layerLabel: "Reverb Layer",
          dropdownItems: irNames,
          dropdownValue: reverbIr,
          dropdownOnChange: setReverbIr,
          layerKnobLabels: ["Low Pass", "High Pass", "Phaser"],
          knobValues: [
            mapCustomRangeToKnobRange(reverbLowPassFreq, 30, 7000),
            mapCustomRangeToKnobRange(reverbHighPassFreq, 30, 7000),
            mapCustomRangeToKnobRange(reverbPhaserWetness, 0, 1),
          ],
          knobOnChanges: [
            (value) =>
              setReverbLowPassFreq(mapKnobRangeToCustomRange(value, 30, 7000)),
            (value) =>
              setReverbHighPassFreq(mapKnobRangeToCustomRange(value, 30, 7000)),
            (value) =>
              setReverbPhaserWetness(mapKnobRangeToCustomRange(value, 0, 1)),
          ],
        }}
      />
      <MasterStrip
        layerKnobLabels={["OTT", "Distortion", "Limiter"]}
        knobValues={[
          mapCustomRangeToKnobRange(masterOttAmt, 0, 1),
          mapCustomRangeToKnobRange(masterDistortionAmt, 0, 0.2),
          mapCustomRangeToKnobRange(masterLimiterAmt, 1, 4),
        ]}
        knobOnChanges={[
          (value) => setMasterOttAmt(mapKnobRangeToCustomRange(value, 0, 1)),
          (value) =>
            setMasterDistortionAmt(mapKnobRangeToCustomRange(value, 0, 0.2)),
          (value) =>
            setMasterLimiterAmt(mapKnobRangeToCustomRange(value, 1, 4)),
        ]}
      />
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
