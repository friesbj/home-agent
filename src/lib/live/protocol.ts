import { z } from 'zod';
import { DEFAULT_BACKEND_MODEL, DEFAULT_VOICE } from '$lib/config/settings';
import { VOICE_API_NAMES } from '$lib/config/voices';

const modelId = z
	.string()
	.trim()
	.regex(/^[a-z0-9][a-z0-9._-]{0,63}$/i);
const voiceId = z.enum(VOICE_API_NAMES);
const liveContextMessage = z.object({
	role: z.enum(['user', 'assistant']),
	text: z.string().trim().min(1).max(4096)
});

export const liveSessionRequestSchema = z.object({
	// Forwarded byte for byte: SDP lines end with CRLF, so the offer must not be trimmed.
	sdp: z
		.string()
		.min(1)
		.max(64_000)
		.refine((value) => value.startsWith('v=0\r\n') && value.includes('\r\nm=')),
	backendModel: modelId.default(DEFAULT_BACKEND_MODEL),
	voice: voiceId.default(DEFAULT_VOICE),
	input: z
		.array(liveContextMessage)
		.max(128)
		.refine(
			(input) => input.reduce((total, message) => total + message.text.length, 0) <= 8192,
			'Keep session context within 8192 characters.'
		)
		.default([])
});

export type LiveSessionRequest = z.infer<typeof liveSessionRequestSchema>;

export const liveSessionResponseSchema = z.object({
	session: z.object({ id: z.string().min(1) }),
	transport: z.object({ type: z.literal('webrtc'), sdp: z.string().min(1) })
});

export type LiveSessionResponse = z.infer<typeof liveSessionResponseSchema>;

/**
 * Result of `POST /api/live/tool`. `completed` carries the text returned to the backend model for
 * the function call, whether the tool ran or not; `confirmation-required` means nothing ran yet.
 */
export const liveToolResponseSchema = z.discriminatedUnion('status', [
	z.object({
		status: z.literal('completed'),
		outcome: z.enum(['executed', 'denied', 'blocked', 'failed']),
		output: z.string()
	}),
	z.object({
		status: z.literal('confirmation-required'),
		confirmation: z.object({
			token: z.string().min(1),
			summary: z.string(),
			targets: z.array(z.string()),
			expiresAt: z.number()
		})
	})
]);

export type LiveToolResponse = z.infer<typeof liveToolResponseSchema>;
