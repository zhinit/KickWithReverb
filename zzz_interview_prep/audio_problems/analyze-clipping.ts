function analyzeClipping(buffer: number[]): number {
  let maxClipAmt = 0;
  for (const sample of buffer) {
    maxClipAmt = Math.max(maxClipAmt, Math.abs(sample) - 1);
  }
  return maxClipAmt;
}

console.log(analyzeClipping([0, 0, 0, 0]));
console.log(analyzeClipping([-4, -3, -2, -1]));
console.log(analyzeClipping([4, 3, 2, 1]));
console.log(analyzeClipping([-1, 1, -1, 1]));
console.log(analyzeClipping([]));
