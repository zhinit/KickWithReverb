function encodeMidSide(
  left: Float32Array,
  right: Float32Array,
): { mid: Float32Array; side: Float32Array } {
  if (left.length !== right.length)
    throw new Error("Left and right channels must be of the same length");

  const mid = new Float32Array(left.length);
  const side = new Float32Array(left.length);

  for (let i = 0; i < left.length; i++) {
    mid[i] = (left[i] + right[i]) / 2;
    side[i] = (left[i] - right[i]) / 2;
  }
  return { mid, side };
}

function decodeMidSide(
  mid: Float32Array,
  side: Float32Array,
): { left: Float32Array; right: Float32Array } {
  if (mid.length !== side.length)
    throw new Error("mid and side channels must have the same length");

  const left = new Float32Array(mid.length);
  const right = new Float32Array(mid.length);

  for (let i = 0; i < mid.length; i++) {
    left[i] = mid[i] + side[i];
    right[i] = mid[i] - side[i];
  }
  return { left, right };
}

console.log(
  encodeMidSide(
    new Float32Array([0, 1, 0, -1]),
    new Float32Array([0, 1, 0, -1]),
  ),
);

console.log(
  encodeMidSide(
    new Float32Array([1, 1, 1, 1]),
    new Float32Array([-1, -1, -1, -1]),
  ),
);

console.log(
  decodeMidSide(
    new Float32Array([0, 1, 0, -1]),
    new Float32Array([0, 0, 0, 0]),
  ),
);

console.log(
  decodeMidSide(new Float32Array([0, 0, 0, 0]), new Float32Array([1, 1, 1, 1])),
);
