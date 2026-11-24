import { z } from 'zod';
import { DEFAULT_BACKEND_MODEL, DEFAULT_VOICE } from '$lib/config/settings';

const modelId = z
	.string()
	.trim()
	.regex(/^[a-z0-9][a-z0-9._-]{0,63}$/i);
const voiceId = z
	.string()
	.trim()
	.regex(/^[a-z0-9_-]{1,32}$/i);

export const liveSessionRequestSchema = z.object({
	// Forwarded byte for byte: SDP lines end with CRLF, so the offer must not be trimmed.
	sdp: z
		.string()
		.min(1)
		.max(64_000)
		.refine((value) => value.startsWith('v=0\r\n') && value.includes('\r\nm=')),
	backendModel: modelId.default(DEFAULT_BACKEND_MODEL),
	voice: voiceId.default(DEFAULT_VOICE)
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
