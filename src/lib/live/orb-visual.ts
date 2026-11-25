/**
 * Visual model for the voice stage orb. The canvas renderer reads a frame from
 * {@link orbFrame} and draws it; keeping the maths here makes the motion
 * testable without a canvas and keeps it driven only by the session state and
 * the real audio level.
 */

export type OrbVisual =
	'idle' | 'connecting' | 'listening' | 'speaking' | 'thinking' | 'confirming' | 'muted' | 'error';

const TAU = Math.PI * 2;

/** Only these states move; the rest are drawn once as the static sphere. */
const MOTION_STATES: ReadonlySet<OrbVisual> = new Set<OrbVisual>([
	'connecting',
	'listening',
	'speaking',
	'thinking'
]);

export function orbAnimates(orb: OrbVisual): boolean {
	return MOTION_STATES.has(orb);
}

/** How the canvas should draw this frame. */
export type OrbMode = 'none' | 'rings' | 'arc' | 'dashes';

export interface OrbFrame {
	mode: OrbMode;
	/** Radius of the reactive aura relative to the core, at least 1. */
	pulse: number;
	/** Opacity of the aura, 0..1. */
	glow: number;
	/** Rotation of an arc or dashed ring, in radians. */
	rotation: number;
}

const STILL: OrbFrame = { mode: 'none', pulse: 1, glow: 0, rotation: 0 };

/**
 * Computes the orb frame for a state, a smoothed audio level (0..1), and a time
 * in milliseconds. Listening and speaking scale with the level; connecting and
 * thinking rotate with time; every other state is still.
 */
export function orbFrame(orb: OrbVisual, level: number, timeMs: number): OrbFrame {
	const value = Math.max(0, Math.min(1, level));
	switch (orb) {
		case 'connecting':
			return { mode: 'arc', pulse: 1, glow: 0.55, rotation: (timeMs / 2400) * TAU };
		case 'thinking':
			return { mode: 'dashes', pulse: 1, glow: 0.4, rotation: (timeMs / 24000) * TAU };
		case 'listening':
			return { mode: 'rings', pulse: 1 + value * 0.12, glow: 0.4 + value * 0.5, rotation: 0 };
		case 'speaking':
			return { mode: 'rings', pulse: 1.04 + value * 0.18, glow: 0.65 + value * 0.35, rotation: 0 };
		default:
			return STILL;
	}
}
