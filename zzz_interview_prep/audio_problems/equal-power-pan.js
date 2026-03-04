function equalPowerPan(pan) {
    var leftGainLinear = (pan + 1) / 2;
    var rightGainLinear = 1 - leftGainLinear;
    // we want l^2 + r^2 = 1 always
    // so lets use the l2 norm
    var leftGain = Math.pow((Math.pow(leftGainLinear, 2) / (Math.pow(leftGainLinear, 2) + Math.pow(rightGainLinear, 2))), (1 / 2));
    var rightGain = Math.pow((Math.pow(rightGainLinear, 2) / (Math.pow(leftGainLinear, 2) + Math.pow(rightGainLinear, 2))), (1 / 2));
    return [leftGain, rightGain];
}
console.log(equalPowerPan(-1));
console.log(equalPowerPan(1));
console.log(equalPowerPan(0));
