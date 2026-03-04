function equalPowerPanl2(pan: number): [number, number] {
  const rightGainLinear = (pan + 1) / 2;
  const leftGainLinear = 1 - rightGainLinear;

  // we want l^2 + r^2 = 1 always
  // so lets use the l2 norm
  const leftGain =
    (leftGainLinear ** 2 / (leftGainLinear ** 2 + rightGainLinear ** 2)) **
    (1 / 2);
  const rightGain =
    (rightGainLinear ** 2 / (leftGainLinear ** 2 + rightGainLinear ** 2)) **
    (1 / 2);

  return [leftGain, rightGain];
}

console.log(equalPowerPanl2(-1));
console.log(equalPowerPanl2(1));
console.log(equalPowerPanl2(0));

function equalPowerPanTrig(pan: number): [number, number] {
  // we want l^2 + r^2 = 1
  // we can use the unit circle to solve this
  const angle = (((pan + 1) / 2) * Math.PI) / 2;
  return [Math.cos(angle), Math.sin(angle)];
}

console.log("");
console.log(equalPowerPanTrig(-1));
console.log(equalPowerPanTrig(1));
console.log(equalPowerPanTrig(0));
