function applyHannWindow(buffer: Float32Array): Float32Array {
  const n = buffer.length;

  // handle empty case and 1 case so we dont divide by 0
  if (n === 0) return new Float32Array([]);
  if (n === 1) return new Float32Array([buffer[0]]);

  const hannBuffer = new Float32Array(buffer.length);
  for (let i = 0; i < n; i++) {
    const inSample = buffer[i];
    const hannSample =
      inSample * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    hannBuffer[i] = hannSample;
  }

  return hannBuffer;
}

console.log(applyHannWindow(new Float32Array([1, 0, -1, 0])));
console.log(applyHannWindow(new Float32Array([])));
console.log(applyHannWindow(new Float32Array([1])));
