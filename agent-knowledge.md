# Agent Knowledge

This file is the persistent project knowledge base. Entries are append-only and ordered newest first. It complements `AGENTS.md` with decisions, discoveries, constraints, and context learned during implementation sessions.

## 2026-11-26

### 2026-11-26T21:41:00+01:00

- **M3a card ordering decision:** the user chose to keep voice action cards at their event-arrival position instead of estimating their position from the delegation timestamp. Late transcript fragments can therefore appear after an action that they preceded in speech.
- **M3a cross-tab recovery:** the user chose to defer the case where a second tab opens a conversation that still has an active voice call in the first tab. The second tab can incorrectly mark a pending card interrupted and subsequent concurrent writes can conflict; do not assume this case is safe or resolved.
- **M3a crash persistence:** the user accepted best-effort saving as transcript fragments arrive; an immediate tab or browser crash can lose the latest fragment.
- **M3a local speech activity:** the user chose local VAD for the idle timer. The Silero v5 model and ONNX WebAssembly runtime are bundled as same-origin assets and process the existing microphone stream without collecting utterances or sending audio to another service. Loading, initialization failure, and stalled processing disable the idle timeout visibly rather than risk ending while the user is speaking. Detection is probabilistic. On 2026-11-26 the user reported successful real-service tests of speech lasting over 60 seconds, the 60-second idle end, and a spoken follow-up referring to an earlier typed message.

### 2026-11-26T21:21:06+01:00

- **M3a delegation activity:** the Live transcript state tracks active backend delegations by provider delegation ID. Completing one no longer clears the thinking state or resumes the idle timer while another is still running. The user reports that the earlier history-load problem appears resolved in their browser; the particular stored record responsible was not inspected.

### 2026-11-26T21:16:49+01:00

- **M3a legacy action cards:** early saved voice cards lacked the later-added `label` field although the history version stayed the same. Loading those records now supplies a generic label in memory; listing does not rewrite storage, and malformed records still report an error. This is a reproduced possible cause of the user's history-load error, not confirmation of their browser's stored data.

### 2026-11-26T20:46:16+01:00

- **Idle activity:** GPT-Live's documentation says transcript delivery can be uneven and gaps do not establish silence. The idle timer now also tracks measured assistant output, without recreating a timer on each audio frame. Microphone audio is not a speech detector: background noise must not indefinitely extend the session, while user speech without transcript deltas remains an open gap. If the output meter cannot be created, the stage warns that the session may end during playback.
- **Late voice turns:** the chat uses the current session's sorted transcript snapshots to reorder voice-message slots, preserving messages from earlier sessions and non-voice slots. This does not establish where an action card belongs relative to late speech. GPT-Live exposes an approximate `offset_ms` for delegation creation, but exact tool-call timing requires further investigation.
- **Concurrent delegation limitation:** transcript state currently uses a single `thinking` flag. Completion of one backend response can clear it while another delegation is still running; independent tracking is needed before claiming idle behavior covers overlapping work.

### 2026-11-26T20:34:00+01:00

- **M3a confirmation lifetime:** a pending Live confirmation expires at the server-issued deadline without executing the action. Its result tells the model not to retry without asking; the idle period resumes once pending work ends. The server remains authoritative for approval.
- **Saved voice calls:** selecting a saved conversation marks running or waiting voice cards interrupted, since a restored page cannot resume those calls. Listing sessions does not rewrite them. Selecting a conversation still active in another tab requires further cross-tab verification.
- **M3a context and remaining limits:** Live context excludes action-card placeholders and is capped at 128 messages, 4,096 characters per message, and 8,192 characters total. A server test confirms typed follow-ups accept voice-card summaries without re-executing the action. Delayed transcript fragments and cards are not guaranteed to appear in spoken order; the idle timer currently tracks transcript events rather than reliable speech activity.

## 2026-11-25

### 2026-11-25T12:09:00+01:00

- **Chat history is always enabled (user decision):** the old history and transcript-retention preferences are ignored when settings are loaded. Text, voice transcripts, and voice tool results are kept unencrypted in browser storage, with explicit deletion in Settings. Web Locks and available storage are still required; failures are reported rather than silently treated as saved.
- **Stored voice migration:** an unsupported legacy voice falls back to Gleam without discarding other settings. The normal settings and Live request schemas still reject unsupported choices.
- **Live context limits:** each seeded message is capped at 4,096 characters, with at most 8,192 characters and 128 messages in total. Voice transcript turn IDs are scoped to a Live session.

### 2026-11-25T11:00:00+01:00

- **M3a action cards:** Live tool calls now publish `LiveToolCard` snapshots with kind, summary, status, and optional output. Chat history stores action metadata and ChatPanel renders it without Approve/Deny controls. Pending cards remain voice-stage confirmations; cancel/end marks running changes interrupted with unknown outcome.
- **M3a natural voice catalog:** only the 24 voices documented as Natural are selectable. Gleam is default; settings and Live session validation accept catalog IDs only. Character lines are limited to the seven confirmed in the user's screenshot. Search/filter and radio selection are in Settings.

### 2026-11-25T09:46:00+01:00

- **M3a live chat updates:** Live transcript delta events publish growing user/assistant turns immediately. Each turn has a stable ID based on role and timeline position, and `ChatSessionManager` upserts one UI message rather than appending fragments or duplicate turns. The voice marker (`source: 'voice'`, `voiceTurnId`) is stored in text snapshots and the versioned chat-session schema.
- **M3a context seeding:** `session.input` carries only the newest text messages (128 maximum, 8192 characters maximum). The browser sends typed `{ role, text }` context; the trusted server validates it and maps user text to `input_text` and assistant text to `output_text` provider items. Tool parts and secrets never enter context.

### 2026-11-25T09:24:00+01:00

- **M3a leave behavior:** the Ready state and Back-to-text control are removed. End, Escape, and Close leave immediately to the text view. `LiveSessionController.leave()` synchronously disables and stops the microphone tracks and detaches the stream. `end()` owns asynchronous provider shutdown, so the UI is not blocked by `session.closed` or the close timeout.
- **Tested behavior:** Live controller unit tests, VoiceStage component tests, and all 3 voice e2e tests pass with the immediate leave path.

### 2026-11-25T09:14:00+01:00

- **M3a implementation started on `feat/m3a-voice-first`:** the first vertical slice makes voice transcripts standard. `history.retainTranscripts` is removed from the settings schema and UI; Zod parsing ignores a stored legacy value. `ChatSessionManager.appendVoiceTranscript` now depends only on `history.enabled`, so every voice turn is appended to the active chat while chat history is on.
- **User-facing rule:** the VoiceStage setup copy says that voice conversations are kept in chat history while it is enabled. When history is off, voice turns are not appended or persisted. Captions and audio remain transient.
- **Validation:** settings and live unit tests, Settings and Voice component tests, and all voice e2e tests pass.

### 2026-11-25T08:55:00+01:00

- **M3 is complete (canvas orb implemented):** the only remaining M3 build item, the canvas orb, is done; spoken approval stays deliberately deferred. The orb's moving layer is now canvas, driven only by the real audio level and the session state.
- **How the orb motion is wired:** `orb-visual.ts` keeps the motion as a pure function (`orbFrame(state, level, timeMs)`) so it is testable without a canvas. The controller (`live-session.ts`) smooths the loud side of the conversation (output level while speaking, else the microphone when on) into `audioLevel` (0..1, full scale at RMS 0.25, smoothing 0.25 per frame) and exposes it as a getter, read by the canvas each frame through `getLevel` rather than through Svelte state, to avoid per-frame reactivity.
- **Reduced-motion and fallback rule:** `AssistantOrbCanvas.svelte` draws over the static `AssistantOrb` SVG. Under `prefers-reduced-motion: reduce` or without a 2D context it does not animate, leaving the SVG sphere. The moved states (connecting, listening, speaking, thinking) no longer use CSS keyframes, so the existing e2e check that reduced motion leaves 0 running CSS animations still holds.

### 2026-11-25T08:45:00+01:00

- **M3a scope revised by the user (planning only):** this replaces the line "Considered and left out of M3a" in the entry below.
  - **Action cards are now in M3a:** the tool calls of a voice conversation appear in the chat as the cards of the text mode.
  - **Decided against, not postponed:** ending a conversation by voice, and voice inside the Assistant panel on desktop. Voice behaves the same on every screen size, and the stage stays a modal view over the whole app (a centered panel over the dimmed app on tablet and desktop).
  - **Still out of M3a:** typing during a voice conversation and voice samples in the picker.
- **Facts for the action cards:** the text mode renders AI SDK tool parts (`dynamic-tool`) with `ToolCallCard.svelte`, which shows Approve and Deny for the state `approval-requested` and sends the answer through the text chat's approval flow. Voice tool calls run through `LiveToolCoordinator` and `POST /api/live/tool` with their own approval tokens and leave no card in the chat today; `appendVoiceTranscript` adds text parts only.
- **Constraints that follow:** a voice card in the chat must never be in a state that offers Approve or Deny, because that would route a voice confirmation into the text approval flow. A card that is still running or waiting when the session ends must end up as interrupted with an unknown outcome, also after a reload.
- **To check when implementing (assumption, not verified):** a typed message after a voice conversation sends the stored chat to `/api/chat`, so the text endpoint must accept voice cards as history without executing or approving anything from them. Whether the text model gets them as tool calls with results or only the spoken text is open.

### 2026-11-25T08:35:00+01:00

- **M3a planned with the user (not implemented):** the product becomes voice first. Text and voice are one conversation with two ways of input; the chat is the record. User decisions: the transcript always joins the chat and the retention setting goes away; voice turns are written turn by turn; a voice session is seeded with the recent text of the conversation; ending a conversation always leaves to the text view; a conversation ends after 60 seconds without speech from either side; Home stays the start view and voice never starts by itself. Planning stays on `feat/m3-gpt-live-session`; implementation gets a new branch based on it.
- **Consequences to keep in mind when implementing:** voice conversations are then stored unencrypted in the browser by default, like typed chats, which changes the consent rule in `AGENTS.md` ("Data Model") and the first-use note on the stage. The stage loses "Back to text" and the Ready state, so every way out of a conversation is an end. `session.input` accepts up to 128 messages and 8,192 tokens of text; tool results are not part of it.
- **Open for implementation:** how long a waiting confirmation may keep a session open while the idle timer is paused (approval tokens last five minutes).
- **Considered and left out of M3a:** voice inside the Assistant panel on desktop, typing during a voice conversation, ending by voice, and action cards in the chat.
- **Voice picker added to M3a (user decision, 2026-11-25):** the voice is chosen from a described list instead of a text field; the information matters (character line, language, regional influence, feminine or masculine), not the Playground's look. No endpoint for listing voices is known, so the list is a catalog in the application that has to be maintained when the provider changes its voices. Sources so far: the Live guide's voice table (28 voices with language, regional influence, presentation, natural or generated) and the user's Playground screenshot with character lines for Gleam, Ripple (both "Warm and conversational"), Vesper and Bossa ("Clear and direct"), Willow ("Expressive and bright"), Stone ("Calm and precise"), and Meridian ("Grounded and measured"). Character lines for the other voices are missing; do not invent them. Sample playback stays deferred.
- **Natural voices only (user decisions, 2026-11-25):** the picker offers only voices that OpenAI documents as natural. In the Live guide's table ("Managing sessions", read on 2026-11-25) 24 of the 28 voices are natural; Quartz, Beacon, Delta, and Cinder are generated. That table covers only the "additional" voices: the current default `marin` and the other older voices (`alloy`, `ash`, `ballad`, `cedar`, `coral`, `echo`, `sage`, `shimmer`, `verse`, today's `VOICE_SUGGESTIONS`) are not classified there, so they are left out unless OpenAI lists them as natural. The user chose Gleam (`gleam`) as the new default and a closed list: no typed voice ID and no "Other voice" entry; a stored voice outside the catalog is replaced by the default, and the settings schema and the Live session endpoint are to accept only catalog voices. This replaces the earlier plan to keep any voice ID of the allowed form usable. Consequence: custom voices and newly released voices need a catalog change first.

### 2026-11-25T00:15:00+01:00

- **Voice captions (user decision):** captions are hidden by default and have no heading; a quiet "Show captions" control reveals them. `VoiceStage` exposes `captionsVisible` as a bindable prop and the page keeps it, so the choice lasts while the page is open and resets on reload. It is not a stored setting; add one only if users ask to keep captions on permanently, since captions are the text equivalent for users who cannot hear the assistant.

## 2026-11-24

### 2026-11-24T23:55:00+01:00

- **User decisions (2026-11-24):** the confirmation card with Approve and Deny works against the real service. Spoken approval is deferred beyond M3; confirmations in voice are answered on screen, and users who want a more fluid conversation relax the confirmation policy in Settings.
- **Voice entry and first use:** `LiveSessionController.prepare()` reads the microphone permission when the stage opens. Granted connects at once from every entry point; undecided (or a browser that cannot report it) shows the setup screen; refused shows the blocked screen with a retry. A `NotAllowedError` with the permission still undecided is a dismissed prompt, not a refusal. Failures before `session.started` are titled "Could not connect"; "Connection lost" is for a running session.
- **Navigation change:** the mobile navigation orb starts voice mode (`#voice-orb`, named "Start voice mode"); the text Assistant opens from the Home card's Type button and from Back to text. While the text chat is busy or awaiting approval, voice entry points open the conversation instead. Avoid the word "conversation" in accessible names of persistent controls: the chat's session selector is labelled "Conversation" and tests locate it by that label.
- **Remaining in M3:** the canvas orb driven by real levels. The stage already measures input and output levels in `live-session.ts`, but does not expose them to the view yet.

### 2026-11-24T23:32:00+01:00

- **Tool bridge confirmed against the real service (user, 2026-11-24):** lights and scenes on the user's Home Assistant were controlled by voice, so real `function_call` items, `POST /api/live/tool`, `function_call_output`, and the `response.create` continuation work end to end. The user did not say whether the confirmation card appeared or which confirmation policy was set; the confirmation and denial paths are verified only by the automated tests.

### 2026-11-24T23:30:00+01:00

- **Firefox works (user, 2026-11-24).** With the explicit microphone constraints the level peaks at 0.09 to 0.16 while speaking, against 0.005 before. The user was also asked to check the input device, so whether gain control or the device made the difference is unknown. Keep the explicit constraints.
- **Correction to the previous entry:** the byte rate is not a usable signal. In Firefox it was 1.6 to 2.9 kB/s in silence and 3.3 kB/s during speech, so "silence-sized packets" proved nothing. Judge the microphone by its measured level.
- **Event sequence observed from the real service, matching the documentation:** `session.input_transcript.delta` and `session.output_transcript.delta` interleaved, then `session.delegation.created`, then nested `response.created`, `response.in_progress`, `response.output_item.added`, `response.content_part.added`, `response.output_text.delta` (many), `response.output_text.done`, `response.content_part.done`, `response.output_item.done`, `response.completed`; `session.usage.updated` periodically; `session.closed` at the end. That delegation returned text only. A `function_call` item, the tool continuation, and a confirmation have still not been seen against the real service.

### 2026-11-24T23:22:00+01:00

- **Firefox measurements (user's console):** the negotiation is sound. Firefox offers Opus as payload 109 with the audio section first, OpenAI answers `sendrecv` with the same payload, and packets flow both ways. The evidence points at the input signal: the microphone level read 0.005 (noise floor at 8-bit resolution) and the packets averaged 44 bytes, the size of encoded silence. No `session.input_transcript.delta` arrived. Both readings were one snapshot, so this is likely but unproven; a wrong input device chosen in Firefox, or no gain control, would explain it.
- **Changes on that basis:** `getUserMedia` now requests echo cancellation, noise suppression, and automatic gain control explicitly; levels are measured from float samples; the development console reports every 3 seconds the loudest microphone level since the last report and the bytes sent per second. As a guide, speech sends several kilobytes per second and reads well above 0.02.
- **If Firefox still fails with a healthy level and byte rate,** the browser is sending real speech and the problem is on the provider's side of the media path; application code cannot fix that.

### 2026-11-24T23:12:00+01:00

- **Real-service status (user, 2026-11-24):** a spoken conversation works in Chrome. In Firefox the session connects but speech draws no reaction and no error.
- **Firefox is not explained yet:** the voice end-to-end tests pass in Playwright's Firefox for the stage, both level meters, playback, tool calls, and the confirmation (only the Axe audit crashes that headless page), so the application's browser code runs there. What the faked peer cannot show is the media negotiation with OpenAI. The development console now logs `offer media` and `answer media` (media lines, codecs, and directions only), `microphone` (track state and measured level), and the packet counts; read these from a Firefox attempt before changing code. Playwright's Firefox was installed locally for this check and is not part of `playwright.config.ts`.
- **Speaking state:** per-frame levels flip at every pause between words, which made the stage jump in a real conversation. Speaking now holds for 0.8 seconds after the last sound, and the chip row has a fixed height.

### 2026-11-24T22:55:00+01:00

- **Third real-service report (unresolved):** the session connects and shows Listening, but the user's speech draws no reaction, with no error anywhere. Compared with the provider's browser sample, the only difference was order: the sample adds the microphone track before creating the data channel, which puts the audio section first in the offer. The controller now does the same. Whether that was the cause is unknown; the user's microphone or input device is the other candidate.
- **Diagnostics added for this:** an input level meter shows "No sound is arriving from your microphone yet" when the microphone has delivered no sound for 8 seconds, until sound was measured once. In development the browser console logs every Live event type under `[live]`, `error` event details, and after 5 seconds whether audio packets are sent and received. Transcript text is never logged. Non-fatal notices now include the provider's error code.
- **Next step if it persists:** read the `[live]` console lines. No `session.input_transcript.delta` with `audio sent` packets rising means the provider receives audio it does not transcribe; no packets means the browser sends nothing.

### 2026-11-24T22:45:00+01:00

- **Second real-service finding (user report "Audio level monitoring is unavailable"):** after the SDP fix the session was created, but the first remote audio track ended it. `browserRuntime()` stored `requestAnimationFrame`/`cancelAnimationFrame` (and `fetch`) as bare references; called as methods of the runtime object they throw "Illegal invocation". `fetch` only worked because SvelteKit replaces `window.fetch` with a wrapper. Wrap window functions in arrow functions when injecting them.
- **Why tests missed it:** unit tests inject a fake runtime and the end-to-end fake never delivered a remote track. `e2e/voice.test.ts` now delivers a real audio stream, so the real `AudioContext`, level meter, and playback path run in the browser, and the Speaking state is asserted from a real signal. Prefer real browser APIs in the end-to-end fake wherever only the network peer must be faked.
- **Decision:** a failing level meter no longer ends the conversation; it only drives the Speaking state. Data-channel errors while the session is closing are ignored, since only `session.closed` decides the outcome.

### 2026-11-24T22:35:00+01:00

- **First real GPT-Live attempt failed with HTTP 400 at session creation (user report):** the request shape matches the API reference, but the request schema trimmed the SDP offer and so dropped its final CRLF. Forward the offer byte for byte; never normalize SDP. Whether this was the only cause is unconfirmed until the user retries.
- **Provider rejections are now diagnosable:** `live.session.failed` logs the provider's error `type`, `code`, `param`, and a truncated, key-scrubbed `message`, plus the backend model, voice, and tool count. Credential errors (401/403) log no provider details. The browser sees only the field path and code. This replaces the earlier rule that nothing from the provider response is logged.

### 2026-11-24T22:20:00+01:00

- **M3 tool bridge (documented flow, verified against fakes only):** With Responses delegation, completed function calls arrive on the data channel as `response.event` envelopes whose nested event is `response.output_item.done` with a `function_call` item; the forwarded lifecycle snapshots carry no output items. Results go back as `response.item.create` (`function_call_output`), and the backend resumes only after an explicit `response.create`, sent once the nested `response.completed` arrived and every call has a result. `src/lib/live/tool-calls.ts` owns this; calls are keyed by the envelope's `delegation_id`.
- **Server authorization for voice:** `POST /api/live/tool` (`src/lib/server/live/tools.ts`) is the only path that executes a delegated call. It applies `evaluateToolCall`, `MCP_ALLOW_MUTATIONS`, and the confirmation policy sent with the request (a browser preference, as in text chat). Approval tokens are `expiresAt.signature`, an HMAC over session ID, call ID, tool name, a hash of the raw arguments, and the expiry, so they carry no claims and verify only against the same request. Single use is kept in process memory; several server instances would need shared storage. A denial always wins, whatever the policy.
- **Live `error` events are not fatal:** rejected commands, `responses_validation_failed`, and moderation notices leave the session open. The controller shows a notice and ends only on `session.closed` (reasons `expired` and `content` have their own messages) or a lost connection.
- **Lifecycle rules worth keeping:** `end()` is shared between callers, disables the microphone track immediately, and abandons pending tool work before sending `session.close`, because a response waiting for a tool result cannot continue once closing starts. The Voice entry is blocked while the text chat is streaming or awaiting approval, since retained voice turns are appended to that chat's messages.
- **Open:** spoken approval is decided in principle but not designed (how "unambiguous" is determined); nothing has run against the real GPT-Live service; the session is not seeded with the text conversation (`session.input`).

### 2026-11-24T21:40:00+01:00

- **M3 browser session lifecycle:** The browser sends the gathered SDP offer only to `/api/live/session`, waits for `session.started`, then manages microphone, remote playback, data-channel events, and `session.close`/`session.closed`. Startup cancellation releases a microphone stream if permission resolves late; output audio level is measured without routing duplicate audible output.
- **M3 transcript retention:** OpenAI transcript deltas provide `start_ms`/`end_ms` but no item ID or turn-completion event. Group fragments per speaker using their timeline intervals; the current 1.5-second gap is an application heuristic. Retained turns are added to the active AI SDK chat only when `history.retainTranscripts` is enabled; ending the session clears in-memory transcript state and no audio is persisted. Keep the tool bridge, server authorization, and confirmation flow as separate remaining work; no real OpenAI or Home Assistant call has been validated.

### 2026-11-24T21:06:00+01:00

- **M3 server session endpoint:** OpenAI's current unified WebRTC flow accepts `{ session, transport: { type: "webrtc", sdp } }` at `/v1/live/sessions` and responds with `session.id` plus `transport.sdp`. `POST /api/live/session` keeps the standard API key in the server-to-server Authorization header, validates a 64 KB SDP offer and the provider response, and returns no credential to the browser. Shared hooks enforce origin, request-size, and rate controls; the provider response body is never logged or surfaced.

### 2026-11-24T21:01:44+01:00

- **M3 product decisions (user-confirmed):** keep retained voice turns in the active text-chat session; end a voice session after 60 seconds in a hidden tab; allow explicit, unambiguous speech to approve only the active server-issued confirmation while retaining on-screen controls; use Responses application functions routed through the server MCP gateway without forwarding MCP credentials to OpenAI; defer voice sample playback beyond M3. Ambiguous speech must never approve.
- **Voice stage accepted:** the user approved the fixed-data gallery. Proceed to trusted-server WebRTC session provisioning on `feat/m3-gpt-live-session`; audio has not yet been connected.

### 2026-11-24T20:52:37+01:00

- **GPT-Live documentation reviewed for M3:** the current Live guide recommends browser WebRTC with the trusted server exchanging the browser SDP offer for an SDP answer via `POST /v1/live/sessions`; the HTTP request starts the session, the browser waits for `session.started`, and it must not send `session.start`. This replaces the earlier plan wording about returning an ephemeral session credential. Responses delegation supports MCP and custom functions, but the application still owns tool authorization and confirmations. The current OpenAI Live Console sample targets `gpt-live-1` and a fictional read-only catalog, so it is only a pattern reference, not validation of the planned `gpt-live-1.1` integration.
- **M3 first slice:** `VoiceStage` and its development-only state gallery use fixed sample states and have no microphone, audio, or provider connection. Keep the audio integration behind the user's review of the gallery and resolution of the transcript-retention and hidden-tab decisions.

### 2026-11-24T20:27:06+01:00

- **M2a is complete (user decision):** the design milestone, including device acceptance, is accepted. Next planned work is M3 (GPT-Live), which starts with the presentational voice stage and its state gallery as specified in `Design.md`; the open product decisions in "Open Design Questions" (transcript destination, spoken approval, hidden tab, voice samples) should be answered before or early in M3. The M2a branch `feat/m2a-mobile-design` is not yet merged into `main`.

### 2026-11-24T18:27:46+01:00

- **Favicon assets:** `static/favicon.ico` and `static/apple-touch-icon.png` are derived from `static/favicon.svg`; there is no generator script in the repository. Re-render them (for example with Playwright, transparent background for the ICO, full-bleed `#0b142d` for the touch icon) whenever the SVG changes.

### 2026-11-24T18:09:24+01:00

- **Voice mode specification:** `Design.md` "Future Voice Mode" is the complete spec for M3. Decisions taken from the user's UX workspace prototype (a simulation with seven states and a state selector, mic never used): mute is a property of the microphone, not a state; the status word stays one constant color; exits are End and Back to text; first use shows one setup screen with "Allow microphone"; focus returns to the opener. Added by us: thinking/delegation and tool-use states, priority rules for overlapping states, real-signal-only orb motion, and confirmation focus handling. Open product decisions (transcript destination, spoken approval, hidden tab, voice samples) are in "Open Design Questions".
- **Workspace labels are swapped:** on that site, `voice-reference.png` is a chat screenshot and `chat-reference.png` is the wireframe orb. The images were only inspected temporarily and are not stored in the repository.
- **Test environment:** the E2E server shares one rate limiter (default 30 requests per minute) across parallel tests, so many page loads surface as "Too many requests" and a missing Rooms region. `playwright.config.ts` raises the limit; production defaults are unchanged.
- **Measuring contrast on gradients:** Axe cannot judge text over gradients and blur. `measureContrast` in `design-acceptance.test.ts` hides the text, screenshots the page, and samples the real pixels under each text box. Wait for smooth scrolling and Tailwind color transitions to finish first, or the result is wrong (a mid-scroll read reported 1.02:1).
- **Layout hardening:** `overflow-wrap: anywhere` on the shell and `min-width: 0` on fieldsets keep long words from forcing horizontal scrolling at 200% text. A focus ring that sits on a field wrapper (composer) counts as the field's focus indicator.
- **Not automated:** real iOS Safari and Android Chrome behavior with the on-screen keyboard, real screen readers, and mid-range phone smoothness remain the user's device acceptance.

### 2026-11-24T00:05:57+01:00

- **Minimal settings (user requirement):** onboarding and Settings show only what every user needs to start: server address, access token, and OpenAI API key, plus the active confirmation rule. Add new options under "Advanced settings" unless all users need them to start. Hidden-field errors must open the disclosure and focus the field (`ESSENTIAL_FIELDS` in `SettingsForm.svelte`).
- **Auth default:** `mcp.authType` defaults to `bearer`, because the Home Assistant MCP integration requires a long-lived access token. Tests no longer select it.
- **Test selectors:** use `{ exact: true }` for "Access token" (also matches "Home Assistant access token"), "Voice" (also matches the transcript checkbox), and "Advanced settings" (also appears in the safety summary).

## 2026-11-23

### 2026-11-23T23:46:41+01:00

- **Design system usage:** build UI from the tokens and utilities in `src/routes/layout.css` (`surface-*`, `btn btn-*`, `field`, `notice notice-*`, `icon-well`, `form-section`) instead of one-off colors. `field` sets only `background-color`, because the `background` shorthand removes the forms plugin's select arrow.
- **Shortcut path:** Home shortcuts call `getChatSessionManager().submitShortcut()`, which reuses the normal chat request and server-side approval and refuses while a switch, response, or pending approval is in progress. Use this path, not a new endpoint, for later assistant shortcuts.
- **Home data:** `src/lib/home/summary.ts` derives the status sentence and summaries from one fetch. Scenes and scripts report "unknown" when not yet triggered; treat that as idle, not unavailable.
- **E2E port conflict:** Playwright starts its own fake MCP server on port 4180. Stop any manually started fake server first, or the suite aborts without test output.

### 2026-11-23T23:18:37+01:00

- **Prettier on Windows:** `core.autocrlf=true` gives working-tree files CRLF endings, so `npx prettier --check .` reports many unchanged files. Judge formatting by the files you changed, or compare against `main`, before treating it as a regression.
- **Flaky-test diagnosis:** compare a failing test against `main` in a temporary `git worktree` (with a `node_modules` junction). Remove that junction with `cmd /c rmdir` only, never with recursive `Remove-Item`, so the shared `node_modules` stays intact.

### 2026-11-23T23:07:46+01:00

- **M2a desktop orb:** The user wants the orb to be a central desktop element too. The agreed direction places a prominent orb in the empty Assistant panel and a compact orb in its header during conversations; the immersive voice orb remains in M3.

### 2026-11-23T22:57:30+01:00

- **M2a initial shell:** `src/routes/+page.svelte` keeps both Home and Assistant mounted on mobile and hides the inactive view, because unmounting `ChatPanel` cancels work. Switching views scrolls to the top; Settings remains a separate route with its existing cancellation behavior.
- **Initial design choices:** Plus Jakarta Sans is self-hosted through `@fontsource-variable/plus-jakarta-sans`, icons use `@lucide/svelte`, and the orb is original static SVG/CSS. Home and chat still use their light surfaces pending their dedicated M2a redesigns.

### 2026-11-23T22:36:37+01:00

- **Plan review against the design:** later milestones extend the M2a views instead of adding new ones. M3 builds voice mode inside the Assistant view and switches the orb to a microphone; M4 adds live status, a server-side path for direct actions, quick actions with a confirmation sheet, and the Activity view; M5 adds login screens and a Content Security Policy.
- **Open decisions recorded in `Milestones.md`:** whether a spoken confirmation may approve an action (default: on-screen control only) and whether scene tiles become direct actions in M4 or remain assistant shortcuts.
- **Plan corrections:** M3 implements Responses delegation as already decided; the M4 settings todo was already delivered by the M1 Settings flow.

### 2026-11-23T22:27:27+01:00

- **M2a visual reference (user decision):** `docs/design/reference-mobile-home.png` is the model for the whole design milestone: deep navy background with blue-violet light fields, translucent glass cards, a glowing network orb, and a bottom bar with Home, a center orb, and Settings. `Design.md` records palette values sampled from it and maps each reference element to the product.
- **Navigation and actions (user decisions):** Home is the mobile start view; the center orb opens the text assistant until M3 adds voice, so it must not show a microphone before then. Home cards are read-only in M2a; scene tiles submit a request to the assistant and use the existing confirmation. Direct switches stay in M4. The greeting uses an optional display name from Settings.
- **Constraints found:** `ChatPanel` cancels in-progress work on unmount, so the new shell must keep the conversation alive between Home and Assistant. There is no direct action endpoint and no user-name setting. Home Assistant scenes have no on/off state, so scene tiles cannot show an "active" state.

### 2026-11-23T22:02:59+01:00

- **Documentation language (user requirement):** write all repository project context in English, including the evolving design documentation.

### 2026-11-23T17:57:23+01:00

- **Project-wide design:** `Design.md` is the living UI/UX direction for the whole product, including future features. Read and evolve it during UI work; M2a remains planned, and the voice interaction itself remains in M3.

### 2026-11-23T17:52:19+01:00

- **M2a design direction (user request, planned):** move from desktop-first to mobile-first while preserving existing MVP functionality. Use an original, calm dark blue/indigo/violet visual language across chat, home overview, onboarding, and Settings; design an immersive voice experience, but leave voice implementation to M3.
- **Safety and accessibility:** keep read-only status distinct from state-changing actions, preserve server-side authorization and confirmation, and ensure the visual system works without relying on color or motion alone.

### 2026-11-23T17:38:19+01:00

- **M2 assistant Markdown:** assistant text, including restored chat history, is rendered with Marked and sanitized with DOMPurify before insertion. Raw HTML is escaped and Markdown images are reduced to alt text to avoid automatic remote requests; user messages remain plain text.

### 2026-11-23T17:19:22+01:00

- **M2 session history implemented:** each saved chat has its own versioned localStorage key; a document-scoped manager preserves the active chat across client-side navigation but starts a fresh chat after reload or in a new tab. Legacy v1 single-chat history is deleted, not migrated.
- **Concurrency and safety:** Web Locks and expected-value checks prevent stale same-session writes; separate sessions are stored independently. When Web Locks are unavailable, history saving is disabled with an explicit error while chat and data deletion remain usable. Switching sessions discards pending approvals and warns that interrupted actions may have an unknown outcome.

### 2026-11-23T17:05:49+01:00

- **M2 session history correction (user decision, planned):** delete the existing v1 chat history when introducing session-based history; do not migrate it. This supersedes the earlier migration decision. Preserve settings and credentials.

### 2026-11-23T17:03:45+01:00

- **M2 session history (user decision, planned):** start a new text-chat session on a new tab, browser restart, or page reload; returning from Settings preserves the active session. Previous sessions remain selectable and continuable when history is enabled.
- **Migration and switching (user decision, planned):** migrate the existing v1 text history into a selectable session. Switching sessions cancels an ongoing response and pending confirmations; cancellation does not guarantee that an already-started device action was undone.

### 2026-11-23T16:09:21+01:00

- **M2 real Home Assistant comparison:** the user supplied anonymized discovery and `GetLiveContext` output from a real instance. Observed names include `homeassistant__GetLiveContext`, `llm__GetDateTime`, `intent__HassTurnOn`/`HassTurnOff`, `light__HassLightSet`, and `climate__HassClimateSetTemperature`; the existing prefix matching and policy classify them as intended.
- **Observed context format:** JSON text with a `result` string containing the YAML-like entity list, `names`, `domain`, `state`, `areas`, and nested `attributes`. Gateway regression tests exercise this structure with synthetic names. This is a comparison of user-provided observations, not an independent live connection or a test of real mutations.

### 2026-11-23T15:42:40+01:00

- **M2 text history (user decision):** the history setting permits unencrypted browser storage of text chat messages; the separate transcript setting applies to future voice transcripts. Disabling history neither loads nor updates the previously saved chat, which can be explicitly deleted in Settings.
- **History safety:** only user/assistant text is restored as model context. Tool inputs, outputs, and approvals are not persisted; unfinished actions are flagged as having an unknown outcome rather than resumed. If another tab changes history or settings, the chat stops saving and asks for a reload.
- **Real Home Assistant verification:** still blocked on user assistance. The fake MCP tests do not establish the real integration's tool names, prefixes, or `GetLiveContext` format.

### 2026-11-23T15:28:08+01:00

- **Branch confirmation (user requirement):** agents must ask the user (via `ask_user`) before every branch creation or switch, proposing a recommended branch as default. Only staying on the current branch for a continuing topic proceeds without asking.

### 2026-11-23T15:24:36+01:00

- **Branching workflow (user requirement):** new features, fixes, and docs work happen on separate branches. Before every file-changing request, apply `.github/skills/git-branching`: stay on the current branch for the same topic, otherwise branch from up-to-date `main` as `<type>/<short-topic>` (types from Conventional Commits, milestone ID when applicable). Uncommitted work is never carried onto an unrelated branch.
- **Merging:** agents do not merge, push, or delete branches unaided; when a topic is complete they offer `git merge --no-ff` (revertable with `git revert -m 1`) or a pushed branch/pull request.
- **Remote:** `origin` is `https://github.com/friesbj/home-agent.git`; `main` tracks `origin/main`.

## 2026-11-22

### 2026-11-22T16:10:00+01:00

- **Layout convention:** the dashboard (`/`) is viewport-bound on `lg+` screens: page container `lg:h-dvh` flex column, `main` grid with `lg:min-h-0 lg:flex-1`, and every scrolling child needs `min-h-0` plus its own `overflow-y-auto`. New panels must follow this so the chat input never scrolls out of view.
- **Home overview UX:** areas are collapsed by default except favorite areas (from Settings); open state is kept per area name across refreshes via a function binding on `<details bind:open>`.

### 2026-11-22T16:05:00+01:00

- **GetLiveContext has no entity IDs:** real Home Assistant instances contain entities with identical names and domains. Never key `{#each}` blocks over entities by name/domain alone; Svelte throws `each_key_duplicate` and silently stops rendering the list.
- **Home overview semantics:** the "Your home" panel is a read-only snapshot of exposed entities grouped by area, loaded on page load and via Refresh. It does not show chat actions and does not update automatically after a change; live updates arrive with the M4 WebSocket work.

### 2026-11-22T15:50:03+01:00

- **M2 implemented:** text chat with Home Assistant tools, MCP gateway, discovery, home overview, tool-call display, and server-enforced confirmations. Two follow-ups were added to M2: browser chat history and verification against a real Home Assistant instance.
- **MCP server choice (user decision):** the official Home Assistant "Model Context Protocol" integration; client library `@ai-sdk/mcp` (2.0.x, matches `ai` 7 / `@ai-sdk/provider` 4).
- **Tool allowlist:** `src/lib/home/ha-policy.ts` is shared with the UI. Matching uses the base name after the last `__` because HA may prefix tool names with the tool set (e.g. `homeassistant__GetLiveContext`). `HassTurnOn`/`HassTurnOff` require a `domain` argument in `light|climate|scene|script`; otherwise they are blocked. The admin "Call action" tool is blocked.
- **Confirmation enforcement:** `streamText({ toolApproval, experimental_toolApprovalSecret })` in `src/lib/server/chat/chat-service.ts`. Blocked calls are auto-denied (`isAutomatic: true` chunks, no buttons), reads are `not-applicable`, mutations are `user-approval` or auto-`approved` according to the browser policy. Signed approvals reject forged, unsigned, and input-tampered replays (verified by mutation-testing the secret). Gateway `execute` re-checks the policy on every call.
- **Client approval flow:** `Chat` uses `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses` and `addToolApprovalResponse`; the server passes `originalMessages` so continuations append to the same assistant message. The server-generated summary is in `part.approval.requestReason`.
- **SSRF controls:** `src/lib/server/mcp/url-guard.ts` resolves DNS and rejects link-local/unspecified always and private/loopback unless allowed; `createPinnedFetch` only fetches the validated origin and forces `redirect: 'error'` (also covers SSE `endpoint` events). DNS rebinding between check and fetch is not prevented yet.
- **Connections are per request:** the gateway connects for each chat/discover/state request and closes in `onEnd`/`onAbort`/`onError` or `finally`.
- **Home overview:** parses the YAML-like `GetLiveContext` text (optionally wrapped in `{ success, result }` JSON) with a tolerant line parser; no YAML dependency.
- **Testing:** `MockLanguageModelV4` from `ai/test` drives chat tests (V4 stream parts need `stream-start` and `finish` with `{ unified, raw }` finish reasons and nested usage). The fake MCP server (`src/lib/server/mcp/fake-ha-mcp-server.ts`) runs under Node 24 type stripping for Playwright, which now has two `webServer` entries and an explicit `baseURL`.
- **Encoding pitfall:** Windows PowerShell 5.1 `Set-Content -Encoding utf8` writes a BOM; it had slipped into `README.md` and `.env.example` in M1. Use `[IO.File]::WriteAllText` with `UTF8Encoding($false)`.
- **Dev server note:** the first `vite dev` run after dependency changes re-optimizes and reloads the page; automated browser scripts against dev may need a retry.

### 2026-11-22T15:09:17+01:00

- **Commit workflow:** the user requires traceable, modular git history so recent changes can be reverted cleanly. `.github/skills/commit-work/SKILL.md` defines it: verified, self-contained Conventional Commits (tests with code, deps with lockfile, no mixed formatting), `Milestone:` trailer, Copilot co-author trailer, explicit path staging, no push/history rewrite without request.

### 2026-11-22T15:03:37+01:00

- **M1 complete:** Foundation implemented and verified (check, unit, component, e2e).
- **Better Auth removed:** wiring, demo routes, placeholder schema, and `better-auth`/`@better-auth/cli` packages were removed. Drizzle/SQLite files remain reserved for later; `src/lib/server/db` is unused.
- **SPA rendering:** `src/routes/+layout.ts` sets `ssr = false` and redirects to `/onboarding` until `onboardingCompleted` is stored. `+layout.server.ts` supplies `mcpUrlPolicy` and `serverHasOpenAiKey`.
- **Browser storage:** `src/lib/config/settings.ts` owns zod schemas and `{ version: 1, data }` envelopes under `home-agent.settings.v1`, `home-agent.confirmation-policy.v1`, `home-agent.secrets.v1`. Invalid/unknown data falls back to defaults. `app-config.svelte.ts` is the reactive store; secrets are read only via `getSecret`.
- **OpenAI key flow:** the browser sends its stored key in the `x-openai-api-key` header (`src/lib/config/headers.ts`) to `/api/chat`; the server falls back to `OPENAI_API_KEY`. Chat model comes from the request body (validated) or `OPENAI_TEXT_MODEL`.
- **MCP URL policy:** `src/lib/config/mcp-url.ts` (shared). Link-local/unspecified always blocked; private/loopback hosts and `http:` controlled by `MCP_ALLOW_PRIVATE_HOSTS`/`MCP_ALLOW_INSECURE_HTTP` (default true in dev, false in prod). No DNS resolution yet; the M2 gateway must re-validate server-side and check resolved addresses.
- **Env validation:** `src/lib/server/env-schema.ts` (pure, testable) + `env.ts` (cached `getServerEnv()`); `hooks.server.ts` `init` fails fast on invalid config.
- **API protection:** `hooks.server.ts` applies same-origin/`ALLOWED_ORIGINS` checks, body-size limit, and an in-memory per-IP fixed-window rate limiter to `/api/*`, and sets `x-request-id`. Chat uses `abortSignal` + `timeout.totalMs`.
- **Confirmation preference:** `requiresConfirmation()` treats `mode: 'none'` as confirm-all unless `acknowledgedNoConfirmationRisk` is true.
- **Testing:** unit `src/**/*.spec.ts` (Node), component `src/**/*.svelte.spec.ts` (Chromium), e2e `e2e/*.test.ts` against the production build. Playwright Chromium is now installed locally.
- **Prettier:** pre-existing Markdown files (README, context files, skills) fail `prettier --check`; not yet reformatted.

### 2026-11-22T08:03:48+01:00

- **Confirmation settings:** mutating-action confirmation is configurable in onboarding and a later Settings page.
- **Default policy:** confirm every mutation is the default private-MVP preference.
- **Policy options:** confirm every mutation, confirm high-risk mutations only, configure by domain/entity, or explicitly disable confirmation for a trusted private deployment.
- **Server invariant:** changing a browser preference never disables server-side allowlists or authorization validation.
- **Editability:** MCP address, credentials, voice/model, favorites, confirmation policy, and reset behavior must be editable after onboarding.

### 2026-11-22T07:59:08+01:00

- **M0 finalized:** planning and repository context decisions are complete.
- **Confirmation policy:** every mutating Home Assistant action requires explicit confirmation in the private MVP.
- **History:** browser-side conversation/action history is enabled for persistence.
- **User model:** the private MVP supports one user.
- **GPT-Live backend:** the backend reasoning model is onboarding-selectable.
- **GPT-Live voice:** the voice is onboarding-selectable.
- **Entity updates:** use Home Assistant WebSocket events.
- **Next phase:** M1 Foundation can begin in a later implementation session.

## 2026-11-21

### 2026-11-21T23:08:33+01:00

- **Documentation:** `README.md` now describes the Home Agent MVP, GPT-Live/MCP architecture, Browser-first credentials, private deployment constraints, setup commands, and repository context files.
- **Documentation language:** The README and project documentation are maintained in English.
- **Commit state:** Planning and documentation are ready for an initial repository commit. Implementation should begin in a subsequent session.

### 2026-11-21T23:02:40+01:00

- **MVP credential source:** OpenAI and MCP/Home Assistant credentials are configured through Browser Storage for the private testing MVP.
- **Public access:** The private MVP is unauthenticated and must be restricted to a private testing environment; it must not be broadly published.
- **Initial domains:** lights, climate, scenes, scripts, and read-only states.
- **GPT-Live delegation:** Responses delegation is the first implementation choice.
- **Authentication timing:** Better Auth and public session ownership are deferred until generally available public release.
- **MCP safety:** Public exposure requires SSRF prevention and private/link-local address policy. The browser-first prototype must use restricted deployment controls.

### 2026-11-21T22:58:41+01:00

- **Repository maintenance:** Three persistent context files are now maintained:
  - `agent-knowledge.md` for timestamped decisions and discoveries
  - `agent-changelog.md` for implementation/change history
  - `Milestones.md` for milestones and agent-owned todos
- **Repository skills:** The maintenance rules live under `.github/skills/agent-knowledge`, `.github/skills/agent-changelog`, and `.github/skills/milestones`.
- **Session workflow:** Future sessions should read `AGENTS.md`, `Milestones.md`, recent knowledge entries, and recent changelog entries before implementation.

### 2026-11-21T22:58:41+01:00

- **Project direction:** A public internet smart-home SPA for natural-language control of Home Assistant.
- **Initial MVP:** Text chat before voice.
- **Voice architecture:** GPT-Live over browser WebRTC, not the older Realtime-only architecture.
- **GPT-Live models:** `gpt-live-1.1` is the frontend/conversation model. A backend reasoning model is selected independently.
- **GPT-Live delegation:** Responses delegation and client delegation are available modes. A mode must be selected for a Live session; switching modes requires a new session.
- **Backend responsibilities:** Reasoning, tool workflow, business rules, permissions, confirmations, task state, and MCP execution.
- **Frontend/live responsibilities:** Listening, speaking, conversation style, delegation decisions, transcripts, audio, and session lifecycle.
- **MCP:** The initial integration assumes an existing MCP server for Home Assistant.
- **Browser-first storage:** The prototype may store configuration and secrets in Browser Storage.
- **Storage boundary:** Browser Storage is not a production security boundary. Before public production hardening, secrets must move to server-side storage or secure session provisioning.
- **Onboarding:** The first run collects the MCP server address, optional transport/authentication settings, voice, backend model, text model, and confirmation preferences.
- **Authentication:** Better Auth/SQLite is not required for the initial browser-only prototype. Public deployment still requires a suitable server authentication and authorization approach.
- **Security:** An OpenAI key was previously placed in `.env`; it must be rotated and never committed or copied into source or knowledge entries.

### 2026-11-21T22:51:48+01:00

- **Storage decision:** Browser Storage may replace the initial application database in the SPA prototype.
- **Cookie rule:** Raw credential-bearing cookies should be avoided. If used for server sessions, they should be `HttpOnly`, `Secure`, and have an appropriate `SameSite` setting.
- **Data rule:** Voice recordings and full transcripts should not be stored unless explicit retention is enabled.

### 2026-11-21T22:49:09+01:00

- **Onboarding decision:** The application should ask for the MCP server address and essential voice/settings on first start.
- **Onboarding fields:** MCP address and transport, optional display name/authentication, preferred voice, models, confirmation preference, and favorite areas/domains.

### 2026-11-21T22:47:15+01:00

- **Deployment decision:** Public internet deployment is the target.
- **Live transport:** WebRTC in the browser is the primary live transport.
- **MCP availability:** An existing Home Assistant MCP server is assumed.
- **Implementation order:** Text MVP before voice MVP.

### 2026-11-21T22:43:27+01:00

- The project plan was added to `AGENTS.md`.
- Planned architecture: SvelteKit frontend, server-only OpenAI adapter, server-only MCP gateway, and Home Assistant MCP server.
- Initial routes include `/`, `/settings`, and optional `/history`; authentication uses an appropriate public-internet approach.
