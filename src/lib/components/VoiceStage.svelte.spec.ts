import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import VoiceStage, { type VoiceStageState } from './VoiceStage.svelte';

const states: { name: string; state: VoiceStageState; status: string }[] = [
	{ name: 'ready', state: { kind: 'ready' }, status: 'Ready' },
	{
		name: 'microphone permission',
		state: { kind: 'needs-microphone' },
		status: 'Microphone access needed'
	},
	{
		name: 'blocked microphone',
		state: { kind: 'needs-microphone', blocked: true },
		status: 'Microphone blocked'
	},
	{
		name: 'failed start',
		state: { kind: 'error', title: 'Could not connect', message: 'No microphone was found.' },
		status: 'Could not connect'
	},
	{
		name: 'connecting',
		state: { kind: 'connecting', microphoneOn: true },
		status: 'Connecting…'
	},
	{
		name: 'listening',
		state: {
			kind: 'connected',
			microphoneOn: true,
			listening: true,
			speaking: false,
			thinking: false
		},
		status: 'Listening'
	},
	{
		name: 'speaking',
		state: {
			kind: 'connected',
			microphoneOn: true,
			listening: true,
			speaking: true,
			thinking: false
		},
		status: 'Speaking'
	},
	{
		name: 'thinking while speaking',
		state: {
			kind: 'connected',
			microphoneOn: true,
			listening: true,
			speaking: true,
			thinking: true
		},
		status: 'Speaking'
	},
	{
		name: 'tool use',
		state: {
			kind: 'connected',
			microphoneOn: true,
			listening: false,
			speaking: false,
			thinking: true,
			activity: { kind: 'read', target: 'Home status', progress: 'Reading current status…' }
		},
		status: 'Working on it…'
	},
	{
		name: 'confirmation',
		state: {
			kind: 'connected',
			microphoneOn: true,
			listening: false,
			speaking: false,
			thinking: true,
			confirmation: {
				summary: 'Turn on the kitchen lights?',
				targets: ['Kitchen'],
				affectedCount: 2
			}
		},
		status: 'Waiting for your confirmation'
	},
	{
		name: 'muted while speaking',
		state: {
			kind: 'connected',
			microphoneOn: false,
			listening: false,
			speaking: true,
			thinking: false
		},
		status: 'Speaking'
	},
	{
		name: 'error',
		state: { kind: 'error', message: 'The connection ended.' },
		status: 'Connection lost'
	}
];

describe('VoiceStage', () => {
	for (const { name, state, status } of states) {
		it(`renders the ${name} state`, async () => {
			render(VoiceStage, { state });
			await expect.element(page.getByRole('status')).toHaveTextContent(status);
			if (name === 'thinking while speaking') {
				await expect.element(page.getByText('Working on it', { exact: true })).toBeVisible();
			}
		});
	}

	it('shows tool activity and keeps approval on the screen', async () => {
		const state: VoiceStageState = {
			kind: 'connected',
			microphoneOn: true,
			listening: false,
			speaking: false,
			thinking: true,
			activity: {
				kind: 'change',
				target: 'Kitchen lights',
				progress: 'Waiting for your decision.'
			},
			confirmation: {
				summary: 'Turn on the kitchen lights?',
				targets: ['Kitchen'],
				affectedCount: 2
			}
		};

		render(VoiceStage, { state });

		await expect.element(page.getByText('Change', { exact: true })).toBeVisible();
		await expect.element(page.getByText('Turn on the kitchen lights?')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Approve' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Deny' })).toBeDisabled();
	});

	it('explains voice on first use and offers a retry when the microphone is blocked', async () => {
		const screen = render(VoiceStage, {
			state: { kind: 'needs-microphone' },
			voiceName: 'marin',
			onpermission: () => {}
		});

		await expect.element(page.getByText(/sent through this application's server/)).toBeVisible();
		await expect.element(page.getByText('Voice: marin')).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Change in Settings' }))
			.toHaveAttribute('href', '/settings');
		await expect.element(page.getByRole('button', { name: 'Allow microphone' })).toBeEnabled();
		// Captions belong to a conversation, not to the setup.
		await expect
			.element(page.getByRole('button', { name: 'Show captions' }))
			.not.toBeInTheDocument();

		await screen.rerender({ state: { kind: 'needs-microphone', blocked: true } });
		await expect.element(page.getByText(/Allow the microphone for this site/)).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Try again' })).toBeEnabled();
		await expect.element(page.getByText('Voice: marin')).not.toBeInTheDocument();
	});

	it('moves focus to the confirmation card and reports the decision', async () => {
		let decision = '';
		render(VoiceStage, {
			state: {
				kind: 'connected',
				microphoneOn: true,
				listening: true,
				speaking: false,
				thinking: true,
				confirmation: {
					summary: 'Turn on / activate: name "Kitchen Light" (light)',
					targets: ['Kitchen Light']
				}
			},
			onapprove: () => (decision = 'approved'),
			ondeny: () => (decision = 'denied')
		});

		// The card, not a button, is focused, so a stray Enter or Space cannot approve.
		await expect
			.element(page.getByRole('region', { name: 'Waiting for your confirmation' }))
			.toHaveFocus();
		await expect.element(page.getByText('Change · Kitchen Light', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Deny' }).click();
		expect(decision).toBe('denied');
	});

	it('shows a closing session with disabled controls and a non-fatal notice', async () => {
		render(VoiceStage, {
			state: {
				kind: 'connected',
				microphoneOn: false,
				listening: false,
				speaking: false,
				thinking: false,
				closing: true,
				notice: 'The assistant reported a problem.'
			},
			ontogglemicrophone: () => {},
			onend: () => {}
		});

		await expect.element(page.getByRole('status')).toHaveTextContent('Ending…');
		await expect.element(page.getByText('The assistant reported a problem.')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Turn microphone on' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'End', exact: true })).toBeDisabled();
	});

	it('keeps captions out of the way until they are asked for, without announcing their text', async () => {
		const state: VoiceStageState = {
			kind: 'connected',
			microphoneOn: true,
			listening: true,
			speaking: false,
			thinking: false,
			heardText: 'What is the temperature?',
			spokenText: 'It is twenty-one degrees.'
		};
		render(VoiceStage, { state });

		const caption = page.getByText('What is the temperature?');
		await expect.element(caption).not.toBeInTheDocument();
		await expect.element(page.getByRole('heading', { name: 'Captions' })).not.toBeInTheDocument();

		await page.getByRole('button', { name: 'Show captions' }).click();
		await expect.element(caption).toBeVisible();
		await expect
			.element(page.getByRole('group', { name: 'Captions' }))
			.toHaveAttribute('aria-live', 'off');
		await page.getByRole('button', { name: 'Hide captions' }).click();
		await expect.element(caption).not.toBeInTheDocument();
	});

	it('keeps the microphone state distinct from speaking', async () => {
		const state = states.find((candidate) => candidate.name === 'muted while speaking')?.state;
		if (!state) throw new Error('Muted speaking fixture is missing.');

		render(VoiceStage, { state });

		await expect.element(page.getByRole('status')).toHaveTextContent('Speaking');
		await expect.element(page.getByText('Microphone off')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Turn microphone on' })).toBeDisabled();
	});
});
