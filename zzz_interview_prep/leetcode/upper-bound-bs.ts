function upperBound(nums: number[], target: number): number {
  let left = 0;
  let right = nums.length;
  while (left < right) {
    const mid = Math.round((left + right) / 2);
    if (nums[mid] <= target) left = mid + 1;
    else right = mid;
  }
  return left;
}

console.log(upperBound([1, 2, 3, 4, 5], 3.5));
