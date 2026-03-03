function log2(value: number): number{
  return Math.log(value) / Math.log(2);
}

function centDiff(freq1: number, freq2: number): number {
  if ( freq1 <= 0 || freq2 <= 0 ) throw new Error("Frequency must be positive!");

  const linearFreq1 = log2(freq1);
  const linearFreq2 = log2(freq2);
  const linearDiff = linearFreq2 - linearFreq1;
  return linearDiff * 1_200.0;
}

console.log(centDiff(440, 880));
console.log(centDiff(440, 440));
console.log(centDiff(440, 466.16));
console.log(centDiff(880, 440));
//console.log(centDiff(440, 0));
//console.log(centDiff(0, 880));
