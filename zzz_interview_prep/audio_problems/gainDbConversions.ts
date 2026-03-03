// convert gain to db
// convert db to gain
// 0db -> 1 gain
// 6db -> 2 gain
// -6db -> 0.5 gain

function dbToGain(db: number): number {
	// e^(6c) = 2		e^(0c) = 1	e^(-6c) = 0.5
	// 6c = ln(2)		c = whatever	-6c = ln(0.5)
	// c = ln(2) / 6			c = ln(2)/6
	return Math.exp(db * Math.log(2) / 6.0)
}

// inverse of dbToGain
function gainToDb(gain: number): number {
	if (gain < 0) return -Infinity;
	return Math.log(gain) / Math.log(2) * 6.0;
}

console.log(dbToGain(-6));
console.log(dbToGain(0));
console.log(dbToGain(6));

console.log(gainToDb(0));
console.log(gainToDb(-1));
console.log(gainToDb(1));
console.log(gainToDb(2));
