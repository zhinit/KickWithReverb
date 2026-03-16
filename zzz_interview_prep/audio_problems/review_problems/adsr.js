// rather than one complex loop that does something different for each state
// I will make one loop for each section
// and then progress to next section
// each section will be a simple linear interpolation
// ie a (1- w) + b * w
function adsr(numSamples, sampleRate, attackMs, decayMs, sustainLevel, releaseMs) {
    // calculate sample amount for each section
    var attackSamples = Math.round(attackMs / 1000 * sampleRate);
    var attackSamplesAdj = Math.min(numSamples, attackSamples);
    var decaySamples = Math.round(decayMs / 1000 * sampleRate);
    var decaySamplesAdj = Math.min(numSamples, attackSamples + decaySamples);
    var releaseSamples = Math.round(releaseMs / 1000 * sampleRate);
    var releaseStart = Math.max(numSamples - releaseSamples, decaySamples);
    var adsr = new Float32Array(numSamples);
    // attack loop
    var attackPos = 0;
    var currPos = 0;
    while (currPos < attackSamplesAdj) {
        adsr[currPos] = 0 * (1 - attackPos / attackSamples) + 1 * attackPos / attackSamples;
        currPos++;
        attackPos++;
    }
    // decay loop
    var decayPos = 0;
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
    var releasePos = 0;
    while (currPos < numSamples) {
        adsr[currPos] = sustainLevel * (1 - releasePos / releaseSamples) + 0 * (releasePos / releaseSamples);
        currPos++;
        releasePos++;
    }
    return adsr;
}
console.log(adsr(8, 1, 2000, 2000, 0.5, 2000));
