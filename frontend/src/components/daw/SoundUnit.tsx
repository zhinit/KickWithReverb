import "./sound-unit.css";
import type { SoundUnitProps } from "../../types/types";
import { LayerStrip } from "./LayerStrip";

export const SoundUnit = ({
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