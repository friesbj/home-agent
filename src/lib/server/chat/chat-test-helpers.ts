// Test helpers for driving `streamChat` with a mock language model.
import { readUIMessageStream, type ToolSet, type UIMessage, type UIMessageChunk } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { defaultConfirmationPolicy, type ConfirmationPolicy } from '$lib/config/settings';
import { streamChat } from './chat-service';

const usage = {
	inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
	outputTokens: { total: 1, text: 1, reasoning: 0 }
};

type StreamPart = Record<string, unknown>;
type ModelStep = { stream: ReadableStream<StreamPart> };
export type DynamicToolPart = Extract<UIMessage['parts'][number], { type: 'dynamic-tool' }>;

function streamOf(parts: StreamPart[]): ModelStep {
	return {
		stream: new ReadableStream({
			start(controller) {
				for (const part of [{ type: 'stream-start', warnings: [] }, ...parts]) {
					controller.enqueue(part);
				}
				controller.close();
			}
		})
	};
}

export const toolCallStep = (toolName: string, input: unknown) =>
	streamOf([
		{ type: 'tool-call', toolCallId: 'call-1', toolName, input: JSON.stringify(input) },
		{ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage }
	]);

export const textStep = (text: string) =>
	streamOf([
		{ type: 'text-start', id: 't1' },
		{ type: 'text-delta', id: 't1', delta: text },
		{ type: 'text-end', id: 't1' },
		{ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage }
	]);

/** Mock model that returns the given steps in order (repeating the last one). */
export function mockModel(...steps: ModelStep[]) {
	let call = 0;
	return new MockLanguageModelV4({
		doStream: async () => steps[Math.min(call++, steps.length - 1)] as never
	});
}

export const userMessage: UIMessage = {
	id: 'u1',
	role: 'user',
	parts: [{ type: 'text', text: 'Turn on the kitchen light' }]
};

export async function runChat(options: {
	model: MockLanguageModelV4;
	tools: ToolSet;
	messages?: UIMessage[];
	confirmation?: ConfirmationPolicy;
	onEnd?: () => void | Promise<void>;
}): Promise<UIMessageChunk[]> {
	const response = await streamChat({
		model: options.model,
		messages: options.messages ?? [userMessage],
		tools: options.tools,
		confirmation: options.confirmation ?? defaultConfirmationPolicy(),
		approvalSecret: 'test-secret-test-secret-test-secret',
		timeoutMs: 5000,
		requestId: 'req-1',
		onEnd: options.onEnd
	});
	return (await response.text())
		.split('\n')
		.filter((line) => line.startsWith('data: ') && !line.includes('[DONE]'))
		.map((line) => JSON.parse(line.slice(6)) as UIMessageChunk);
}

/** Whether the stream asks the user to confirm (automatic approvals/denials don't count). */
export function asksUser(chunks: UIMessageChunk[]) {
	return chunks.some(
		(chunk) =>
			chunk.type === 'tool-approval-request' && !('isAutomatic' in chunk && chunk.isAutomatic)
	);
}

export async function assistantMessage(chunks: UIMessageChunk[]): Promise<UIMessage> {
	let message: UIMessage | undefined;
	const stream = new ReadableStream<UIMessageChunk>({
		start(controller) {
			chunks.forEach((chunk) => controller.enqueue(chunk));
			controller.close();
		}
	});
	for await (const next of readUIMessageStream({ stream })) message = next;
	return message!;
}

/** Answers every pending approval in the assistant message, optionally tampering with the input. */
export function respondToApprovals(
	message: UIMessage,
	approved: boolean,
	changeInput?: (input: unknown) => unknown
): UIMessage {
	return {
		...message,
		parts: message.parts.map((part) => {
			if (part.type !== 'dynamic-tool' || part.state !== 'approval-requested') return part;
			return {
				...part,
				input: changeInput ? changeInput(part.input) : part.input,
				state: 'approval-responded',
				approval: { ...part.approval, approved }
			};
		})
	} as UIMessage;
}
