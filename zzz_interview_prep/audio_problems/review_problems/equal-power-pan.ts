function equalPowerPan(position: number): [number, number] {
  // clamp input
  position = Math.max(-1, Math.min(1, position));
  // for equal power pan we want to have squared amplitudes (power) to be equal
  // this is left^2 + right^2 = 1^2
  // the solution to this lies on the unit circle
  const zeroOnePan = (position + 1) / 2;
  const leftGain = Math.cos(zeroOnePan * (Math.PI / 2));
  const rightGain = Math.sin(zeroOnePan * (Math.PI / 2));
  return [leftGain, rightGain];
}

console.log(equalPowerPan(-1), [1, 0]);
console.log(equalPowerPan(1), [0, 1]);
console.log(equalPowerPan(0), [0.707, 0.707]);
