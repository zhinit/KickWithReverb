import { linearConvolve } from "./linear-convolve.ts";

class OverlapAddConvolver {
  overlapBuffer: Float32Array;
  ir: Float32Array;

  constructor() {}

  loadIr(ir: Float32Array): void {
    this.ir = ir;
    // block size + ir length - 1 - block size
    this.overlapBuffer = new Float32Array(this.ir.length - 1);
  }

  process(dry: Float32Array): Float32Array {
    // calculate linear convolution of current dry block and ir
    const fullConvolution = linearConvolve(dry, this.ir);

    const wet = new Float32Array(dry.length);
    for (let i = 0; i < fullConvolution.length; i++) {
      const oldOverlap =
        i < this.overlapBuffer.length ? this.overlapBuffer[i] : 0;
      if (i < dry.length) {
        // calculate wet peice using beg of current full convolution and previous segments
        wet[i] = fullConvolution[i] + oldOverlap;
      } else {
        // update tail for the next go around
        this.overlapBuffer[i - dry.length] = fullConvolution[i] + oldOverlap;
      }
    }
    return wet;
  }
}

const ir = new Float32Array([0, 1, 0, 0, 0, 0, 0, 0]);
const convolver = new OverlapAddConvolver();
convolver.loadIr(ir);

let dry = new Float32Array([1, 0.5, 0, -0.5, -1, -0.5, 0, 0.5]);
console.log(convolver.process(dry));
