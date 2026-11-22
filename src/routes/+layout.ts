import { redirect } from '@sveltejs/kit';
import { loadSettings } from '$lib/config/settings';
import type { LayoutLoad } from './$types';

// Configuration lives in Browser Storage, so the app renders client-side only.
export const ssr = false;

export const load: LayoutLoad = ({ data, url }) => {
	const onboarded = loadSettings(localStorage).onboardingCompleted;
	if (!onboarded && url.pathname !== '/onboarding') redirect(307, '/onboarding');
	return data;
};
