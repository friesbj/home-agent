import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AssistantOrbCanvas from './AssistantOrbCanvas.svelte';

describe('AssistantOrbCanvas', () => {
	it('draws the moving orb on a canvas over the static sphere', async () => {
		const { container } = render(AssistantOrbCanvas, {
			orb: 'listening',
			getLevel: () => 0.6
		});

		// The static SVG sphere is always present as the reduced-motion fallback.
		expect(container.querySelector('svg')).not.toBeNull();
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('renders without a level getter for still states', async () => {
		const { container } = render(AssistantOrbCanvas, { orb: 'idle' });
		expect(container.querySelector('canvas')).not.toBeNull();
	});
});
