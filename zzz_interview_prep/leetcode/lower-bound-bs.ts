function lowerBound(nums: number[], target: number): number {
  let left = 0;
  let right = nums.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (nums[mid] < target) left = mid + 1;
    else right = mid;
  }
  return left;
}

console.log(lowerBound([0, 1, 2, 3, 4], 2.1));
console.log(lowerBound([0, 1, 2, 3, 4], 3));
console.log(lowerBound([0, 1, 2, 3, 4], 3.1));
