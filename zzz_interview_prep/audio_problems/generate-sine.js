function generateSine(frequencyHz, durationSeconds, sampleRate) {
    // lets first calculate the size of the buffer
    var bufferDuration = durationSeconds * sampleRate;
    // then lets create the buffer and put the sine in it
    // no amplitude adjustment since sine is in [-1, 1]
    // regular sin(x) repeats every 2PI
    // our sin needs to repeat frequency times per second
    var audioBuffer = new Array(bufferDuration);
    for (var i = 0; i < bufferDuration; i++) {
        audioBuffer[i] = Math.sin((frequencyHz * i) / (Math.PI / 2));
    }
    return audioBuffer;
}
console.log(generateSine(1, 2, 10));
