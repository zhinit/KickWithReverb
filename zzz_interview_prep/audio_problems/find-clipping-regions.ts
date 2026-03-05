function findClippingRegions(
  buffer: Float32Array,
  thresholdDb: number,
): [number, number][] {
  const gainThreshold = 10 ** (thresholdDb / 20);
  const clippingRegions: [number, number][] = [];

  let clipStart = 0;
  let clipEnd = 0;
  let inClippingRegion = false;

  for (let i = 0; i < buffer.length; i++) {
    const sample = buffer[i];

    if (Math.abs(sample) > gainThreshold) {
      if (!inClippingRegion) {
        inClippingRegion = true;
        clipStart = i;
      }
      clipEnd = i;
    } else {
      if (inClippingRegion) {
        inClippingRegion = false;
        clippingRegions.push([clipStart, clipEnd]);
      }
    }
  }

  if (inClippingRegion) {
    clippingRegions.push([clipStart, clipEnd]);
  }

  return clippingRegions;
}

console.log(findClippingRegions(new Float32Array([]), 0));
console.log(findClippingRegions(new Float32Array([1]), 0));
console.log(
  findClippingRegions(
    new Float32Array([1, 0.75, 0.25, 0, -0.25, -0.4, -0.6, -1]),
    -6,
  ),
);
