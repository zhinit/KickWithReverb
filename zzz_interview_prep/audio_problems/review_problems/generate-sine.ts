function createSine(
  frequency: number,
  duration: number,
  sampleRate: number,
): Float32Array {
  if (frequency <= 0 || duration <= 0 || sampleRate <= 0)
    return new Float32Array([]);
  // calcualte total number of samples and create buffer
  const totalSamples = duration * sampleRate;
  const sineBuffer = new Float32Array(totalSamples);

  // loop through buffer to compute sine in the buffer
  for (let i = 0; i < totalSamples; i++) {
    const time = i / sampleRate;
    sineBuffer[i] = Math.sin(frequency * time * 2 * Math.PI);
  }
  return sineBuffer;
}

console.log(createSine(1, 2, 8));
console.log(createSine(-1, -1, -1));
