function adsrEnvelope(
  totalSamples: number,
  attackSamples: number,
  decaySamples: number,
  sustainLevel: number,
  releaseSamples: number,
): Float32Array {
  // handle invalid input
  if (
    totalSamples < 0 ||
    attackSamples < 0 ||
    decaySamples < 0 ||
    releaseSamples < 0
  )
    throw new Error("samples amts must be non negative");
  if (sustainLevel < 0 || sustainLevel > 1)
    throw new Error("sustain level must be in [0, 1]");

  // create blank output
  const adsrBuffer = new Float32Array(totalSamples);

  // interpolate from start at 0 to end of attack at 1
  let posInBuffer = 0;
  let posInAttack = 1;
  const attackSamplesAdj = Math.min(attackSamples, totalSamples);
  while (posInBuffer < attackSamplesAdj) {
    adsrBuffer[posInBuffer] =
      0 * (1 - posInAttack / attackSamples) + 1 * (posInAttack / attackSamples);
    posInBuffer++;
    posInAttack++;
  }

  // interpolate from end of attack at 1 to end of decay at sustain level
  let posInDecay = 1;
  const decaySamplesAdj = Math.min(attackSamples + decaySamples, totalSamples);
  while (posInBuffer < decaySamplesAdj) {
    adsrBuffer[posInBuffer] =
      1 * (1 - posInDecay / decaySamples) +
      sustainLevel * (posInDecay / decaySamples);
    posInBuffer++;
    posInDecay++;
  }

  // stay at sustatin
  const releaseStart = Math.max(totalSamples - releaseSamples, posInBuffer);
  while (posInBuffer < releaseStart) {
    adsrBuffer[posInBuffer] = sustainLevel;
    posInBuffer++;
  }

  // release
  let posInRelease = 1;
  while (posInBuffer < totalSamples) {
    adsrBuffer[posInBuffer] =
      sustainLevel * (1 - posInRelease / releaseSamples) +
      0 * (posInRelease / releaseSamples);
    posInBuffer++;
    posInRelease++;
  }

  return adsrBuffer;
}

console.log(adsrEnvelope(15, 3, 3, 0.5, 3));
