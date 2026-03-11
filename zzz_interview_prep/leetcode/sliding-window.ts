function slidingWindow(arr: number[]): number {
  let left = 0;
  let result = 0;
  // window state
  
  for (let right = 0; right < arr.length; right++) {
    // add arr[right] to window

    while (/* window is invalid */) {
      // remove arr[left] from window
      // left++;
    }

    result = Math.max(result, right - left + 1);
  }
  return result
}
