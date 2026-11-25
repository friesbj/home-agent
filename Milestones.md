# Milestones

This file tracks project milestones and agent-owned implementation todos.

## Status Legend

- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked

## M0 - Planning and Repository Context

- [x] Define project goal and public-internet target.
- [x] Define text-first MVP and GPT-Live second phase.
- [x] Define GPT-Live full-duplex architecture.
- [x] Define Browser Storage as initial prototype persistence.
- [x] Define first-run onboarding requirements.
- [x] Create persistent agent knowledge, changelog, and milestone files.
- [x] Create repository skills for knowledge, changelog, and milestone maintenance.
- [x] Update the project README with architecture, security, setup, and MVP status.
- [x] Choose Browser Storage credential configuration for the private testing MVP.
- [x] Choose Responses delegation for the first GPT-Live implementation.
- [x] Choose lights, climate, scenes, scripts, and read-only states as the initial Home Assistant allowlist.
- [x] Defer login authentication to the generally available public release.
- [x] Define confirm-every-mutation as the default private-MVP confirmation policy.
- [x] Make mutating-action confirmation policy configurable in onboarding and Settings.
- [x] Persist browser-side conversation/action history when enabled.
- [x] Limit the private MVP to one user.
- [x] Make the backend reasoning model and GPT-Live voice onboarding-selectable.
- [x] Use Home Assistant WebSocket events for live entity updates.
- [x] Finalize M0 planning and repository context.

## M1 - Foundation

- [x] Repair or replace the placeholder Better Auth database schema if it remains in use. (Removed: Better Auth wiring, demo routes, and placeholder schema; auth deferred to M5.)
- [x] Establish a browser-storage configuration module with versioned keys and redaction-safe helpers.
- [x] Implement onboarding for MCP address, transport, credentials, voice, and model preferences.
- [x] Implement the dedicated Settings flow for editing credentials, MCP address, voice/model, confirmation policy, favorites, and reset behavior.
- [x] Add MCP URL validation and an HTTPS/localhost development policy.
- [x] Replace the leaked/placeholder API-key setup with secure configuration review.
  - The previously exposed key in the local `.env` must still be revoked by the user (not verifiable by agents).
- [x] Protect public server routes with same-origin checks, rate limits, and body-size limits.
  - Authentication/session ownership is deferred to M5 per the recorded product decision.
- [x] Add rate limiting and request-duration limits.
- [x] Add unit/component test conventions.
- [x] Validate configuration and environment values at startup.

## M2 - Text MVP

- [x] Build a polished text chat interface.
- [x] Connect the chat endpoint to the selected text/Responses model.
- [x] Implement a server-side MCP gateway.
- [x] Enforce the MCP URL policy server-side, including DNS resolution to private/link-local addresses.
- [x] Support existing MCP server discovery and read-only tool discovery.
- [x] Add Home Assistant area/entity status views.
- [x] Show tool calls and redacted results.
- [x] Add basic mutating-action confirmation.
- [x] Add text chat integration and security tests.
- [x] Persist browser-side chat history when history is enabled in Settings.
- [x] Verify the gateway against a real Home Assistant instance (tool names, prefixes, and GetLiveContext format).
  - Compared the user's anonymized real discovery and GetLiveContext output with the gateway; regression tests cover the observed names and result structure. Real mutation execution was not tested.
- [x] Store browser text history as separately identifiable sessions; delete the legacy v1 chat history during the transition without changing settings or credentials.
- [x] Start a new empty chat session on a new tab, browser restart, or page reload; retain the active session when returning from Settings.
- [x] Provide an accessible session selector and resume the selected conversation with its own message context.
- [x] On session switch, cancel ongoing responses and pending confirmations; isolate late results and warn when the outcome of an already-started action is unknown.
- [x] Preserve history opt-out, explicit history deletion, error reporting, and cross-tab safety for session-based storage.
- [x] Add unit and browser tests for legacy history deletion, session lifecycle and selection, cancellation, privacy settings, and concurrent tabs; update user documentation.
- [x] Render assistant Markdown, tables, and code blocks safely in the text chat.

## M2a - Mobile-First Product Design

Design direction: see [Design.md](./Design.md) for the living, project-wide "ambient home" concept and rollout. The user's [mobile reference screen](./docs/design/reference-mobile-home.png) is the visual model for the whole milestone. Preserve existing chat, settings, onboarding, history, MCP, and confirmation behavior. This is a design and frontend milestone; actual voice capability remains in M3 and direct device switches remain in M4.

- [x] Establish the design foundation: semantic tokens and Tailwind theme mappings, ambient background, self-hosted font, glass and solid surfaces, focus, motion, and status styles, an icon set, and the reusable assistant orb; verify accessible contrast.
  - Tokens and `surface-*`, `btn-*`, `field`, `notice-*`, `icon-well`, and `form-section` utilities live in `src/routes/layout.css`. Contrast was calculated for every text and control role against canvas, glass, selected, solid, and the brightest light field; a rendered measurement on devices remains part of the validation todo.
- [x] Build the mobile-first app shell with Home, Assistant, and Settings: bottom navigation with the center orb opening the text assistant, and a side-by-side layout on larger screens. Keep the active conversation, responses, and pending approvals intact when switching between Home and Assistant.
- [x] Redesign Home as a glanceable dashboard: greeting with optional display name, data-derived status sentence, assistant entry card, read-only light and climate summaries, and collapsible rooms with refresh and freshness states; retain favorites and existing entity behavior.
- [x] Add assistant shortcuts for scenes: a tile submits a visible request to the conversation and goes through the existing server-side confirmation; no new action endpoint.
- [x] Redesign the Assistant view: text chat, session selection, Markdown, tool status, and approval presentation; keep input accessible and preserve the existing server-side approval flow.
  - [x] Give desktop Assistant a prominent central orb when the conversation is empty and a compact header orb when it contains messages; preserve chat state, visible composer, and confirmation priority.
- [x] Apply the same design system to onboarding and Settings, including the optional display name, keeping credential notices, validation, connection testing, confirmation preferences, and reset safeguards visible and functional.
- [x] Specify the future voice screen and its listening, speaking, thinking, tool-use, confirmation, and error states; implement actual voice interaction only in M3.
  - Specified in [Design.md](./Design.md#future-voice-mode) from the plan and the user's UX workspace prototype: entry points, first use and microphone permission, exits, layout for mobile and desktop, ten states with real signals and priority rules, confirmation in voice, orb rendering, captions, accessibility, and a development-only state gallery. Open product decisions are listed in Design.md under Open Design Questions.
- [x] Validate against the reference and across mobile, tablet, and desktop layouts: keyboard and screen-reader access, reduced motion, zoom, touch targets, and existing chat, settings, history, and approval workflows using mocked services.
  - Automated in `e2e/design-acceptance.test.ts` (layout at ten sizes, 200% text, touch targets, Axe, rendered contrast, keyboard focus, reduced motion); results and coverage are in [Design.md](./Design.md#verification-status). Findings fixed on the way: form fields at 42 px, lost focus after a control hid its own view, horizontal scrolling at 200% text, and a weakly visible composer focus. Compared visually with the reference at 390 px and desktop; deliberate differences are listed in Design.md.
- [x] Device acceptance (user): check real iOS Safari and Android Chrome with the on-screen keyboard and safe areas, a pass with a real screen reader (VoiceOver, TalkBack, or NVDA), and smoothness on a mid-range phone. These are not covered by the automated tests; the keyboard is emulated by a short viewport.
  - Accepted by the user on 2026-11-24 after testing on their devices; the agent did not run this check itself.

## M3 - GPT-Live Full-Duplex MVP

M2a specifies the voice mode in [Design.md](./Design.md#future-voice-mode); M3 implements it inside the Assistant view. The product decisions for transcript retention, spoken confirmation, hidden tabs, tool routing, and voice samples are recorded in [Design.md](./Design.md#resolved-design-decisions).

- [x] Create trusted-server GPT-Live session provisioning.
  - `POST /api/live/session` validates a bounded SDP offer, configures the selected voice and backend model with `gpt-live-1.1` Responses delegation, and returns the OpenAI session ID and SDP answer without exposing the API key. Existing request guards enforce same-origin, rate, and body-size checks.
- [x] Implement browser WebRTC microphone/speaker/audio tracks.
  - The browser acquires and releases the microphone, negotiates SDP through the same-origin server endpoint, waits for `session.started`, plays remote audio, supports mute, and closes after `session.closed`. Startup cancellation, audio-level speaking state, and the 60-second hidden-tab timeout are covered with browser API fakes.
- [x] Add Live data-channel event handling.
  - Validates JSON event envelopes; groups input/output transcript deltas by speaker and session-timeline intervals, and tracks Responses delegation lifecycle.
- [x] Persist voice transcript turns to the active chat only when transcript retention is enabled; never persist audio.
- [x] Configure `gpt-live-1.1` separately from the backend reasoning model.
- [x] Configure Responses delegation for Live sessions; client delegation remains a later option.
- [x] Connect delegated MCP/Home Assistant tools.
  - `POST /api/live/session` registers the allowlisted MCP tools as Responses function tools (sequential calls). Without a reachable MCP server the session starts without tools and the backend is told so. MCP credentials never reach OpenAI.
- [x] Implement tool-result continuation and confirmation handling; show confirmations on the solid confirmation surface in voice mode.
  - The browser forwards each delegated call to `POST /api/live/tool`, returns the result as `function_call_output`, and sends `response.create` once the backend response has finished and every call has a result. Changes that need confirmation run only with a server-issued approval token bound to the session, call, tool, and arguments; denial, tampering, expiry, and reuse never execute. Verified with unit tests, a route test against the fake Home Assistant MCP server, and an end-to-end test of the stage.
- [ ] Deferred beyond M3 (user decision, 2026-11-24): spoken approval of a pending confirmation. Confirmations are answered on screen; users who want a more fluid conversation can relax the confirmation policy in Settings.
  - If taken up: decide how "unambiguous" is determined (for example an exact phrase list per language, matched against the user's transcript while the card is shown) and whether a spoken denial is accepted the same way.
- [x] Add interrupt/cancel/continue behavior.
  - Speaking over the assistant leaves delegated work running. Ending the session, leaving the stage, a lost connection, or the hidden-tab timeout abandons pending calls and confirmations; a change that was running or awaiting confirmation sets the text chat's "interrupted, outcome unknown" notice. `error` events no longer end the session; only `session.closed` or a lost connection does.
- [x] Build the voice stage first as a presentational component from fixed data, with a development-only state gallery that is excluded from production builds and component tests for every state in [Design.md](./Design.md#states-and-transitions); review it before connecting audio.
  - The user reviewed and approved the gallery on 2026-11-24. M3 decisions on transcript retention, hidden-tab timeout, spoken confirmation, app-function tools, and voice samples are recorded in [Design.md](./Design.md#resolved-design-decisions).
- [x] Build the voice mode screen: large orb, connection and microphone permission states, overlapping listening, speaking, and delegation states, tool activity, live captions, and error and reconnect states, each with a text equivalent and a reduced-motion variant.
  - The stage shows every state from real session signals, including tool activity, the confirmation card, a closing state, and non-fatal notices. A phone in landscape puts the orb beside the status and controls, short viewports shrink the orb, and reduced motion stops the stage's animations (checked in `e2e/voice.test.ts`). Back to text stays below the controls. The orb is still the static illustration; see the canvas todo.
- [x] Implement the first-use flow: a single setup screen with "Allow microphone" when permission or a key is missing, a clear blocked state when permission is denied, and text chat unaffected.
  - The stage reads the microphone permission when it opens: granted connects at once, undecided shows the setup screen with the privacy note, the voice, and a Settings link, refused shows "Microphone blocked" with "Try again". A missing key is known only to the server and appears as "Could not connect" with the server's message.
- [x] Make microphone muting disable the outgoing audio track and prove it with a test; keep the microphone indicator visible in every state.
- [x] Implement stage focus management: focus moves to the primary control on open and returns to the opener on close; a pending confirmation gets an announcement and a focusable card with neither button preselected.
  - The card takes focus and is named and described by its title and summary; the assistant is told to announce the wait. Focus returns to whichever control opened the stage (navigation orb, Home card, or header button) and to the Assistant view when that control is no longer visible.
- [ ] Render the orb states on canvas with a static SVG fallback for reduced motion; drive motion only from real audio levels and session state.
- [x] Switch the assistant entry points to voice once it works: microphone glyph and voice hint on the navigation orb and a voice offer in the Home entry card.
  - The navigation orb shows a microphone, is named "Start voice mode", and opens the stage; the Home entry card offers Talk and Type. While a text response or confirmation is pending, the orb and Talk open the conversation instead. There is no separate visible hint line above the bar.
- [x] Keep text chat as fallback, reachable in the same Assistant view with a visible switch between voice and text.
  - The Assistant header has a Voice button; the stage has Back to text and Escape. The chat stays mounted and inert behind the stage.
- [x] Add GPT-Live integration tests with mocked MCP/Home Assistant services and component tests for the voice states.
  - `e2e/voice.test.ts` drives the stage against the real application server and the fake Home Assistant MCP server, with OpenAI, the microphone, and WebRTC faked.
- [x] Verify one real GPT-Live session end to end (user-owned: needs an OpenAI key with GPT-Live access, a microphone, and a test Home Assistant).
  - Event names, the function-call continuation, and the spoken confirmation announcement follow the documentation and have only run against fakes.
  - 2026-11-24, user: a spoken conversation works in Chrome after three fixes found by this run (the trimmed SDP offer, unbound window functions, and the track order). Tool calls and confirmations in a real session are not yet reported.
  - 2026-11-24, user: Firefox works as well, including a delegated backend response. It started working after the microphone was requested with explicit gain control and the user was asked to check the input device; which of the two made the difference is not known.
  - 2026-11-24, user: tool calls work against the real service; lights and scenes on the user's Home Assistant were controlled by voice.
  - 2026-11-24, user: the confirmation card appears and both Approve and Deny work against the real service.

## M3a - Voice-First Refinement

Planned with the user on 2026-11-25; not started. The product is voice first: speaking is the default way to use the assistant, and text is the record of the conversation and the fallback. Text and voice are one conversation with two ways of input, so nothing "goes back to text": a voice conversation ends, and the text view underneath shows what was said. The design is described in [Design.md](./Design.md#m3a-voice-first).

User decisions:

- The transcript of a voice conversation is always part of the chat. The transcript-retention setting is removed; voice turns are stored like typed messages while chat history is on.
- Voice turns appear in the chat turn by turn during the conversation, not only at its end.
- A voice session knows the recent messages of the current conversation.
- Ending a conversation leaves voice mode and always shows the text view with the transcript, wherever voice was started.
- A conversation ends by itself after 60 seconds without speech from either side.
- Home stays the start view and the orb is the main action. Voice does not start by itself when the app opens.
- Voice behaves the same on every screen size: starting, ending, and the transcript in the chat work on tablet and desktop as on a phone. The stage stays a modal view over the whole app, full screen on a phone and a centered panel over the dimmed app on larger screens; it does not move into the Assistant panel.
- A conversation is never ended by voice. It ends through End, Escape, or one of the automatic ends.
- The tool calls of a voice conversation appear in the chat as cards, as they do in a typed conversation.
- The voice is chosen from a described list instead of typed (user decision, 2026-11-25): what matters is the information per voice, as in the OpenAI Playground: its character (for example "Warm and conversational"), language, regional influence, and whether it sounds feminine or masculine. The look of the Playground is not the model.
- The list offers only the voices that OpenAI documents as natural voices; generated voices are left out. Nothing else can be chosen: there is no field for typing a voice ID, and a stored voice that is not in the list is replaced by the default. The default voice becomes Gleam (`gleam`) instead of `marin`, which OpenAI's documentation does not classify.

Todos:

- [ ] Make the transcript standard: remove `history.retainTranscripts` from the settings schema, onboarding, and Settings, and ignore a stored value. Voice turns join the chat in every conversation and are saved with it while chat history is on.
- [ ] Write voice turns into the chat turn by turn: the session reports each turn as it forms and grows, and the chat inserts or updates one message per turn in spoken order, so that a closed or crashed tab loses nothing.
  - The provider sends fragments without turn boundaries, so a turn can still grow after it first appears in the chat.
- [ ] Mark spoken messages in the chat with a small microphone symbol and an accessible label, and store the marker with the message.
- [ ] Give a new voice session the recent text of the current conversation (`session.input`; text only, limited in count and size, validated by the server).
- [ ] End means leave: remove "Back to text" and the Ready state with "Start conversation". During a conversation the controls are the microphone and End; End and Escape end the session and close the stage. The setup, blocked, and error screens offer Close instead.
  - Speech never ends a conversation. The Live instructions say that the assistant cannot end it, so that it does not claim to have done so and points to End when asked.
- [ ] After a conversation ends, show the text view with the transcript on every screen size, on a phone also when voice was started from Home. Move focus to the Assistant's voice control, not into the message field, so that no on-screen keyboard opens.
- [ ] End a conversation after 60 seconds without speech from either side, then leave to the text view with a notice that says why. Time does not count while delegated work runs or a confirmation is waiting; settle during implementation how long a waiting confirmation may keep a session open.
- [ ] Treat the hidden-tab timeout and the session's time limit like the idle end: leave to the text view with a notice. A failed or lost connection keeps the stage open with "Try again" and "Close".
- [ ] Make voice the primary action in the text view: a microphone control at the composer, and the orb of the empty Assistant as a "tap to talk" control; the separate Voice button in the header goes away. Voice stays unavailable while a text response or confirmation is pending.
- [ ] Show the tool calls of a voice conversation in the chat with the card of the text mode (`ToolCallCard`): reads and changes, each at the place in the conversation where it happened, with its summary, status, and result. The card appears when the call starts, is updated when it settles, and is stored with the chat like the cards of a typed conversation.
- [ ] Keep confirmations on the stage: in the chat, the card of a change that waits for confirmation shows the waiting state without Approve and Deny, and then the outcome (done, failed, or not executed). A call that was still running or waiting when the conversation ended or the tab closed shows as interrupted with an unknown outcome, also after a reload, and never as running or confirmable.
- [ ] Keep typed messages working after a voice conversation: the text endpoint accepts a chat that contains voice cards, and nothing in a stored card can be executed or approved again. Settle during implementation whether the text model receives these cards as tool calls with results or only the spoken text.
- [ ] Add a voice catalog to the application with the natural GPT-Live voices only: for each voice its name, API name, character line, language, regional influence, and presentation (feminine or masculine). Take every value from OpenAI's documentation or Playground and record the source and date; never invent a description. A voice without a known character line shows none. The catalog replaces `VOICE_SUGGESTIONS`.
  - Known on 2026-11-25: the Live documentation lists 28 voices, 24 of them natural (all except Quartz, Beacon, Delta, and Cinder), with language, regional influence, and presentation. Character lines are known for seven of the 24 from the user's Playground screenshot (Gleam, Ripple, Vesper, Willow, Stone, Meridian, Bossa); the other 17 still have to be collected. The older voices such as `marin` are not classified in the documentation and stay out until OpenAI lists them as natural.
- [ ] Replace the free-text voice field in onboarding and Settings with a voice picker built on the catalog: one entry per voice with its name, character line, language, regional influence, and presentation; the current voice is marked. Offer a search by name and filters for language and presentation. It is a single-choice control that works with the keyboard and a screen reader, has touch targets of at least 44 px, and fits a 320 px screen.
- [ ] Allow only voices of the catalog: change the default voice from `marin` to `gleam`, replace a stored voice that is not in the catalog with the default when settings are loaded, and let the settings schema and the Live session endpoint accept only catalog voices. A newly released voice becomes available by adding it to the catalog.
- [ ] Show the chosen voice by name and character line wherever the voice is mentioned, for example on the stage's first-use screen.
- [ ] Update the wording that depends on these decisions: the first-use note on the stage, the storage notices, `README.md`, and the data rules in `AGENTS.md` that require explicit consent for voice transcripts.
- [ ] Tests: turn-by-turn chat updates and their order, removal of the setting, context seeding and its limits, leaving on End, idle and hidden-tab ends with their notices, focus after leaving, the end-to-end voice flows without "Back to text" at phone and desktop size, the voice picker (choosing, searching, filtering, keyboard use, a stored voice outside the catalog falling back to the default, and the session endpoint rejecting such a voice), and the cards of voice tool calls (order, each outcome, no Approve or Deny in the chat, interrupted calls after a reload, and a typed message after a voice conversation).
- [ ] Verify with the real service (user-owned): the transcript and the action cards in the chat after a conversation, the 60-second idle end, and a spoken follow-up that refers to an earlier typed message.

Not in M3a: typing during a voice conversation, and playing a sample of a voice in the picker (not needed for now; every preview would use the provider). Decided against, not only postponed: ending a conversation by voice, and voice inside the Assistant panel on desktop.

## M4 - Smart-Home Dashboard

M2a delivers the Home layout, read-only summaries, rooms, and assistant shortcuts. M4 adds live data and direct control within that design; see [Design.md](./Design.md#design-requirements-for-later-milestones).

- [ ] Add favorite entities and show them on Home; areas and favorite areas already exist.
- [ ] Add live entity state updates; replace Home's fetch time and manual refresh with a live status indicator, and fall back visibly to the last fetched state when the connection drops.
- [ ] Add a server-side path for direct device actions outside the conversation that enforces the same tool allowlist and confirmation policy.
- [ ] Add quick actions on Home: the Lights switch, one-tap scenes, and device controls in rooms, with a confirmation sheet for actions that require it and a pending state until the result is known.
  - Open decision: whether scene tiles become direct actions or remain assistant shortcuts.
- [ ] Add action history as the Activity view behind the Home header button; M2a provides only the indicator.
- [x] Add voice, model, confirmation, and MCP settings. (Delivered with the M1 Settings flow; restyled in M2a.)
- [ ] Validate the new dashboard features against Design.md for responsive layout and accessibility; M2a covers the base layout.

## M5 - Public-Internet Hardening

- [ ] Move secrets out of Browser Storage to server-side provisioning; update onboarding, Settings, and the storage notices to match.
- [ ] Use server-side sessions and ownership checks; add login and session-expiry screens in the shared design system.
- [ ] Restrict CORS and allowed MCP origins.
- [ ] Add tool/entity allowlists.
- [ ] Add audit logs with secret redaction.
- [ ] Add confirmation/denial and authorization bypass tests covering the conversation, assistant shortcuts, quick actions, and voice.
- [ ] Review voice/transcript retention, including live captions in voice mode.
- [ ] Set a Content Security Policy that fits the design's self-hosted font and icons and allows no third-party asset requests.
- [ ] Configure deployment and verify HTTPS.
