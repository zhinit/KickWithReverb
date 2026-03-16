// calculate rms
// rms = sqrt(mean sum of squares)
// mean sum of squares = 1/n sum x^2

function rms(buffer: Float32Array): number {
  if (buffer.length === 0) return 0;
  let totalSum = 0;
  for (let i = 0; i < buffer.length; i++) {
    totalSum += buffer[i] ** 2;
  }
  const mean = totalSum / buffer.length;
  const rms = mean ** (1/2);
  return rms;
}

console.log(rms(new Float32Array([0, 0])), 0);
console.log(rms(new Float32Array([0.5, 0.5])), 0.5);
console.log(rms(new Float32Array([0.25, 0.75])), "above 0.5");
console.log(rms(new Float32Array([1, -1, 1, -1])), 1);
