function applyLowpass(
  inputBuffer: Float32Array,
  cutoffHz: number,
  sampleRate: number,
): Float32Array {
  const outputBuffer = new Float32Array(inputBuffer);

  // handle trivial cases
  if (inputBuffer.length === 0 || cutoffHz <= 0 || cutoffHz >= sampleRate / 2)
    return outputBuffer;

  // apply filter
  const alpha = Math.exp((-2 * Math.PI * cutoffHz) / sampleRate);
  let prevOutSample = 0;
  for (let i = 0; i < inputBuffer.length; i++) {
    outputBuffer[i] = (1 - alpha) * inputBuffer[i] + alpha * prevOutSample;
    prevOutSample = outputBuffer[i];
  }
  return outputBuffer;
}
