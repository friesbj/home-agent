import { describe, expect, it } from 'vitest';
import { orbAnimates, orbFrame, type OrbVisual } from './orb-visual';

describe('orbAnimates', () => {
	it('moves only while connecting, listening, speaking, or thinking', () => {
		const moving: OrbVisual[] = ['connecting', 'listening', 'speaking', 'thinking'];
		expect(moving.every(orbAnimates)).toBe(true);
		const still: OrbVisual[] = ['idle', 'confirming', 'muted', 'error'];
		expect(still.some(orbAnimates)).toBe(false);
	});
});

describe('orbFrame', () => {
	it('keeps still states motionless regardless of level or time', () => {
		for (const orb of ['idle', 'confirming', 'muted', 'error'] as OrbVisual[]) {
			expect(orbFrame(orb, 1, 5000)).toEqual({ mode: 'none', pulse: 1, glow: 0, rotation: 0 });
		}
	});

	it('grows the listening pulse and glow with the audio level', () => {
		const quiet = orbFrame('listening', 0.1, 0);
		const loud = orbFrame('listening', 0.9, 0);
		expect(loud.pulse).toBeGreaterThan(quiet.pulse);
		expect(loud.glow).toBeGreaterThan(quiet.glow);
		expect(quiet.mode).toBe('rings');
	});

	it('clamps the level so a spike cannot blow up the pulse', () => {
		expect(orbFrame('speaking', 5, 0)).toEqual(orbFrame('speaking', 1, 0));
	});

	it('makes speaking more energetic than listening at the same level', () => {
		expect(orbFrame('speaking', 0.5, 0).pulse).toBeGreaterThan(orbFrame('listening', 0.5, 0).pulse);
	});

	it('rotates connecting and thinking with time but not with level', () => {
		expect(orbFrame('connecting', 0, 1200).rotation).toBeGreaterThan(
			orbFrame('connecting', 0, 0).rotation
		);
		expect(orbFrame('thinking', 0, 12000).rotation).toBeGreaterThan(
			orbFrame('thinking', 0, 0).rotation
		);
		expect(orbFrame('connecting', 1, 600).rotation).toBe(orbFrame('connecting', 0, 600).rotation);
	});
});
