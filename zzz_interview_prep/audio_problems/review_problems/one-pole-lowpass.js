// we want to take weighted average of current and last sample
// this way high frequencies phase cancel out
// low frequencies are largely uneffected
function onePoleLowPass(buffer, sampleRate, cutoffHz) {
    var a = Math.exp(2 * Math.PI * cutoffHz / sampleRate);
    var output = new Float32Array(buffer.length);
    var prevSample = 0;
    for (var i = 0; i < buffer.length; i++) {
        output[i] = buffer[i] * (1 - a) + a * prevSample;
        prevSample = output[i];
    }
    return output;
}
console.log(onePoleLowPass(new Float32Array([1, 0.75, 0.5, 0.25, 0, -0.25, -0.5, -0.75]), 16, 1));
