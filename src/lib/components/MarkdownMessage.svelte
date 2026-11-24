<script lang="ts">
	import DOMPurify from 'dompurify';
	import { Marked } from 'marked';

	let { text }: { text: string } = $props();

	function escapeHtml(value: string) {
		return value.replace(
			/[&<>"']/g,
			(character) =>
				({
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#39;'
				})[character] ?? character
		);
	}

	const markdown = new Marked({
		gfm: true,
		breaks: true,
		renderer: {
			html: ({ text }) => escapeHtml(text),
			image: ({ text }) => escapeHtml(text)
		}
	});

	const html = $derived(
		DOMPurify.sanitize(markdown.parse(text, { async: false }), {
			ALLOWED_TAGS: [
				'p',
				'strong',
				'em',
				'del',
				'a',
				'code',
				'pre',
				'blockquote',
				'ul',
				'ol',
				'li',
				'h1',
				'h2',
				'h3',
				'h4',
				'h5',
				'h6',
				'table',
				'thead',
				'tbody',
				'tr',
				'th',
				'td',
				'br',
				'hr'
			],
			ALLOWED_ATTR: ['href', 'title', 'class', 'start', 'align']
		})
	);
</script>

<div
	class="prose prose-sm max-w-none overflow-x-auto rounded-2xl rounded-bl-md border border-white/10 bg-white/5 px-4 py-3 [overflow-wrap:anywhere] prose-invert prose-a:text-accent-ink prose-pre:overflow-x-auto prose-pre:border prose-pre:border-line-strong/40 prose-pre:bg-[#0f1733]"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- The Markdown output is sanitized above. -->
	{@html html}
</div>
