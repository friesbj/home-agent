/** Root mean square of time-domain samples in the range -1 to 1; 0 is silence. */
export function audioRms(samples: ArrayLike<number>): number {
	if (samples.length === 0) return 0;
	let sum = 0;
	for (let index = 0; index < samples.length; index++) {
		sum += samples[index] * samples[index];
	}
	return Math.sqrt(sum / samples.length);
}
