import { describe, expect, it } from 'vitest';
import { audioRms } from './audio-level';

describe('audioRms', () => {
	it('reports silence and empty buffers as zero level', () => {
		expect(audioRms(new Float32Array())).toBe(0);
		expect(audioRms(new Float32Array([0, 0, 0]))).toBe(0);
	});

	it('measures quiet signals that 8-bit samples would round to silence', () => {
		expect(audioRms(new Float32Array([0.002, -0.002, 0.002, -0.002]))).toBeCloseTo(0.002);
		expect(audioRms(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
	});
});
