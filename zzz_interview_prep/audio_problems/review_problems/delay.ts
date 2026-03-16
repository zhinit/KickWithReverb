// i want to have a dry and wet signal
// combine at end with output = dry (1 - mix) + mix * wet
// wet is a delayed line which will take delayed input from dry
// as well as feedback (ie delay input from wet)

function delay(
  buffer: Float32Array,
  sampleRate: number,
  delayMs: number,
  feedback: number,
  wet: number
): Float32Array {
  const wetBuffer = new Float32Array(buffer.length);
  const output = new Float32Array(buffer.length);
  
  const delaySamples = Math.round(delayMs / 1000 * sampleRate);

  for (let i = 0; i < buffer.length; i++) {
    if (i < delaySamples) {
      output[i] = buffer[i] * (1 - wet);
    } else {
      wetBuffer[i] = buffer[i - delaySamples] + feedback * wetBuffer[i - delaySamples];
      output[i] = buffer[i] * (1- wet) + wetBuffer[i] * wet;
    }
  }
  return output;
}

console.log(delay(
  new Float32Array([1, 0, 0, 0]),
  2,
  1000,
  0.5,
  0.5
))

console.log(delay(
  new Float32Array([1, 0, 0, 0, 0, 0, 0, 0]),
  2,
  1000,
  0.4,
  0.6
))
