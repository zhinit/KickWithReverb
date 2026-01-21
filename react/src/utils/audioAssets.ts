// Import all kick files
const kickModules = import.meta.glob("../assets/kicks/*.wav", { eager: true });

export const kickFiles: Record<string, string> = {};
Object.keys(kickModules).forEach((path) => {
  const fileName = path.split("/").pop()?.replace(".wav", "") || "";
  kickFiles[fileName] = (kickModules[path] as { default: string }).default;
});

export const kickNames = Object.keys(kickFiles).sort();

// Import all noise files
const noiseModules = import.meta.glob("../assets/noises/*.mp3", { eager: true });

export const noiseFiles: Record<string, string> = {};
Object.keys(noiseModules).forEach((path) => {
  const fileName = path.split("/").pop()?.replace(".mp3", "") || "";
  noiseFiles[fileName] = (noiseModules[path] as { default: string }).default;
});

export const noiseNames = Object.keys(noiseFiles).sort();

// Import all IR files
const irModules = import.meta.glob("../assets/IRs/*.wav", { eager: true });

export const irFiles: Record<string, string> = {};
Object.keys(irModules).forEach((path) => {
  const fileName = path.split("/").pop()?.replace(".wav", "") || "";
  irFiles[fileName] = (irModules[path] as { default: string }).default;
});

export const irNames = Object.keys(irFiles);

// Utility functions for knob range mapping
export const mapKnobRangeToCustomRange = (
  knobValue: number,
  min: number,
  max: number
): number => {
  return min + (knobValue / 100) * (max - min);
};

export const mapCustomRangeToKnobRange = (
  value: number,
  min: number,
  max: number
): number => {
  return ((value - min) / (max - min)) * 100;
};
