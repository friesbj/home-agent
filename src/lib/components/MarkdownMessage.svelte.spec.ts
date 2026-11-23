import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MarkdownMessage from './MarkdownMessage.svelte';

describe('MarkdownMessage', () => {
	it('renders emphasis, tables, fenced code, and safe links', async () => {
		const { container } = await render(MarkdownMessage, {
			text: `Status **Office**:

| Device | State |
| --- | --- |
| Light | On |

\`\`\`ts
const value = "<light>";
\`\`\`

[Documentation](https://example.com)`
		});

		expect(container.querySelector('strong')?.textContent).toBe('Office');
		expect([...container.querySelectorAll('table th')].map((cell) => cell.textContent)).toEqual([
			'Device',
			'State'
		]);
		expect([...container.querySelectorAll('table td')].map((cell) => cell.textContent)).toEqual([
			'Light',
			'On'
		]);
		expect(container.querySelector('pre code')?.textContent).toBe('const value = "<light>";\n');
		expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
	});

	it('does not execute raw HTML or allow unsafe links or remote images', async () => {
		const { container } = await render(MarkdownMessage, {
			text: '<img src=x onerror=alert(1)> <script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n![remote](https://example.com/image.png)'
		});
		expect(container.querySelector('img')).toBeNull();
		expect(container.querySelector('script')).toBeNull();
		expect(container.querySelector('a')?.hasAttribute('href')).toBe(false);
		expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
		expect(container.textContent).toContain('remote');
	});

	it('updates formatting when streamed text changes', async () => {
		const { container, rerender } = await render(MarkdownMessage, { text: 'Status **On' });
		await rerender({ text: 'Status **On**' });
		expect(container.querySelector('strong')?.textContent).toBe('On');
	});
});
