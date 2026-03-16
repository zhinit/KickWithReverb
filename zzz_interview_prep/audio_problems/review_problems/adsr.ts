// rather than one complex loop that does something different for each state
// I will make one loop for each section
// and then progress to next section
// each section will be a simple linear interpolation
// ie a (1- w) + b * w

function adsr(
  numSamples: number,
  sampleRate: number,
  attackMs: number,
  decayMs: number,
  sustainLevel: number,
  releaseMs: number
): Float32Array {
  // calculate sample amount for each section
  const attackSamples = Math.round(attackMs / 1000 * sampleRate);
  const attackSamplesAdj = Math.min(numSamples, attackSamples);

  const decaySamples = Math.round(decayMs / 1000 * sampleRate);
  const decaySamplesAdj = Math.min(numSamples, attackSamples + decaySamples)

  const releaseSamples = Math.round(releaseMs / 1000 * sampleRate);
  const releaseStart = Math.max(numSamples - releaseSamples, decaySamplesAdj);

  const adsr = new Float32Array(numSamples);

  // attack loop
  let attackPos = 0;
  let currPos = 0;
  while (currPos < attackSamplesAdj) {
    adsr[currPos] = 0 * (1 - attackPos / attackSamples) + 1 * attackPos / attackSamples;
    currPos++;
    attackPos++;
  }

  // decay loop
  let decayPos = 0;
  while (currPos < decaySamplesAdj) {
    adsr[currPos] = 1 * (1 - decayPos / decaySamples) + sustainLevel * decayPos / decaySamples;
    currPos++;
    decayPos++;
  }

  // sustain loop
  while (currPos < releaseStart) {
    adsr[currPos] = sustainLevel;
    currPos++;
  }

  // release loop
  let releasePos = 0;
  while (currPos < numSamples) {
    adsr[currPos] = sustainLevel * (1 - releasePos / releaseSamples) + 0 * (releasePos / releaseSamples);
    currPos++;
    releasePos++;
  }
  return adsr
}

console.log(adsr(
  8,
  1,
  2000,
  2000,
  0.5,
  2000
))

console.log(adsr(
  4,
  1,
  2000,
  2000,
  0.5,
  2000
))
