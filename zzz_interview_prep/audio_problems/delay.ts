function delay(
  inputBuffer: Float32Array,
  delayMs: number,
  feedback: number,
  mix: number,
  sampleRate: number,
): Float32Array {
  // clamp inputs
  mix = Math.max(Math.min(mix, 1), 0);
  feedback = Math.max(Math.min(feedback, 0.99), 0);
  delayMs = Math.max(0, delayMs);

  const outputBuffer = new Float32Array(inputBuffer.length);
  const delayBuffer = new Float32Array(inputBuffer.length);
  const delaySamples = Math.round((delayMs / 1000) * sampleRate);
  for (let i = 0; i < inputBuffer.length; i++) {
    if (i < delaySamples) outputBuffer[i] = inputBuffer[i] * (1 - mix);
    else {
      delayBuffer[i] =
        inputBuffer[i - delaySamples] +
        feedback * delayBuffer[i - delaySamples];
      outputBuffer[i] = inputBuffer[i] * (1 - mix) + delayBuffer[i] * mix;
    }
  }
  return outputBuffer;
}

console.log(delay(new Float32Array([1, 0, 0, 0, 0, 0, 0, 0]), 0, 0.5, 0.5, 2));
console.log(
  delay(new Float32Array([1, 0, 0, 0, 0, 0, 0, 0]), 1000, 0.5, 0.5, 2),
);
