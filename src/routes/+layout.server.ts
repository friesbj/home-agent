import { getServerEnv } from '$lib/server/env';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
	const env = getServerEnv();
	return {
		mcpUrlPolicy: env.mcpUrlPolicy,
		serverHasOpenAiKey: Boolean(env.openaiApiKey)
	};
};
