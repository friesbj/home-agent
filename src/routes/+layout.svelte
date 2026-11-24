<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<div class="ambient-shell min-h-dvh font-ambient">
	{@render children()}
</div>
