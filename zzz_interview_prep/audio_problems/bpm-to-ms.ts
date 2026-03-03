// so lets get a quarter note as our anchor
// once we calculate this use a map to get the ms for the specific type of note

type NoteSubdivision = "sixteenth" | "dotted-sixteenth" | "eighth" | "dotted-eighth" | "quarter" | "dotted-quarter" | "half" | "whole";

function bpmToMs(bpm: number, typeOfNote: NoteSubdivision): number {
  if (bpm <= 0) throw new Error("BPM must be positive!");

  const subDivMap: Record<NoteSubdivision, number> = {
    "sixteenth": 1/16,
    "dotted-sixteenth": 3/32,
    "eighth": 1/8,
    "dotted-eighth": 3/16,
    "quarter": 1/4,
    "dotted-quarter": 3/8,
    "half": 1/2,
    "whole": 1,
  }

  const bps = bpm / 60;
  const bpms = bps / 1000;
  const mspb = 1 / bpms;

  return mspb * 4 * subDivMap[typeOfNote];
}

console.log( bpmToMs(120, "quarter") );
console.log( bpmToMs(120, "whole") );
console.log( bpmToMs(120, "eighth") );
console.log( bpmToMs(120, "dotted-sixteenth") );
console.log( bpmToMs(120, "sixteenth") );

// console.log( bpmToMs(0, "quarter") );
// console.log( bpmToMs(120, "qwarter") );

