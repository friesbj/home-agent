/**
 * Renders a tool result as readable text for the action card. Text-mode results arrive as an AI SDK
 * content array; voice results arrive as the raw string returned to the backend. JSON strings are
 * pretty-printed so both surfaces show the same shape instead of a single raw line.
 */
export function formatToolOutput(output: unknown): string {
	let text: string;
	if (typeof output === 'string') {
		text = prettyJson(output);
	} else {
		const content = (output as { content?: { type: string; text?: string }[] } | undefined)
			?.content;
		text = Array.isArray(content)
			? content
					.filter((item) => item.type === 'text')
					.map((item) => item.text ?? '')
					.join('\n')
			: JSON.stringify(output, null, 2);
		text = prettyJson(text);
	}
	return text.length > 4000 ? `${text.slice(0, 4000)}\n…` : text;
}

function prettyJson(value: string): string {
	const trimmed = value.trim();
	if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
	try {
		return JSON.stringify(JSON.parse(trimmed), null, 2);
	} catch {
		return value;
	}
}
