import { useEffect, useRef, useState } from "react";
import { ControlStrip } from "./ControlStrip";
import { MasterStrip } from "./MasterStrip";
import { SoundUnit } from "./SoundUnit";
import * as Tone from "tone";
import { useKickLayer } from "../hooks/useKickLayer";
import { useNoiseLayer } from "../hooks/useNoiseLayer";
import {
  irFiles,
  irNames,
  mapKnobRangeToCustomRange,
  mapCustomRangeToKnobRange,
} from "../utils/audioAssets";

export const Daw = () => {
  // Layer hooks
  const kick = useKickLayer();
  const noise = useNoiseLayer();

  // control strip states and refs
  const kickLoopRef = useRef<Tone.Loop | null>(null);
  const noiseLoopRef = useRef<Tone.Loop | null>(null);

  const [isPlayOn, setIsPlayOn] = useState(false);
  const [isCuePressed, setIsCuePressed] = useState(false);
  const [bpm, setBPM] = useState(140);

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
  const [masterLimiterAmt, setMasterLimiterAmt] = useState(1.5);

  // Initialize reverb and master audio nodes
  useEffect(() => {
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

    reverbRef.current.connect(reverbLowPassRef.current);
    reverbLowPassRef.current.connect(reverbHighPassRef.current);
    reverbHighPassRef.current.connect(reverbPhaserRef.current);

    // initialize master layer
    masterOttEqRef.current = new Tone.EQ3({
      lowFrequency: 88.3,
      highFrequency: 2500,
      low: 0,
      mid: 0,
      high: 0,
    });
    masterOttMbRef.current = new Tone.MultibandCompressor({
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
    masterOttGainRef.current = new Tone.Gain(1);
    masterDistortionRef.current = new Tone.Distortion(0.3);
    masterLimiterGainRef.current = new Tone.Gain(masterLimiterAmt);
    masterLimiterRef.current = new Tone.Limiter(0);

    reverbPhaserRef.current.connect(masterOttEqRef.current);
    masterOttEqRef.current.connect(masterOttMbRef.current);
    masterOttMbRef.current.connect(masterOttGainRef.current);
    masterOttGainRef.current.connect(masterDistortionRef.current);
    masterDistortionRef.current.connect(masterLimiterGainRef.current);
    masterLimiterGainRef.current.connect(masterLimiterRef.current);
    masterLimiterRef.current.toDestination();

    return () => {
      reverbRef.current?.dispose();
      reverbPhaserRef.current?.dispose();
    };
  }, []);

  // Connect kick output to reverb and master when ready
  useEffect(() => {
    if (kick.output && reverbRef.current && masterOttEqRef.current) {
      kick.output.connect(reverbRef.current);
      kick.output.connect(masterOttEqRef.current);
    }
  }, [kick.output]);

  // Connect noise output to reverb and master when ready
  useEffect(() => {
    if (noise.output && reverbRef.current && masterOttEqRef.current) {
      noise.output.connect(reverbRef.current);
      noise.output.connect(masterOttEqRef.current);
    }
  }, [noise.output]);

  // bpm change effect
  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

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
      masterDistortionRef.current.wet.value = masterDistortionAmt;
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
        kick.trigger(time, kick.lenRef.current);
      }, "4n").start(0);

      noiseLoopRef.current = new Tone.Loop((time) => {
        noise.trigger(time, 4);
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
    kick.trigger(undefined, 0.5);
    noise.trigger(undefined, 0.5);
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
        kickKnobProps={kick.uiProps}
        noiseKnobProps={noise.uiProps}
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
          mapCustomRangeToKnobRange(masterDistortionAmt, 0, 0.5),
          mapCustomRangeToKnobRange(masterLimiterAmt, 1, 4),
        ]}
        knobOnChanges={[
          (value) => setMasterOttAmt(mapKnobRangeToCustomRange(value, 0, 1)),
          (value) =>
            setMasterDistortionAmt(mapKnobRangeToCustomRange(value, 0, 0.5)),
          (value) =>
            setMasterLimiterAmt(mapKnobRangeToCustomRange(value, 1, 4)),
        ]}
      />
    </div>
  );
};
