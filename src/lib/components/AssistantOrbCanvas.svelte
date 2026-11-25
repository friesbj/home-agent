<script lang="ts">
	import AssistantOrb from './AssistantOrb.svelte';
	import { orbFrame, type OrbVisual } from '$lib/live/orb-visual';

	let { orb, getLevel }: { orb: OrbVisual; getLevel?: () => number } = $props();

	let canvas = $state<HTMLCanvasElement>();
	const TAU = Math.PI * 2;
	// The canvas is larger than the sphere so the pulse and its glow have room and
	// are not clipped at the canvas edge. The sphere keeps the wrapper's footprint.
	const OVERSCAN = 1.5;

	// The canvas draws the moving aura over the static sphere. With reduced motion
	// or without a 2D context it stays blank, leaving the SVG sphere as the fallback.
	$effect(() => {
		const element = canvas;
		if (!element) return;
		const context = element.getContext('2d');
		if (!context) return;

		const reduce =
			typeof window !== 'undefined' && window.matchMedia
				? window.matchMedia('(prefers-reduced-motion: reduce)')
				: undefined;

		let frame = 0;
		let smoothed = 0;
		let width = 0;
		let height = 0;

		const resize = () => {
			const rect = element.getBoundingClientRect();
			const dpr = window.devicePixelRatio || 1;
			width = rect.width;
			height = rect.height;
			element.width = Math.max(1, Math.round(width * dpr));
			element.height = Math.max(1, Math.round(height * dpr));
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		const clear = () => context.clearRect(0, 0, width, height);

		const draw = (time: number) => {
			clear();
			const target = Math.max(0, Math.min(1, getLevel?.() ?? 0));
			smoothed += (target - smoothed) * 0.25;
			const shape = orbFrame(orb, smoothed, time);
			if (shape.mode !== 'none') {
				const cx = width / 2;
				const cy = height / 2;
				// The sphere fills the inner part of the canvas; the rest is pulse headroom.
				const core = Math.min(width, height) / 2 / OVERSCAN;
				if (shape.mode === 'rings') {
					// Soft halo that widens and brightens with the audio level.
					const auraR = core * (1 + smoothed * 0.45);
					const aura = context.createRadialGradient(cx, cy, core * 0.55, cx, cy, auraR);
					aura.addColorStop(0, `rgba(143, 191, 255, ${shape.glow * 0.45})`);
					aura.addColorStop(1, 'rgba(143, 191, 255, 0)');
					context.fillStyle = aura;
					context.beginPath();
					context.arc(cx, cy, auraR, 0, TAU);
					context.fill();
					// Rings that hug the sphere edge and breathe outward, with a glowing blur.
					context.save();
					context.shadowBlur = core * (0.1 + shape.glow * 0.14);
					context.shadowColor = `rgba(159, 201, 255, ${shape.glow})`;
					context.lineWidth = core * 0.04;
					for (const [index, spread] of [0.86, 0.98].entries()) {
						context.beginPath();
						context.arc(cx, cy, core * spread * shape.pulse, 0, TAU);
						context.strokeStyle = `rgba(182, 214, 255, ${shape.glow * (index === 0 ? 0.7 : 0.45)})`;
						context.stroke();
					}
					context.restore();
				} else if (shape.mode === 'arc') {
					context.save();
					context.shadowBlur = core * 0.2;
					context.shadowColor = `rgba(127, 220, 255, ${shape.glow})`;
					context.beginPath();
					context.arc(cx, cy, core * 1.02, shape.rotation, shape.rotation + Math.PI / 2);
					context.strokeStyle = `rgba(127, 220, 255, ${shape.glow})`;
					context.lineWidth = core * 0.05;
					context.lineCap = 'round';
					context.stroke();
					context.restore();
				} else {
					context.save();
					context.translate(cx, cy);
					context.rotate(shape.rotation);
					context.setLineDash([core * 0.12, core * 0.12]);
					context.beginPath();
					context.arc(0, 0, core * 1.0, 0, TAU);
					context.strokeStyle = `rgba(182, 214, 255, ${shape.glow})`;
					context.lineWidth = core * 0.03;
					context.stroke();
					context.restore();
				}
			}
			frame = window.requestAnimationFrame(draw);
		};

		let running = false;
		const start = () => {
			if (running) return;
			resize();
			if (reduce?.matches) {
				clear();
				return;
			}
			running = true;
			frame = window.requestAnimationFrame(draw);
		};
		const stop = () => {
			running = false;
			window.cancelAnimationFrame(frame);
			resize();
			clear();
		};
		const restart = () => {
			stop();
			start();
		};

		const observer =
			typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : undefined;
		observer?.observe(element);
		reduce?.addEventListener('change', restart);
		start();

		return () => {
			window.cancelAnimationFrame(frame);
			observer?.disconnect();
			reduce?.removeEventListener('change', restart);
		};
	});
</script>

<span class="orb-canvas">
	<AssistantOrb size="hero" />
	<canvas bind:this={canvas} aria-hidden="true"></canvas>
</span>

<style>
	.orb-canvas {
		position: relative;
		display: grid;
		width: 100%;
		place-items: center;
	}
	.orb-canvas :global(.assistant-orb.hero) {
		grid-area: 1 / 1;
		width: 100%;
	}
	/* Larger than the sphere so the pulse and glow are not clipped; layout stays the sphere size. */
	canvas {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 150%;
		height: 150%;
		transform: translate(-50%, -50%);
		pointer-events: none;
	}
</style>
