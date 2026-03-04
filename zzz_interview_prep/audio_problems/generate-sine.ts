function generateSine(
  frequencyHz: number,
  durationSeconds: number,
  sampleRate: number,
): number[] {
  // lets first calculate the size of the buffer
  const bufferDuration = durationSeconds * sampleRate;

  // then lets create the buffer and put the sine in it
  // no amplitude adjustment since sine is in [-1, 1]
  // regular sin(x) repeats every 2PI
  // our sin needs to repeat frequency times per second
  const audioBuffer: number[] = new Array(bufferDuration);
  for (let i = 0; i < bufferDuration; i++) {
    const time = i / sampleRate;
    audioBuffer[i] = Math.sin(frequencyHz * time * 2 * Math.PI);
  }

  return audioBuffer;
}

console.log(generateSine(1, 2, 10));
console.log(generateSine(1, 1, 20));
