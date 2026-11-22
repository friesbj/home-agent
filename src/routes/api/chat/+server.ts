import {
	streamText,
	type UIMessage,
	convertToModelMessages,
	createUIMessageStreamResponse,
	toUIMessageStream
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { getServerEnv } from '$lib/server/env';
import { OPENAI_KEY_HEADER } from '$lib/config/headers';
import type { RequestHandler } from './$types';

const chatRequestSchema = z.object({
	messages: z.array(z.looseObject({ role: z.string(), parts: z.array(z.unknown()) })).max(200),
	model: z
		.string()
		.regex(/^[a-z0-9][a-z0-9._-]{0,63}$/i)
		.optional()
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const env = getServerEnv();

	// Private-MVP: the browser may supply its own key (stored in Browser Storage); fall back to the server key.
	const apiKey = request.headers.get(OPENAI_KEY_HEADER)?.trim() || env.openaiApiKey;
	if (!apiKey) {
		error(400, 'No OpenAI API key is configured. Add one in Settings.');
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'Request body must be JSON.');
	}
	const parsed = chatRequestSchema.safeParse(body);
	if (!parsed.success) {
		error(400, 'Invalid chat request.');
	}

	const openai = createOpenAI({ apiKey });
	const result = streamText({
		model: openai(parsed.data.model ?? env.textModel),
		messages: await convertToModelMessages(parsed.data.messages as unknown as UIMessage[]),
		abortSignal: request.signal,
		timeout: { totalMs: env.requestTimeoutMs }
	});

	return createUIMessageStreamResponse({
		stream: toUIMessageStream({ stream: result.stream }),
		headers: { 'x-request-id': locals.requestId }
	});
};
