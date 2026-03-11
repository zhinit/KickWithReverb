function applyLowPass(
  input: Float32Array,
  sampleRate: number,
  cutoffHz: number,
): Float32Array {
  const output = new Float32Array(input.length);
  const a = 1 - Math.exp((-2 * Math.PI * cutoffHz) / sampleRate);
  let prevSample = 0;
  for (let i = 0; i < output.length; i++) {
    output[i] = a * input[i] + (1 - a) * prevSample;
    prevSample = output[i];
  }
  return output;
}

console.log(
  applyLowPass(
    new Float32Array([1, 0.75, 0.5, 0.25, 0, -0.25, -0.5, -0.75]),
    8,
    1,
  ),
);
