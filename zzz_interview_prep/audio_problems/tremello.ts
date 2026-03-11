function applyTremello(
  input: Float32Array,
  sampleRate: number,
  rateHz: number,
  depth: number,
): Float32Array {
  const output = new Float32Array(input.length);
  // make a sine at rateHz with amplitude = depth
  // i will apply transform (sin() + 1) / 2 to map from [-1, 1] to [0, 1]
  // i will multiply this to the input to get output
  for (let i = 0; i < output.length; i++) {
    const time = i / sampleRate;
    const rawSine = depth * Math.sin(rateHz * time * 2 * Math.PI);
    const transformSine = (rawSine + 1) / 2 + (1 - depth) * 0.5;
    output[i] = input[i] * transformSine;
  }
  return output;
}

console.log(
  applyTremello(
    new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    4,
    1,
    0,
  ),
);
console.log(
  applyTremello(
    new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    4,
    1,
    0.5,
  ),
);
console.log(
  applyTremello(
    new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    4,
    1,
    1,
  ),
);
