import { dft } from "./dft.ts";
import { idft } from "./idft.ts";
import type { Spectra } from "./multiply-spectra.ts";
import { multiplySpectra } from "./multiply-spectra.ts";

function circularConvolve(dry: Float32Array, ir: Float32Array): Float32Array {
  if (dry.length !== ir.length)
    throw new Error("dry and ir buffer should be of same length");
  // dft input buffers
  const drySpectra: Spectra = dft(dry);
  const irSpectra: Spectra = dft(ir);
  // multiply the dft results
  const babySpectra: Spectra = multiplySpectra(drySpectra, irSpectra);
  // idft the result
  const convolvedBuffer = idft(babySpectra);
  return convolvedBuffer;
}

/*
console.log(
  circularConvolve(
    new Float32Array([1, 0, -1, 0]),
    new Float32Array([1, 0, 0, 0]),
  ),
);
console.log(
  circularConvolve(
    new Float32Array([1, 0, -1, 0]),
    new Float32Array([0, 0, 1, 0]),
  ),
);
*/
