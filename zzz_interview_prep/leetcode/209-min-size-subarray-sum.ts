// given
//   array of pos ints. nums
//   pos int, target
//
// return
//   min length of subarray
//   whose sum is greater than or equal to target
//   if no exist return 0
//
// use sliding window
// result is a length (right - left + 1)
// window state is sum >= target

function minSizeSubarraySum(nums: number[], target: number) {
  let left = 0;
  let sum = 0;
  let minSize = Infinity;

  for (let right = 0; right < nums.length; right++) {
    // update window for new right
    sum += nums[right];
    // actions if window is valid
    while (sum >= target) {
      minSize = Math.min(minSize, right - left + 1);
      sum -= nums[left];
      left++;
    }
  }
  return minSize === Infinity ? 0 : minSize;
}

console.log(minSizeSubarraySum([2, 4, 3], 7));
