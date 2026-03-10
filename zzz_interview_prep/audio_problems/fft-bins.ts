function freqToBin(
  freqHz: number,
  fftSize: number,
  sampleRate: number,
): number {
  if (sampleRate <= 0 || freqHz < 0 || fftSize <= 0)
    throw new Error("Invalid input");

  const maxBin = Math.floor(fftSize / 2);
  const maxFreq = sampleRate / 2;

  // map from [0, maxFreq] to [0, maxBin]
  // maxFreq * C = maxBin
  // C = maxBin / maxFreq
  const bin = Math.round((freqHz * maxBin) / maxFreq);
  const clampedBin = Math.max(0, Math.min(maxBin, bin));

  return clampedBin;
}

function binToFreq(bin: number, fftSize: number, sampleRate: number): number {
  if (fftSize <= 0 || sampleRate <= 0) throw new Error("Invalid input");
  const maxBin = Math.floor(fftSize / 2);
  const maxFreq = sampleRate / 2;

  const clampedBin = Math.max(0, Math.min(maxBin, bin));
  const freq = (clampedBin * maxFreq) / maxBin;
  return freq;
}

console.log(binToFreq(0, 2048, 44100), 0);
console.log(binToFreq(1024, 2048, 44100), 22050);
console.log(binToFreq(20, 2048, 44100), 440);
console.log();
console.log(freqToBin(440, 2048, 44100), 20);
console.log(freqToBin(0, 2048, 44100), 0);
console.log(freqToBin(99999999999, 2048, 44100), 1024);
