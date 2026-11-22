import {
  streamText,
  type UIMessage,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { OPENAI_API_KEY } from '$env/static/private';
import { error } from '@sveltejs/kit';

export async function POST({ request }) {
  if (!OPENAI_API_KEY) {
    throw error(500, 'OPENAI_API_KEY is not configured');
  }

  const { messages }: { messages: UIMessage[] } = await request.json();
  const openai = createOpenAI({ apiKey: OPENAI_API_KEY });

  const result = streamText({
    model: openai('gpt-6-astra'),
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}