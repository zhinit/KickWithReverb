import { type MouseEventHandler } from "react";

export interface KnobProps {
  value?: number;
  onChange?: (value: number) => void;
  label: string;
}

export interface SelectahProps {
  dropdownItems: Array<string>;
  value?: string;
  onChange?: (value: string) => void;
}

export interface ControlStripProps {
  bpm: number;
  isPlayOn: boolean;
  isCuePressed: boolean;
  handleCueMouseDown: () => void;
  handleCueMouseUp: () => void;
  handlePlayClick: MouseEventHandler;
  setBPM: Function;
}

export interface LayerStripProps {
  layerLabel: string;
  dropdownItems: Array<string>;
  dropdownValue?: string;
  dropdownOnChange?: (value: string) => void;
  layerKnobLabels: Array<string>;
  knobValues: Array<number>;
  knobOnChanges: Array<(value: number) => void>;
}

export interface SoundUnitProps {
  kickKnobProps: LayerStripProps;
  noiseKnobProps: LayerStripProps;
  reverbKnobProps: LayerStripProps;
}

export interface MasterStripProps {
  layerKnobLabels: Array<string>;
  knobValues: Array<number>;
  knobOnChanges: Array<(value: number) => void>;
}