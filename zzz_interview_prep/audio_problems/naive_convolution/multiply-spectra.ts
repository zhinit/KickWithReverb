export type Spectra = { real: number; imaginary: number }[];

export function multiplySpectra(dry: Spectra, ir: Spectra): Spectra {
  // note on multipying complex numbers
  // (a + bi) (c + di)
  // ac + bci + adi + bdi^2
  // ac - bd + i(bc + ad)
  if (dry.length !== ir.length)
    throw new Error("cannot multiply spectra of different lengths");

  const resultingSpectra: Spectra = [];
  for (let i = 0; i < dry.length; i++) {
    const { real: a, imaginary: b } = dry[i];
    const { real: c, imaginary: d } = ir[i];
    const iReal = a * c - b * d;
    const iImaginary = b * c + a * d;
    resultingSpectra.push({ real: iReal, imaginary: iImaginary });
  }
  return resultingSpectra;
}

/*
console.log(
  multiplySpectra([{ real: 1, imaginary: 2 }], [{ real: 3, imaginary: 4 }]),
);
*/
