// convert hz to midi note

function logBase2(x: number): number {
  return Math.log(x) / Math.log(2);
}

function hzToMidi(frequencyHz: number): string {
  const middleC = 220 * 2 ** (3 / 12);
  const middleCLinear = logBase2(middleC);

  const frequencyLinear = logBase2(frequencyHz);

  const octaveDifference = frequencyLinear - middleCLinear;
  let outputOctave = 4 + Math.floor(octaveDifference);

  const noteDecimal = octaveDifference - outputOctave + 4;
  let noteNumber = Math.round(noteDecimal * 12);

  if (noteNumber === 12) {
    outputOctave++;
    noteNumber = 0;
  }

  const noteMap = {
    0: "C",
    1: "C#/Db",
    2: "D",
    3: "D#/Eb",
    4: "E",
    5: "F",
    6: "F#/Gb",
    7: "G",
    8: "G#/Ab",
    9: "A",
    10: "A#/Bb",
    11: "B",
  };

  const outputNote = noteMap[noteNumber];

  return outputNote + outputOctave;
}

console.log(hzToMidi(440));
console.log(hzToMidi(880));
console.log(hzToMidi(1000));
