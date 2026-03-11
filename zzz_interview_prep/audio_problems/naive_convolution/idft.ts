export function idft(
  freqs: { real: number; imaginary: number }[],
): Float32Array {
  const bins = freqs.length;
  const output = new Float32Array(bins);
  for (let bin = 0; bin < bins; bin++) {
    for (let sample = 0; sample < bins; sample++) {
      const time = sample / bins;
      const theta = 2 * Math.PI * bin * time;
      output[sample] +=
        freqs[bin].real * Math.cos(theta) -
        freqs[bin].imaginary * Math.sin(theta);
      if (bin === bins - 1) output[sample] /= bins;
    }
  }
  return output;
}

/*
console.log(
  idft([
    { real: 0, imaginary: 0 },
    { real: 3.414213562373095, imaginary: 2.7755575615628914e-16 },
    { real: -3.6739403974420594e-16, imaginary: -2.220446049250313e-16 },
    { real: 0.5857864376269055, imaginary: -1.1102230246251565e-16 },
    { real: 0, imaginary: -4.898587196589413e-16 },
    { real: 0.5857864376269062, imaginary: -4.996003610813204e-16 },
    { real: 7.6911521184507085e-16, imaginary: -7.771561172376096e-16 },
    { real: 3.414213562373096, imaginary: 2.9976021664879227e-15 },
  ]),
);
*/
