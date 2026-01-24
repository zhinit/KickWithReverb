export interface PresetData {
  id: number;
  presetName: string;
  bpm: number;
  kickSample: string;
  kickLen: number;
  kickDistAmt: number;
  kickOttAmt: number;
  noiseSample: string;
  noiseLowPassFreq: number;
  noiseHighPassFreq: number;
  noiseDistAmt: number;
  reverbSample: string;
  reverbLowPassFreq: number;
  reverbHighPassFreq: number;
  reverbPhaserAmt: number;
  masterOttAmt: number;
  masterDistAmt: number;
  masterLimiterAmt: number;
  createdAt: string;
  updatedAt: string;
}

export interface SharedPreset extends PresetData {
  isShared: true;
}
