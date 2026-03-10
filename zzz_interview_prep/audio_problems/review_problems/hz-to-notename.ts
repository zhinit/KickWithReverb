function hzToNoteName(inputFreq: number): string {
  if (inputFreq <= 0) throw new Error("frequency must be positive");

  const freqC4 = 440 * 2 ** (-9 / 12);
  const distanceFromC4 = Math.log2(inputFreq / freqC4);
  let octavesFromC4 = Math.floor(distanceFromC4);
  let noteNumber = Math.round((distanceFromC4 - octavesFromC4) * 12);
  if (noteNumber === 12) {
    octavesFromC4++;
    noteNumber = 0;
  }

  const noteMap: Record<number, string> = {
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

  return noteMap[noteNumber] + (octavesFromC4 + 4);
}

console.log(hzToNoteName(880), "A5");
console.log(hzToNoteName(440), "A4");
console.log(hzToNoteName(361));
console.log(hzToNoteName(220), "A3");
console.log(hzToNoteName(110), "A2");
