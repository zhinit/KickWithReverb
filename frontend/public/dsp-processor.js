class DSPProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.engine = null;
    this.module = null;
    this.heapBufferLeft = null;
    this.heapBufferRight = null;
    this.port.onmessage = (e) => this.handleMessage(e.data);

    this.lateWorkerPort = null;
    this.lateResultLeft = null;
    this.lateResultRight = null;
  }

  async handleMessage(data) {
    if (data.type === "init") {
      const fn = new Function(data.scriptCode + "; return createAudioEngine;");
      const createAudioEngine = fn();
      const module = await createAudioEngine();
      this.engine = new module.AudioEngine();
      this.engine.prepare(sampleRate);
      this.module = module;
      this.port.postMessage({ type: "ready" });
      return;
    }

    if (!this.engine || !this.module) return;

    switch (data.type) {
      // Sample loading
      case "loadKickSample": {
        const ptr = this.module._malloc(data.samples.length * 4);
        this.module.HEAPF32.set(data.samples, ptr / 4);
        this.engine.loadKickSample(ptr, data.samples.length);
        this.module._free(ptr);
        break;
      }
      case "loadNoiseSample": {
        const ptr = this.module._malloc(data.samples.length * 4);
        this.module.HEAPF32.set(data.samples, ptr / 4);
        this.engine.loadNoiseSample(ptr, data.samples.length);
        this.module._free(ptr);
        break;
      }
      case "loadIR": {
        const ptr = this.module._malloc(data.irSamples.length * 4);
        this.module.HEAPF32.set(data.irSamples, ptr / 4);
        this.engine.loadIR(ptr, data.irLength, data.numChannels);
        this.module._free(ptr);
        break;
      }
      case "lateWorkerPort":
        this.lateWorkerPort = data.port;
        this.lateWorkerPort.onmessage = (e) => this.handleLateResult(e.data);
        break;

      // Sample selection
      case "selectKickSample":
        this.engine.selectKickSample(data.index);
        break;
      case "selectNoiseSample":
        this.engine.selectNoiseSample(data.index);
        break;
      case "selectIR":
        this.engine.selectIR(data.index);
        break;

      // Transport
      case "cue":
        this.engine.cue();
        break;
      case "cueRelease":
        this.engine.cueRelease();
        break;
      case "loop":
        this.engine.setLooping(data.enabled);
        break;
      case "bpm":
        this.engine.setBPM(data.value);
        break;

      // Kick parameters
      case "kickLength":
        this.engine.setKickLength(data.value);
        break;
      case "kickDistortion":
        this.engine.setKickDistortion(data.value);
        break;
      case "kickOTT":
        this.engine.setKickOTT(data.value);
        break;

      // Noise parameters
      case "noiseVolume":
        this.engine.setNoiseVolume(data.value);
        break;
      case "noiseLowPass":
        this.engine.setNoiseLowPass(data.value);
        break;
      case "noiseHighPass":
        this.engine.setNoiseHighPass(data.value);
        break;

      // Reverb parameters
      case "reverbLowPass":
        this.engine.setReverbLowPass(data.value);
        break;
      case "reverbHighPass":
        this.engine.setReverbHighPass(data.value);
        break;
      case "reverbVolume":
        this.engine.setReverbVolume(data.value);
        break;

      // Master parameters
      case "masterOTT":
        this.engine.setMasterOTT(data.value);
        break;
      case "masterDistortion":
        this.engine.setMasterDistortion(data.value);
        break;
      case "masterLimiter":
        this.engine.setMasterLimiter(data.value);
        break;
    }
  }

  process(inputs, outputs) {
    if (!this.engine || !this.module) return true;

    const leftOutput = outputs[0][0];
    const rightOutput = outputs[0][1];
    const numSamples = leftOutput.length;

    // Allocate heap buffers if needed
    if (!this.heapBufferLeft || this.heapBufferLeft.length < numSamples) {
      if (this.heapBufferLeft) this.module._free(this.heapBufferLeft);
      if (this.heapBufferRight) this.module._free(this.heapBufferRight);
      this.heapBufferLeft = this.module._malloc(numSamples * 4);
      this.heapBufferRight = this.module._malloc(numSamples * 4);
    }

    // Process audio through WASM engine
    this.engine.process(this.heapBufferLeft, this.heapBufferRight, numSamples);

    // Copy from WASM heap to JS output buffers
    const wasmLeft = new Float32Array(
      this.module.HEAPF32.buffer, // buffer
      this.heapBufferLeft, // byte offset address
      numSamples, // number of float elements
    );
    const wasmRight = new Float32Array(
      this.module.HEAPF32.buffer,
      this.heapBufferRight,
      numSamples,
    );

    // put buffers into browser audio output
    leftOutput.set(wasmLeft);
    rightOutput.set(wasmRight);

    // add late result
    if (this.lateResultLeft && this.lateResultRight) {
      for (let i = 0; i < numSamples; i++) {
        leftOutput[i] += this.lateResultLeft[i];
        rightOutput[i] += this.lateResultRight[i];
      }
    }

    // senf dry signal to late convolution
    if (this.lateWorkerPort) {
      const left = wasmLeft.slice();
      const right = wasmRight.slice();
      this.lateWorkerPort.postMessage(
        { type: "process", data: { left, right } },
        [left.buffer, right.buffer],
      );
    }

    // stayin' alive
    return true;
  }

  handleLateResult(data) {
    this.lateResultLeft = data.left;
    this.lateResultRight = data.right;
  }
}

// register the processor with the browser
registerProcessor("dsp-processor", DSPProcessor);
