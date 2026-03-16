// hann window
// takes float32array is input and output
// applies x[n] = 0.5(1 - cos(2Pi n / (N-1)))
function hannWindow(buffer) {
    var output = new Float32Array(buffer.length);
    for (var i = 0; i < buffer.length; i++) {
        output[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (buffer.length - 1)));
    }
    return output;
}
console.log(hannWindow(new Float32Array([1, 0.5, 0, -0.5])));
