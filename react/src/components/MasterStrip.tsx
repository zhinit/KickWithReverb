import type { MasterStripProps } from "../types/types";
import { Knob } from "./Knob";

export const MasterStrip = ({
  layerKnobLabels,
  knobValues,
  knobOnChanges,
}: MasterStripProps) => (
  <>
    <h2 className="mastering-heading">Fully Deep Mastering Chain</h2>
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