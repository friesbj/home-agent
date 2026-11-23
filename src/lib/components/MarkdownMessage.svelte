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
	class="prose prose-sm max-w-none overflow-x-auto rounded-lg bg-stone-100 px-3 py-2 [overflow-wrap:anywhere] text-stone-900 prose-pre:overflow-x-auto"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- The Markdown output is sanitized above. -->
	{@html html}
</div>
