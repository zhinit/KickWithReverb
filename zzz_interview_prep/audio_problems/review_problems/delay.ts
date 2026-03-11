function applyDelay(
  input: Float32Array,
  sampleRate: number,
  delayMs: number,
  feedback: number,
  mix: number,
): Float32Array {
  const wet = new Float32Array(input.length);
  const output = new Float32Array(input.length);
  const delaySamples = Math.round((sampleRate * delayMs) / 1000);

  for (let i = 0; i < input.length; i++) {
    if (i < delaySamples) {
      output[i] = input[i] * (1 - mix);
    } else {
      wet[i] = input[i - delaySamples] + wet[i - delaySamples] * feedback;
      output[i] = input[i] * (1 - mix) + wet[i] * mix;
    }
  }

  return output;
}

console.log(
  applyDelay(new Float32Array([1, 0, 0, 0, 0, 0, 0, 0]), 4, 500, 0.9, 0.95),
);
