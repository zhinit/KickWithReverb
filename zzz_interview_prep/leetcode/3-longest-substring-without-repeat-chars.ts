// given
//  string s
//
// return
//  length of longest substring w/o repeat chars
//
// this is a max sliding window problem
// result is window length (right - left + 1)
// window state is no repeat chars
//

function longNoRepeat(s: string): number {
  let left = 0;
  let long = 0;
  let charCounts: Record<string, number> = {};

  for (let right = 0; right < s.length; right++) {
    // add right to window
    const rightChar = s[right];
    if (rightChar in charCounts) {
      charCounts[rightChar] += 1;
    } else {
      charCounts[rightChar] = 1;
    }

    // shrink window if dup
    while (charCounts[rightChar] > 1) {
      const leftChar = s[left];
      charCounts[leftChar] -= 1;
      left++;
    }
    // now window is valid so update long
    long = Math.max(long, right - left + 1);
  }
  return long;
}

console.log(longNoRepeat("abcabc"));
console.log(longNoRepeat("aaaaa"));
