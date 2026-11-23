<script lang="ts">
	let { compact = false }: { compact?: boolean } = $props();
</script>

<span class={['assistant-orb', { compact }]} aria-hidden="true">
	<svg viewBox="0 0 120 120" fill="none">
		<circle cx="60" cy="60" r="44" />
		<ellipse cx="60" cy="60" rx="21" ry="44" />
		<ellipse cx="60" cy="60" rx="44" ry="18" />
		<path
			d="M24 35 82 20 103 58 76 100 26 84 17 58 61 17 96 81 24 35 76 100 103 58 17 58 82 20 26 84 96 81 61 17"
		/>
		<g class="points">
			<circle cx="24" cy="35" r="2" /><circle cx="82" cy="20" r="2" />
			<circle cx="103" cy="58" r="2" /><circle cx="76" cy="100" r="2" />
			<circle cx="26" cy="84" r="2" /><circle cx="17" cy="58" r="2" />
			<circle cx="61" cy="17" r="2" /><circle cx="96" cy="81" r="2" />
		</g>
	</svg>
</span>

<style>
	.assistant-orb {
		display: grid;
		place-items: center;
		width: 128px;
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(circle at 38% 30%, #546fc8, #292a78 50%, #111a47 78%);
		box-shadow:
			0 0 35px #6977ff80,
			inset 0 0 22px #8fbfff55;
	}
	.assistant-orb.compact {
		width: 76px;
		box-shadow:
			0 0 24px #6977ff99,
			inset 0 0 15px #8fbfff55;
	}
	svg {
		width: 90%;
		stroke: #b6d6ff;
		stroke-width: 0.7;
		opacity: 0.9;
	}
	.points {
		fill: #e7f5ff;
		stroke: none;
	}
</style>
