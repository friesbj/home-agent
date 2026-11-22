import {
	convertToModelMessages,
	createUIMessageStreamResponse,
	isStepCount,
	streamText,
	toUIMessageStream,
	type LanguageModel,
	type ToolSet,
	type UIMessage
} from 'ai';
import { requiresConfirmation, type ConfirmationPolicy } from '$lib/config/settings';
import { ALLOWED_MUTATION_DOMAINS, evaluateToolCall } from '$lib/home/ha-policy';
import { errorName, logEvent } from '$lib/server/log';
import { McpGatewayError } from '$lib/server/mcp/url-guard';

export const SYSTEM_PROMPT = `You are Home Agent, a calm and concise assistant for a Home Assistant smart home.
- Answer in the user's language.
- Use the GetLiveContext tool to look up current device states before answering questions about the home.
- You may only change ${ALLOWED_MUTATION_DOMAINS.join(', ')} devices. Always pass the "domain" argument to HassTurnOn and HassTurnOff.
- Some changes require the user's confirmation; if a change is denied, acknowledge it and do not retry it.
- Never reveal credentials, tokens, or internal configuration.`;

export interface ChatServiceOptions {
	model: LanguageModel;
	messages: UIMessage[];
	tools: ToolSet;
	confirmation: ConfirmationPolicy;
	approvalSecret: string;
	timeoutMs: number;
	requestId: string;
	signal?: AbortSignal;
	/** Extra system context, e.g. that Home Assistant is currently unreachable. */
	notice?: string;
	onEnd?: () => void | Promise<void>;
	headers?: HeadersInit;
}

export function safeErrorMessage(error: unknown, requestId: string): string {
	if (error instanceof McpGatewayError) return error.message;
	return `The assistant could not complete the request (request ${requestId}).`;
}

export async function streamChat(options: ChatServiceOptions): Promise<Response> {
	let ended = false;
	const end = async () => {
		if (ended) return;
		ended = true;
		await options.onEnd?.();
	};

	const result = streamText({
		model: options.model,
		system: options.notice ? `${SYSTEM_PROMPT}\n\n${options.notice}` : SYSTEM_PROMPT,
		messages: await convertToModelMessages(options.messages, { tools: options.tools }),
		tools: options.tools,
		stopWhen: isStepCount(6),
		abortSignal: options.signal,
		timeout: { totalMs: options.timeoutMs },
		experimental_toolApprovalSecret: options.approvalSecret,
		toolApproval: ({ toolCall }) => {
			const evaluation = evaluateToolCall(toolCall.toolName, toolCall.input);
			logEvent('info', 'tool.call', {
				requestId: options.requestId,
				tool: toolCall.toolName,
				kind: evaluation.kind
			});
			if (evaluation.kind === 'blocked') return { type: 'denied', reason: evaluation.reason };
			if (evaluation.kind === 'read') return 'not-applicable';
			return evaluation.domains.some((domain) => requiresConfirmation(options.confirmation, domain))
				? { type: 'user-approval', reason: evaluation.summary }
				: { type: 'approved', reason: 'Allowed without confirmation by your settings.' };
		},
		onEnd: end,
		onAbort: end,
		onError: async ({ error }) => {
			logEvent('error', 'chat.error', { requestId: options.requestId, error: errorName(error) });
			await end();
		}
	});

	return createUIMessageStreamResponse({
		stream: toUIMessageStream({
			stream: result.stream,
			tools: options.tools,
			originalMessages: options.messages,
			onError: (error) => safeErrorMessage(error, options.requestId)
		}),
		headers: options.headers
	});
}
