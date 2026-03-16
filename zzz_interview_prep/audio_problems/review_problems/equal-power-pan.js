// equal power pan
// take in
//  buffer: Float32Array
//  pan: number in [-1, 1]
//
// return [Float32Array, Float32Array] for left and right channels
//
// we want to pan based on unit circle.
// ie cos(theta) for left sin(theta) for right
// theta is angle from 0 to Pi/2
// so we must map pan from -1, 1 to 0, Pi/2
// first map from -1, 1 to 0, 1
// then from 0, 1 to 0, Pi/2
function equalPowerPan(buffer, pan) {
    var zeroOnePan = (pan + 1) / 2;
    var theta = zeroOnePan * Math.PI / 2;
    var left = new Float32Array(buffer.length);
    var right = new Float32Array(buffer.length);
    for (var i = 0; i < buffer.length; i++) {
        left[i] = buffer[i] * Math.cos(theta);
        right[i] = buffer[i] * Math.sin(theta);
    }
    return [left, right];
}
console.log(equalPowerPan(new Float32Array([1, 1]), 0), "all left");
console.log(equalPowerPan(new Float32Array([1, 1]), 1), "all right");
console.log(equalPowerPan(new Float32Array([1, 1]), 0.5), "middle unit circle. ie 0.707");
