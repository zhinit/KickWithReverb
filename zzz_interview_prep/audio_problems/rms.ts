type audioArray = number[];

function rms(arr: audioArray): number {
  if (arr.length === 0) return 0;

  let runningTotal = 0;
  for (const sample of arr) {
    runningTotal += sample**2;
  }
  return ( runningTotal / arr.length ) ** (1/2);
}

console.log(rms([]));
console.log(rms([1, 1, 1]));
console.log(rms([1, 0.5, -1]));
console.log(rms([-1, -0.5, 1]));
console.log(rms([0, 0]));
console.log(rms([-1, -1, -1]));
