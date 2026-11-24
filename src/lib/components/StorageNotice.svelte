<script lang="ts">
	import { KeyRound } from '@lucide/svelte';
</script>

<aside class="notice notice-warning" role="note">
	<KeyRound class="mt-0.5 shrink-0 text-warning" size={20} aria-hidden="true" />
	<p>
		<span class="font-semibold">Credentials are stored in this browser.</span>
		<span class="text-ink-muted">
			They are saved unencrypted, readable by JavaScript on this site, and sent only to this app's
			server. Use dedicated, least-privilege credentials in a restricted private deployment.
		</span>
	</p>
</aside>
