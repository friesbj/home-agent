import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Acceptance checks for the M2a design (see Design.md, "Quality and Acceptance Criteria").
// Everything runs against mocked services; no real device is ever switched.

const MCP_URL = 'http://127.0.0.1:4180/api/mcp';

const VIEWPORTS = [
	{ name: 'small phone', width: 320, height: 568 },
	{ name: 'phone', width: 390, height: 844 },
	{ name: 'large phone', width: 430, height: 932 },
	{ name: 'phone with on-screen keyboard', width: 390, height: 420 },
	{ name: 'phone in landscape', width: 844, height: 390 },
	{ name: '200% zoom of a laptop', width: 640, height: 360 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'small desktop', width: 1024, height: 768 },
	{ name: 'laptop', width: 1280, height: 720 },
	{ name: 'wide desktop', width: 1920, height: 1080 }
];

async function setup(page: Page, size = { width: 390, height: 844 }) {
	await page.setViewportSize(size);
	await page.goto('/onboarding');
	await page.getByLabel(/Server address/).fill(MCP_URL);
	await page.getByLabel('Access token', { exact: true }).fill('e2e-mcp-token');
	await page.getByLabel('OpenAI API key').fill('sk-e2e-test');
	await page.getByRole('button', { name: 'Finish setup' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('region', { name: 'Rooms' })).toBeAttached();
}

function stream(events: object[]) {
	return `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')}data: [DONE]\n\n`;
}

/** Answers chat requests with a markdown reply and a pending confirmation, without a model. */
async function mockPendingApproval(page: Page) {
	await page.route('**/api/chat', (route) =>
		route.fulfill({
			headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
			body: stream([
				{ type: 'start', messageId: 'acceptance' },
				{ type: 'text-start', id: 't' },
				{
					type: 'text-delta',
					id: 't',
					delta:
						'Sure, **Movie Night** dims the lights.\n\n| Device | State |\n| --- | --- |\n| Lamp | on |\n\n`code`'
				},
				{ type: 'text-end', id: 't' },
				{
					type: 'tool-input-available',
					toolCallId: 'call',
					toolName: 'HassTurnOn',
					input: { name: 'Movie Night', domain: ['scene'] },
					dynamic: true
				},
				{
					type: 'tool-approval-request',
					toolCallId: 'call',
					approvalId: 'approval',
					reason: 'Turn on / activate: name "Movie Night" (scene)'
				},
				{ type: 'finish' }
			])
		})
	);
}

async function openAssistant(page: Page) {
	const nav = page.getByRole('navigation', { name: 'Main navigation' });
	if (await nav.isVisible()) await nav.getByRole('button', { name: 'Open text assistant' }).click();
}

async function horizontalOverflow(page: Page) {
	return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** Visible interactive elements smaller than the design target of 44 by 44 CSS px. */
async function undersizedTargets(page: Page) {
	return page.evaluate(() => {
		const selector = [
			'a[href]',
			'button',
			'input:not([type=hidden]):not([type=checkbox]):not([type=radio])',
			'select',
			'textarea',
			'summary',
			'label:has(input[type=checkbox])',
			'label:has(input[type=radio])'
		].join(',');
		const failures: string[] = [];
		for (const element of document.querySelectorAll<HTMLElement>(selector)) {
			const style = getComputedStyle(element);
			if (style.visibility === 'hidden' || style.display === 'none') continue;
			if (element.closest('[inert], [aria-hidden=true], .sr-only')) continue;
			const rect = element.getBoundingClientRect();
			if (rect.width === 0 || rect.height === 0) continue;
			if (element.classList.contains('sr-only')) continue;
			const inline =
				element.tagName === 'A' &&
				style.display === 'inline' &&
				(element.parentElement?.textContent ?? '').trim() !== (element.textContent ?? '').trim();
			if (inline) continue;
			// The composer's Send and Stop buttons are 40 px by the user's explicit request.
			const composerButton = ['Send', 'Stop'].includes(element.getAttribute('aria-label') ?? '');
			const minimum = composerButton ? 40 : 44;
			if (rect.width < minimum - 0.5 || rect.height < minimum - 0.5) {
				const name = element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 30);
				failures.push(
					`${element.tagName.toLowerCase()} "${name}" ${Math.round(rect.width)}x${Math.round(rect.height)}`
				);
			}
		}
		return failures;
	});
}

/** Waits until nothing scrolls any more; smooth scrolling would otherwise move text under measurement. */
async function settle(page: Page) {
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				let last = '';
				let stable = 0;
				const tick = () => {
					const positions = [
						window.scrollY,
						...[...document.querySelectorAll('*')].map((element) => element.scrollTop)
					].join(',');
					stable = positions === last ? stable + 1 : 0;
					last = positions;
					if (stable >= 8) resolve();
					else requestAnimationFrame(tick);
				};
				requestAnimationFrame(tick);
			})
	);
}

/** Removes transitions so that colors are read in their final state. */
async function withoutTransitions(page: Page) {
	await page.addStyleTag({
		content: '*, *::before, *::after { transition: none !important; }'
	});
}

interface ContrastFailure {
	text: string;
	ratio: number;
	required: number;
}

/**
 * Measures text contrast on the rendered page. All text is made transparent, a screenshot
 * captures the real background under each text box (gradients, glass, blur), and the worst
 * sampled pixel is compared with the text color.
 */
async function measureContrast(page: Page) {
	await settle(page);
	const items = await page.evaluate(() => {
		const found: {
			text: string;
			x: number;
			y: number;
			w: number;
			h: number;
			color: string;
			size: number;
			weight: number;
		}[] = [];
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
		while (walker.nextNode()) {
			const node = walker.currentNode as Text;
			const text = node.textContent?.trim();
			const element = node.parentElement;
			if (!text || !element) continue;
			const style = getComputedStyle(element);
			if (style.visibility === 'hidden' || style.display === 'none') continue;
			if (element.closest(':disabled, [inert], .sr-only, script, style, title')) continue;
			const range = document.createRange();
			range.selectNodeContents(node);
			const rect = range.getBoundingClientRect();
			if (rect.width < 2 || rect.height < 2) continue;
			if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth)
				continue;
			const top = document.elementFromPoint(
				Math.min(Math.max(rect.x + rect.width / 2, 0), innerWidth - 1),
				Math.min(Math.max(rect.y + rect.height / 2, 0), innerHeight - 1)
			);
			if (!top || !(top === element || element.contains(top) || top.contains(element))) continue;
			found.push({
				text: text.slice(0, 40),
				x: rect.x,
				y: rect.y,
				w: rect.width,
				h: rect.height,
				color: style.color,
				size: parseFloat(style.fontSize),
				weight: parseInt(style.fontWeight, 10)
			});
		}
		return found;
	});

	const hide = await page.addStyleTag({
		content:
			'*{color:transparent !important;-webkit-text-fill-color:transparent !important;text-shadow:none !important;caret-color:transparent !important}'
	});
	await page.waitForTimeout(350);
	const png = await page.screenshot({ animations: 'disabled', scale: 'css' });
	await hide.evaluate((node) => node.remove());

	return page.evaluate(
		async ({ items, png }) => {
			const toRgba = (css: string) => {
				const canvas = document.createElement('canvas');
				canvas.width = canvas.height = 1;
				const context = canvas.getContext('2d', { willReadFrequently: true })!;
				context.fillStyle = css;
				context.fillRect(0, 0, 1, 1);
				const data = context.getImageData(0, 0, 1, 1).data;
				return [data[0], data[1], data[2], data[3] / 255];
			};
			const luminance = (r: number, g: number, b: number) => {
				const channel = (value: number) => {
					const v = value / 255;
					return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
				};
				return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
			};
			const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

			const blob = await (await fetch(`data:image/png;base64,${png}`)).blob();
			const bitmap = await createImageBitmap(blob);
			const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
			const context = canvas.getContext('2d', { willReadFrequently: true })!;
			context.drawImage(bitmap, 0, 0);

			const failures: { text: string; ratio: number; required: number }[] = [];
			let measured = 0;
			let lowest = Infinity;
			for (const item of items) {
				const [r, g, b, a] = toRgba(item.color);
				if (a === 0) continue;
				const x0 = Math.max(0, Math.floor(item.x));
				const y0 = Math.max(0, Math.floor(item.y));
				const x1 = Math.min(bitmap.width, Math.ceil(item.x + item.w));
				const y1 = Math.min(bitmap.height, Math.ceil(item.y + item.h));
				if (x1 <= x0 || y1 <= y0) continue;
				const data = context.getImageData(x0, y0, x1 - x0, y1 - y0).data;
				const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 400)));
				let worst = Infinity;
				for (let y = 0; y < y1 - y0; y += step) {
					for (let x = 0; x < x1 - x0; x += step) {
						const index = (y * (x1 - x0) + x) * 4;
						const [br, bg, bb] = [data[index], data[index + 1], data[index + 2]];
						const text = luminance(
							r * a + br * (1 - a),
							g * a + bg * (1 - a),
							b * a + bb * (1 - a)
						);
						worst = Math.min(worst, ratio(text, luminance(br, bg, bb)));
					}
				}
				const large = item.size >= 24 || (item.size >= 18.66 && item.weight >= 700);
				const required = large ? 3 : 4.5;
				measured++;
				lowest = Math.min(lowest, worst);
				if (worst < required) {
					failures.push({ text: item.text, ratio: Math.round(worst * 100) / 100, required });
				}
			}
			return { failures: failures as ContrastFailure[], measured, lowest };
		},
		{ items, png: png.toString('base64') }
	);
}

test.describe('layout across screen sizes', () => {
	for (const viewport of VIEWPORTS) {
		test(`${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
			await mockPendingApproval(page);
			await setup(page, viewport);

			expect(await horizontalOverflow(page), 'Home overflows horizontally').toBeLessThanOrEqual(0);
			expect(await undersizedTargets(page), 'Home touch targets').toEqual([]);

			await openAssistant(page);
			await page.getByLabel('Message').fill('Activate the scene "Movie Night".');
			await page.getByRole('button', { name: 'Send' }).click();
			await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
			await expect(page.getByLabel('Message')).toBeInViewport();
			await expect(page.getByRole('button', { name: 'Send' })).toBeInViewport();
			expect(
				await horizontalOverflow(page),
				'Assistant overflows horizontally'
			).toBeLessThanOrEqual(0);
			expect(await undersizedTargets(page), 'Assistant touch targets').toEqual([]);
			const nav = page.getByRole('navigation', { name: 'Main navigation' });
			if (await nav.isVisible()) {
				const bar = await nav.boundingBox();
				const composer = await page.getByLabel('Message').boundingBox();
				expect(bar && composer && composer.y + composer.height <= bar.y + 1).toBe(true);
			}

			await page.goto('/settings');
			await page.getByText('Advanced settings', { exact: true }).click();
			await expect(page.getByLabel('Your name (optional)')).toBeVisible();
			expect(await horizontalOverflow(page), 'Settings overflows horizontally').toBeLessThanOrEqual(
				0
			);
			expect(await undersizedTargets(page), 'Settings touch targets').toEqual([]);
		});
	}

	test('onboarding stays usable at 320 px and with text enlarged to 200%', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 568 });
		await page.goto('/onboarding');
		expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
		expect(await undersizedTargets(page)).toEqual([]);
		await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
		expect(await horizontalOverflow(page), 'overflow with 200% text').toBeLessThanOrEqual(0);
		await expect(page.getByRole('button', { name: 'Finish setup' })).toBeAttached();
	});

	test('Home and Assistant stay usable with text enlarged to 200% on a phone', async ({ page }) => {
		await mockPendingApproval(page);
		await setup(page);
		await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
		expect(await horizontalOverflow(page), 'Home overflows').toBeLessThanOrEqual(0);
		await openAssistant(page);
		await expect(page.getByLabel('Message')).toBeInViewport();
		await expect(page.getByRole('button', { name: 'Send' })).toBeInViewport();
		expect(await horizontalOverflow(page), 'Assistant overflows').toBeLessThanOrEqual(0);
	});
});

test.describe('automated accessibility audit', () => {
	const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

	async function audit(page: Page) {
		const results = await new AxeBuilder({ page }).withTags(tags).analyze();
		return results.violations.map(
			(violation) =>
				`${violation.id}: ${violation.help} (${violation.nodes
					.slice(0, 3)
					.map((node) => node.target.join(' '))
					.join('; ')})`
		);
	}

	for (const size of [
		{ width: 390, height: 844 },
		{ width: 1280, height: 720 }
	]) {
		test(`Home, Assistant, Settings, and onboarding at ${size.width}px`, async ({ page }) => {
			await mockPendingApproval(page);
			await page.setViewportSize(size);
			await page.goto('/onboarding');
			await page.getByRole('button', { name: 'Finish setup' }).click();
			await expect(page.getByText(/Enter the access token/)).toBeVisible();
			expect(await audit(page), 'onboarding with errors').toEqual([]);

			await setup(page, size);
			expect(await audit(page), 'Home').toEqual([]);

			await openAssistant(page);
			expect(await audit(page), 'empty Assistant').toEqual([]);
			await page.getByLabel('Message').fill('Activate the scene "Movie Night".');
			await page.getByRole('button', { name: 'Send' }).click();
			await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
			expect(await audit(page), 'Assistant with a pending confirmation').toEqual([]);

			await page.goto('/settings');
			await page.getByText('Advanced settings', { exact: true }).click();
			await page.getByText('Data and privacy', { exact: true }).click();
			await page.getByRole('button', { name: 'Reset all data' }).click();
			expect(await audit(page), 'Settings with every section open').toEqual([]);
		});
	}
});

test.describe('contrast measured on the rendered pages', () => {
	for (const size of [
		{ width: 390, height: 844 },
		{ width: 1280, height: 720 }
	]) {
		test(`text meets WCAG AA at ${size.width}px`, async ({ page }) => {
			await mockPendingApproval(page);
			await setup(page, size);
			await withoutTransitions(page);
			const reports: Record<string, { failures: ContrastFailure[]; measured: number }> = {};
			const mobile = size.width < 1024;

			reports['Home'] = await measureContrast(page);
			await page
				.getByRole('region', { name: 'Rooms' })
				.getByText('Room 3')
				.scrollIntoViewIfNeeded();
			await page.getByRole('button', { name: 'Expand all' }).click();
			reports['Home with rooms expanded'] = await measureContrast(page);
			await page.getByRole('button', { name: /^Lights:/ }).click();
			reports['Home filtered by lights'] = await measureContrast(page);

			await openAssistant(page);
			if (!mobile) await page.getByRole('button', { name: 'New chat' }).click();
			reports['Empty Assistant'] = await measureContrast(page);
			await page.getByLabel('Message').fill('Activate the scene "Movie Night".');
			await page.getByRole('button', { name: 'Send' }).click();
			await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
			reports['Assistant with confirmation'] = await measureContrast(page);

			await page.goto('/settings');
			reports['Settings'] = await measureContrast(page);
			await page.getByText('Advanced settings', { exact: true }).click();
			reports['Settings, advanced'] = await measureContrast(page);
			await page.getByText('Advanced settings', { exact: true }).click();
			await page.getByText('Data and privacy', { exact: true }).click();
			await page.getByRole('button', { name: 'Reset all data' }).click();
			reports['Settings, danger zone'] = await measureContrast(page);

			await page.evaluate(() => localStorage.clear());
			await page.goto('/onboarding');
			await page.getByRole('button', { name: 'Finish setup' }).click();
			reports['Onboarding with errors'] = await measureContrast(page);

			const problems: string[] = [];
			for (const [name, report] of Object.entries(reports)) {
				if (report.measured <= 5) problems.push(`${name}: only ${report.measured} texts measured`);
				for (const failure of report.failures) {
					problems.push(
						`${name}: "${failure.text}" ${failure.ratio}:1, needs ${failure.required}:1`
					);
				}
			}
			expect(problems).toEqual([]);
		});
	}
});

test.describe('keyboard and focus', () => {
	test('every tab stop shows a visible, high-contrast focus indicator', async ({ page }) => {
		await mockPendingApproval(page);
		await setup(page, { width: 1280, height: 720 });
		await withoutTransitions(page);
		const stops: { name: string; style: string; width: number; color: string; visible: boolean }[] =
			[];
		for (let index = 0; index < 90; index++) {
			await page.keyboard.press('Tab');
			const stop = await page.evaluate(() => {
				const element = document.activeElement as HTMLElement | null;
				if (!element || element === document.body) return null;
				// A field may show its focus ring on the wrapper that visually is the field.
				const indicator =
					[element, element.parentElement, element.parentElement?.parentElement].find(
						(candidate) => candidate && getComputedStyle(candidate).outlineStyle !== 'none'
					) ?? element;
				const style = getComputedStyle(indicator);
				const rect = element.getBoundingClientRect();
				return {
					name: (element.getAttribute('aria-label') || element.textContent || element.id)
						.trim()
						.slice(0, 30),
					style: style.outlineStyle,
					width: parseFloat(style.outlineWidth),
					color: style.outlineColor,
					visible: rect.width > 0 && rect.bottom > 0 && rect.top < innerHeight
				};
			});
			if (!stop) break;
			stops.push(stop);
		}
		expect(stops.length).toBeGreaterThan(8);
		for (const stop of stops) {
			expect(stop.style, `${stop.name}: outline style`).not.toBe('none');
			expect(stop.width, `${stop.name}: outline width`).toBeGreaterThanOrEqual(2);
			expect(stop.visible, `${stop.name}: in viewport`).toBe(true);
			expect(stop.color, `${stop.name}: outline color`).toBe('rgb(179, 166, 255)');
		}
		const names = stops.map((stop) => stop.name).join('|');
		for (const expected of ['Refresh', 'Settings', 'Movie Night']) {
			expect(names, `${expected} is reachable`).toContain(expected);
		}

		// The outline color against the brightest background light field (#35346d).
		const channel = (value: number) => {
			const v = value / 255;
			return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
		};
		const luminance = (r: number, g: number, b: number) =>
			0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
		const lighter = luminance(179, 166, 255);
		const darker = luminance(0x35, 0x34, 0x6d);
		expect((lighter + 0.05) / (darker + 0.05)).toBeGreaterThanOrEqual(3);
	});

	test('disclosures open with the keyboard and expose their fields', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/onboarding');
		await page.locator('summary', { hasText: 'Advanced settings' }).focus();
		await page.keyboard.press('Enter');
		await expect(page.locator('details[open]')).toHaveCount(1);
		await page.keyboard.press('Tab');
		await expect(page.getByLabel('Your name (optional)')).toBeFocused();
		await page.locator('summary', { hasText: 'Advanced settings' }).focus();
		await page.keyboard.press('Space');
		await expect(page.locator('details[open]')).toHaveCount(0);
	});

	test('focus is not lost when a button hides its own view', async ({ page }) => {
		await mockPendingApproval(page);
		await setup(page);
		await page.getByRole('button', { name: 'Ask your home' }).click();
		await expect(page.getByLabel('Message')).toBeFocused();

		await page.getByRole('button', { name: 'Home', exact: true }).click();
		await page.getByRole('button', { name: 'Movie Night' }).click();
		await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
		const insideAssistant = await page.evaluate(
			() => !!document.activeElement?.closest('[aria-label="Assistant"]')
		);
		expect(insideAssistant, 'focus moved into the Assistant view').toBe(true);
	});
});

/** Names of running CSS animations; transitions are not animations the user asked to reduce. */
const runningAnimations = (page: Page) =>
	page.evaluate(() =>
		document
			.getAnimations()
			.filter((animation) => animation instanceof CSSAnimation && animation.playState === 'running')
			.map((animation) => (animation as CSSAnimation).animationName)
	);

test.describe('motion', () => {
	test('the orb animates at normal settings', async ({ page }) => {
		await setup(page);
		await page.waitForTimeout(300);
		expect((await runningAnimations(page)).length).toBeGreaterThan(0);
	});

	test.describe('with reduced motion requested', () => {
		test.use({ reducedMotion: 'reduce' });

		test('no animation runs on Home or in the Assistant', async ({ page }) => {
			await setup(page);
			await page.waitForTimeout(300);
			expect(await runningAnimations(page), 'Home').toEqual([]);
			await openAssistant(page);
			expect(await runningAnimations(page), 'Assistant').toEqual([]);
		});
	});
});
