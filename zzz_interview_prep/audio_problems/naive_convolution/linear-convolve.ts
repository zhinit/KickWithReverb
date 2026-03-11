import { dft } from "./dft.ts";
import { idft } from "./idft.ts";
import type { Spectra } from "./multiply-spectra.ts";
import { multiplySpectra } from "./multiply-spectra.ts";

export function linearConvolve(
  dry: Float32Array,
  ir: Float32Array,
): Float32Array {
  // calculate extended length
  const bufferLength = dry.length + ir.length - 1;
  // padd the buffers
  const paddedDry = new Float32Array(bufferLength);
  const paddedIr = new Float32Array(bufferLength);
  for (let i = 0; i < dry.length; i++) {
    paddedDry[i] = dry[i];
    paddedIr[i] = ir[i];
  }
  // dft input buffers
  const drySpectra: Spectra = dft(paddedDry);
  const irSpectra: Spectra = dft(paddedIr);
  // multiply the dft results
  const babySpectra: Spectra = multiplySpectra(drySpectra, irSpectra);
  // idft the result
  const convolvedBuffer = idft(babySpectra);
  return convolvedBuffer;
}

/*
console.log(
  linearConvolve(
    new Float32Array([1, 0, -1, 0]),
    new Float32Array([1, 0, 0, 0]),
  ),
);
console.log(
  linearConvolve(
    new Float32Array([1, 0, -1, 0]),
    new Float32Array([0, 0, 1, 0]),
  ),
);
*/
