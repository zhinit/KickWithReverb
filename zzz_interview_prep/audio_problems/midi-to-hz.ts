// midi to hz

function parseMidiString(midiString: string): [string, number] {
	let octaveString = "";
	let note = "";

	for (const char of midiString) {
		if (!"0123456789".includes(char)) note += char;
		else octaveString += char;
	}
	return [note, Number(octaveString)]
}

function midiToHz(midiNote: string): number {
	const [midiLetters, midiOctave] = parseMidiString(midiNote);

	const noteToSemi: Record<String, number> = {
		"C": 0,
		"C#": 1,
		"Db": 1,
		"D": 2,
		"D#": 3,
		"Eb": 3,
		"E": 4,
		"F": 5,
		"F#": 6,
		"Gb": 6,
		"G": 7,
		"G#": 8,
		"Ab": 8,
		"A": 9,
		"A#": 10,
		"Bb": 10,
		"B": 11,
	}

	const midiNoteNumber = (1 + midiOctave) * 12 + noteToSemi[midiLetters];
	const semisFromA4 = midiNoteNumber - 69;
	const hz = 440.0 * 2**(semisFromA4/12);
	return hz;
}

console.log(midiToHz("A4"));
console.log(midiToHz("C3"));
console.log(midiToHz("A3"));
console.log(midiToHz("A2"));
console.log(midiToHz("Bb3"));

