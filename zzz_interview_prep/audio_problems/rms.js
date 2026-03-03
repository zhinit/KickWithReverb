function rms(arr) {
    if (arr.length === 0)
        return 0;
    var runningTotal = 0;
    for (var _i = 0, arr_1 = arr; _i < arr_1.length; _i++) {
        var sample = arr_1[_i];
        runningTotal += Math.pow(sample, 2);
    }
    return Math.pow((runningTotal / arr.length), (1 / 2));
}
console.log(rms([]));
console.log(rms([1, 1, 1]));
console.log(rms([1, 0.5, -1]));
console.log(rms([-1, -0.5, 1]));
console.log(rms([0, 0]));
console.log(rms([-1, -1, -1]));
