import "./layer-strip.css";
import type { LayerStripProps } from "../types/types";
import { Selectah } from "./Selectah";
import { Knob } from "./Knob";

export const LayerStrip = ({
  layerLabel,
  dropdownItems,
  dropdownValue,
  dropdownOnChange,
  layerKnobLabels,
  knobValues,
  knobOnChanges,
  customDropdown,
}: LayerStripProps) => (
  <div className="layer-strip">
    <label>{layerLabel}</label>
    <div>
      {customDropdown ?? (
        <Selectah
          dropdownItems={dropdownItems}
          value={dropdownValue}
          onChange={dropdownOnChange}
        />
      )}
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