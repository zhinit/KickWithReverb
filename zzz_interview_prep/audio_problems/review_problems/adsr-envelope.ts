function createAdsr(
  sampleRate: number,
  attackMs: number,
  decayMs: number,
  sustainLevel: number,
  releaseMs: number,
  durationMs: number,
): Float32Array {
  // calculate length of buffer in samples
  const totalSamples = Math.round((sampleRate * durationMs) / 1000);
  const adsrBuffer = new Float32Array(totalSamples);

  // convert from ms to samples for segment lengths
  const attackSamples = Math.round((sampleRate * attackMs) / 1000);
  const decaySamples = Math.round((sampleRate * decayMs) / 1000);
  const releaseSamples = Math.round((sampleRate * releaseMs) / 1000);

  let currPos = 0;
  const clampedSustain = Math.max(0, Math.min(1, sustainLevel));

  // calculate attack
  let attackPos = 1;
  while (currPos < totalSamples && currPos < attackSamples) {
    adsrBuffer[currPos] =
      0 * (1 - attackPos / attackSamples) + 1 * (attackPos / attackSamples);
    currPos++;
    attackPos++;
  }

  // calculate decay
  let decayPos = 1;
  while (currPos < totalSamples && currPos < attackSamples + decaySamples) {
    adsrBuffer[currPos] =
      1 * (1 - decayPos / decaySamples) +
      (clampedSustain * decayPos) / decaySamples;
    currPos++;
    decayPos++;
  }

  // calculate sustain
  const releaseStart = Math.max(totalSamples - releaseSamples, currPos);
  while (currPos < releaseStart) {
    adsrBuffer[currPos] = clampedSustain;
    currPos++;
  }

  // calculate release
  let releasePos = 1;
  while (currPos < totalSamples) {
    adsrBuffer[currPos] =
      clampedSustain * (1 - releasePos / releaseSamples) +
      0 * (releasePos / releaseSamples);
    currPos++;
    releasePos++;
  }

  return adsrBuffer;
}

console.log(createAdsr(10, 500, 500, 0.6, 300, 5000));
console.log(createAdsr(10, 500, 500, 0.6, 300, 1000));
console.log(createAdsr(10, 500, 500, 0.6, 300, 500));
