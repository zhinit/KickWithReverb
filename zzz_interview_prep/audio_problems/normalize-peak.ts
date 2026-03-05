function normalizePeak(buffer: Float32Array, targetDb: number): Float32Array {
  // find target gain
  const targetGain = 10 ** (targetDb / 20);

  // find max magnitude sample
  let maxSample = 0;
  for (const sample of buffer) {
    maxSample = Math.max(maxSample, Math.abs(sample));
  }

  if (maxSample === 0) return new Float32Array(buffer.length);

  // normalize the buffer
  // go from range 0 to maxSample
  // to range 0 to targetGain
  // so maxSample * C = targetGain
  // C = targetGain / maxSample
  const normalizedBuffer = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const sample = buffer[i];
    const normalizedSample = (sample * targetGain) / maxSample;
    normalizedBuffer[i] = normalizedSample;
  }

  return normalizedBuffer;
}

console.log(normalizePeak(new Float32Array([1, 1]), 0));
console.log(normalizePeak(new Float32Array([1, 1]), 6));
console.log(normalizePeak(new Float32Array([1, 1]), -6));
console.log("");
console.log(normalizePeak(new Float32Array([0.5, -0.5]), 0));
console.log(normalizePeak(new Float32Array([-0.5, -0.5]), 6));
console.log(normalizePeak(new Float32Array([0.5, 0.5]), -6));
console.log("");
console.log(normalizePeak(new Float32Array([0, 0]), -6));
console.log(normalizePeak(new Float32Array([]), -6));
