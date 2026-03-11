export function dft(
  input: Float32Array,
): { real: number; imaginary: number }[] {
  const amplitudes: { real: number; imaginary: number }[] = [];
  for (let bin = 0; bin < input.length; bin++) {
    let real = 0;
    let imaginary = 0;
    for (let sample = 0; sample < input.length; sample++) {
      const time = sample / input.length;
      const theta = -2 * Math.PI * bin * time;
      real += input[sample] * Math.cos(theta);
      imaginary += input[sample] * Math.sin(theta);
    }
    amplitudes.push({ real, imaginary });
  }
  return amplitudes;
}

// console.log(dft(new Float32Array([1, 0.5, 0, -0.5, -1, -0.5, 0, 0.5])));
