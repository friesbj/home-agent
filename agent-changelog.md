# Agent Changelog

This file records implementation and repository changes made by agents. Entries are append-only and ordered newest first.

## 2026-11-26

### 2026-11-26T20:18:00+01:00

- **M3a checkpoint:** recorded the outstanding abrupt-reload handling for running voice action cards in `Milestones.md`; M3a remains in progress.
- **Validation:** `npm run check` passed; `npx vitest run` passed 180 tests; `npx playwright test e2e/chat-history.test.ts e2e/voice.test.ts` passed 14 tests; `npx eslint .` passed.

## 2026-11-25

### 2026-11-25T12:09:00+01:00

- **M3a — always-on chat history:** removed the history switch and persistence guards, ignored legacy disabled settings, retained explicit deletion, and updated onboarding, voice-stage, Settings, README, design, and project data notices. Voice read cards now have a nonempty snapshot text so they survive reload. A browser test verifies legacy migration, reload and deletion while retaining credentials; the voice flow verifies restored transcripts and cards.
- **M3a work in progress:** isolated transcript turn IDs by Live session, bounded each context message to the server's 4,096-character limit, preserved other settings when a stored voice is unsupported, and began automatic-end notices and idle-timer corrections. These automatic-end changes still need broader M3a validation.
- **Validation:** `npm run check` passed; targeted Vitest 59 passed; `npx playwright test e2e/chat-history.test.ts e2e/voice.test.ts` 14 passed; ESLint passed on the affected source and tests.

### 2026-11-25T11:40:00+01:00

- **M3a fix — voice action cards match the text mode:** voice tool calls previously showed raw JSON. Extracted a shared presentational `ToolActionCard.svelte` and `tool-output.ts` formatter; both the text-mode `ToolCallCard` and the chat's voice action cards now render the same badge, mono tool name, status, and a collapsible "Show result" with pretty-printed JSON. Added `label` to `LiveToolCard`.
- **Changed:** `src/lib/components/ToolActionCard.svelte` (new), `src/lib/home/tool-output.ts` (new), `src/lib/components/ToolCallCard.svelte`, `src/lib/components/ChatPanel.svelte`, `src/lib/live/tool-calls.ts`, `src/lib/home/chat-history.ts`, `e2e/voice.test.ts`.
- **Validation:** `npm run check` 0 errors; full Vitest 178 passed; voice e2e 3 passed.

### 2026-11-25T11:00:00+01:00

- **M3a implementation — action cards and natural voice catalog:** the Live tool coordinator publishes serializable action cards; ChatPanel stores/upserts them and shows status without approval controls. Settings replaces the free-text voice field with a catalog-based picker for 24 natural voices; Gleam is the default and the stage shows name and character line.
- **Validation:** full Vitest 178 passed; voice e2e 3 passed; `npm run check` 0 errors.

### 2026-11-25T09:46:00+01:00

- **M3a implementation — live turns and context:** voice transcript turns are published while fragments grow, upserted by stable turn ID in the active chat, and marked as voice messages. The live session request now seeds `session.input` from the newest text messages.
- **Changed:** `src/lib/live/events.ts`, `src/lib/live/live-session.ts`, `src/lib/live/protocol.ts`, `src/lib/server/live/session.ts`, `src/lib/home/chat-history.ts`, `src/lib/home/chat-session.svelte.ts`, `src/lib/components/ChatPanel.svelte`, and focused specs.
- **Validation:** `npm run check` 0 errors; full Vitest 177 passed; voice e2e 3 passed.
- **Milestone:** M3a - live turn updates, voice markers, and session context.

### 2026-11-25T09:24:00+01:00

- **M3a implementation — End means leave:** removed the Ready state and Back-to-text control from the VoiceStage. End, Escape, setup/error Close, and the page close action now leave immediately to the text view.
- **Changed:** `src/lib/live/live-session.ts` gained `leave()` to stop and detach the microphone synchronously while provider shutdown continues; `+page.svelte` calls it before starting the async session close. Updated VoiceStage, gallery, unit/component tests, and voice e2e expectations.
- **Validation:** `npm run check` 0 errors; Live controller tests 21 passed; VoiceStage component tests 17 passed; voice e2e 3 passed.
- **Milestone:** M3a - End means leave.

### 2026-11-25T09:14:00+01:00

- **M3a implementation — transcript standard:** removed `history.retainTranscripts` from the settings schema and Settings UI. A stored value is ignored by Zod parsing. `appendVoiceTranscript` now appends voice turns whenever chat history is enabled, and the VoiceStage first-use copy documents that behavior.
- **Changed:** `src/lib/config/settings.ts`, `src/lib/components/SettingsForm.svelte`, `src/lib/home/chat-session.svelte.ts`, `src/lib/components/VoiceStage.svelte`, `e2e/voice.test.ts`, `README.md`, `Milestones.md`, and settings/component tests.
- **Validation:** `npm run check` 0 errors; settings/live unit tests 30 passed; Settings/Voice component tests 22 passed; `npx playwright test e2e/voice.test.ts` 3 passed.
- **Milestone:** M3a - Make voice transcripts standard.

### 2026-11-25T08:55:00+01:00

- **Changed:** finalized M3 by rendering the voice-stage orb on canvas.
  - New `src/lib/live/orb-visual.ts`: pure motion model (`orbFrame`, `orbAnimates`); listening and speaking scale pulse and glow with the audio level, connecting and thinking rotate with time, other states are still.
  - New `src/lib/components/AssistantOrbCanvas.svelte`: draws the moving aura over the static `AssistantOrb` sphere; stays blank under reduced motion or without a 2D context, so the SVG sphere is the fallback.
  - `src/lib/live/live-session.ts`: the measure loop tracks the loud side of the conversation as a smoothed `audioLevel` getter, reset with the session.
  - `src/lib/components/VoiceStage.svelte`: uses the canvas orb with a `getLevel` prop and drops the CSS keyframes for the connecting, listening, speaking, and thinking states (static state transforms kept).
  - `src/routes/+page.svelte`: passes `getLevel={() => liveSession.audioLevel}`.
- **Tests:** `orb-visual.spec.ts` (motion maths), `AssistantOrbCanvas.svelte.spec.ts` (canvas over the SVG), and a controller test that `audioLevel` rises with sound and decays in silence.
- **Validation:** `npm run check` 0 errors; `npx vitest run` 174 passed; `npx playwright test e2e/voice.test.ts` 3 passed (including the reduced-motion check of 0 running CSS animations); `npx eslint .` clean; Prettier clean on the changed files.
- **Milestone:** M3 - Render the orb states on canvas.

### 2026-11-25T08:45:00+01:00

- **Planning (M3a, scope revised by the user):** added the tool calls of a voice conversation as cards in the chat (three todos), the same voice behavior on every screen size, and the rule that a conversation is never ended by voice; rewrote the "Not in M3a" line. Changed `Milestones.md`, `Design.md`, `AGENTS.md`, and `agent-knowledge.md`. No source code changed.
- **Validation:** documentation only; Prettier passes on the changed files.

### 2026-11-25T08:35:00+01:00

- **Planning (M3a):** added the milestone "M3a - Voice-First Refinement" to `Milestones.md` with the user's decisions and its todos, the section "M3a: Voice First" to `Design.md`, the planned decisions and "Phase 3a" to `AGENTS.md`, and an entry in `agent-knowledge.md`. No source code changed.
- **Planning (M3a, voice picker):** added the user's request for a described voice list instead of the typed voice name: a voice catalog, the picker with search and filters, and handling of voices outside the catalog, in the same four files.
- **Planning (M3a, natural voices only):** narrowed the voice picker after the user's decisions: the catalog holds only the voices OpenAI documents as natural, the default changes from `marin` to `gleam`, and the list is closed (no typed ID, no "Other voice"; a stored voice outside the catalog falls back to the default). Updated `Milestones.md`, `Design.md`, `AGENTS.md`, and `agent-knowledge.md`.
- **Validation:** documentation only; Prettier passes on the changed files.

### 2026-11-25T00:15:00+01:00

- **M3 voice stage (`src/lib/components/VoiceStage.svelte`, `src/routes/+page.svelte`):** captions are hidden by default. The "Captions" heading is gone; a small "Show captions" / "Hide captions" text control toggles them during a conversation, and the page remembers the choice while it is open.
- **Docs and tests:** `Design.md` records the decision; the component test and `e2e/voice.test.ts` expect captions only after "Show captions".
- **Validation:** `npm run check`, `npx vitest run` (165/165), `npx eslint .`, and `npm run test:e2e` (40/40) pass; screenshots of the stage with captions hidden and shown were reviewed.

## 2026-11-24

### 2026-11-24T23:55:00+01:00

- **M3 first use (`src/lib/live/live-session.ts`, `src/lib/components/VoiceStage.svelte`):** the stage checks the microphone permission on opening and connects at once, shows a setup screen (privacy note, voice, Settings link, "Allow microphone"), or shows "Microphone blocked" with "Try again". Start failures are titled "Could not connect"; a missing microphone has its own message.
- **M3 entry points (`src/routes/+page.svelte`, `src/lib/components/HomeView.svelte`):** the navigation orb shows a microphone and starts voice mode; the Home entry card offers Talk and Type; focus returns to the control that opened the stage. Voice entry points open the text conversation while it is busy or awaiting approval.
- **M3 stage layout:** landscape phone layout with the orb beside the controls, a smaller orb on short viewports, no stage animation with reduced motion, full-width single-button control rows.
- **Decisions recorded:** spoken approval deferred; real-service verification complete (`AGENTS.md`, `Design.md`, `Milestones.md`).
- **Tests:** controller tests for `prepare()`, refused versus dismissed permission, and failed starts; `VoiceStage` tests for the setup and blocked screens; `e2e/voice.test.ts` covers auto-connect with a granted permission, the first-use screen, reduced motion, focus return to the orb, and the landscape layout; existing end-to-end tests open the text Assistant through Type.
- **Validation:** `npm run check`, `npx vitest run` (165/165), `npx eslint .`, and `npm run test:e2e` (40/40, Chromium, includes the build) pass. Screenshots of Home, the first-use screen, and the landscape stage were reviewed. `npm run lint` still fails on Prettier warnings in files this work did not touch. The canvas orb remains.

### 2026-11-24T23:32:00+01:00

- **Docs:** `Milestones.md` and `agent-knowledge.md` record the user's report that voice tool calls control lights and scenes on a real Home Assistant, and that the confirmation and denial paths still lack a real-service report. No code changed.

### 2026-11-24T23:30:00+01:00

- **Docs:** `Milestones.md` and `agent-knowledge.md` record that voice conversations now work in Chrome and Firefox against the real service (user report), the event sequence seen there, and that real tool calls and confirmations remain unverified. Corrected a code comment in `src/lib/live/live-session.ts` that named the byte rate as a speech indicator; the user's measurements show it is not one.
- **Validation:** comment and documentation only; Prettier and ESLint pass on the changed files.

### 2026-11-24T23:22:00+01:00

- **M3 (`src/lib/live/live-session.ts`, `src/lib/live/audio-level.ts`):** the microphone is requested with explicit echo cancellation, noise suppression, and automatic gain control; level meters read float samples instead of 8-bit samples; the microphone hint now reads "Little or no sound is arriving from your microphone"; the development console reports the microphone's peak level and the bytes sent every 3 seconds. Removed the unused `isAudioActive`.
- **Reason:** the user's Firefox console showed a correct media negotiation but a microphone level at the noise floor and silence-sized packets.
- **Validation:** `npm run check`, `npx vitest run` (160/160), `npx eslint .`, and `npm run test:e2e` (39/39, Chromium) pass; the voice test without the Axe audit also passes in Playwright's Firefox. Whether Firefox now recognizes speech is with the user.

### 2026-11-24T23:12:00+01:00

- **Fix (M3):** the Speaking state holds for 0.8 seconds after the last measured sound (`src/lib/live/live-session.ts`), and `VoiceStage` reserves the height of the overlapping-state chips; in a real Chrome conversation the status flipped between Speaking and Listening and the stage jumped.
- **Diagnostics:** development console lines for the offer's and answer's media sections and the microphone track state, for the open Firefox problem.
- **Docs:** `Milestones.md` records the user's Chrome result and the blocked Firefox verification; `Design.md` records the hold rule.
- **Validation:** `npm run check`, `npx vitest run` (160/160), `npx eslint .`, and `npm run test:e2e` (39/39, Chromium) pass. Ad hoc in Playwright's Firefox, one voice test passes and the other runs through the confirmation and then fails when the Axe audit crashes the page.

### 2026-11-24T22:55:00+01:00

- **M3 (`src/lib/live/live-session.ts`):** the microphone track is added before the data channel, as in the provider's sample. Added a microphone level meter with a "no sound from your microphone" hint, shared with the output meter, and development-only console diagnostics (event types, error details, transport statistics). Non-fatal notices include the provider's error code.
- **Tests:** `e2e/voice.test.ts` now uses real audio streams for the microphone and the assistant and covers the microphone hint; controller tests cover the hint and the track order.
- **Validation:** `npm run check`, `npx vitest run` (160/160), `npx eslint .`, and `npm run test:e2e` (39/39) pass. Whether speech is now recognized by the real service is unconfirmed.

### 2026-11-24T22:45:00+01:00

- **Fix (M3):** `src/lib/live/live-session.ts` wraps `fetch`, `requestAnimationFrame`, and `cancelAnimationFrame` in arrow functions; the bare references threw "Illegal invocation" in the browser and ended the session when the assistant's audio track arrived (user report: "Audio level monitoring is unavailable"). A failing level meter no longer ends the session, and channel errors during shutdown are ignored.
- **Tests:** `e2e/voice.test.ts` reproduced the failure once its fake peer delivered a real audio stream, and now asserts the Speaking state from that stream's level. Added a controller test for an unavailable level meter.
- **Validation:** `npm run check`, `npx vitest run` (159/159), `npx eslint .`, and `npm run test:e2e` (39/39) pass. Confirmation with the real service is with the user.

### 2026-11-24T22:35:00+01:00

- **Fix (M3):** `src/lib/live/protocol.ts` no longer trims the SDP offer, which removed its final line ending before it was forwarded to OpenAI. Found after the user's first real connection attempt returned HTTP 400.
- **Diagnostics:** `src/lib/server/live/session.ts` reads the provider's error type, code, field, and message (key-scrubbed, truncated; none for 401/403); `POST /api/live/session` logs them with the backend model, voice, and tool count and tells the browser which setting was rejected.
- **Validation:** `npm run check`, the Live unit and route specs (52/52), and targeted ESLint pass. The fix is not yet confirmed against the real service.

### 2026-11-24T22:20:00+01:00

- **M3 review fixes (`src/lib/live/live-session.ts`):** Live `error` events no longer end the session; repeated `end()` calls share one shutdown instead of leaving a timer that could tear down a later session; ending disables the microphone track immediately; a late microphone stream from a cancelled start can no longer replace the current one; the remote-track handler no longer throws after a failure. Captions show the latest turn per speaker instead of the whole session. The controller now takes an options object.
- **M3 tool bridge:** Added `src/lib/server/live/tools.ts` and `POST /api/live/tool` (authorization, HMAC approval tokens, execution through the MCP gateway), `toolDefinitions`/`callTool` on the gateway, function-tool registration in `POST /api/live/session`, and `src/lib/live/tool-calls.ts` for the browser-side continuation. The stage shows tool activity and the confirmation card with Approve/Deny; the card takes focus. Ending a session with a pending change sets the chat's interrupted notice.
- **UI:** `VoiceStage` gained a closing state, a non-fatal notice, and an optional affected-device count; the Voice button is disabled while the text chat is busy. The Settings label for transcript retention no longer says "planned", and retention also requires text history to be on.
- **Tests:** new `tool-calls.spec.ts`, `tools.spec.ts`, `src/routes/api/live/tool.spec.ts` (fake Home Assistant MCP server), and `e2e/voice.test.ts` (real server, fake MCP, faked OpenAI/WebRTC/microphone, Axe audit of the stage); extended controller, events, gateway, session-route, and `VoiceStage` specs. Six deliberate regressions in approval checking, denial precedence, single use, continuation, shared shutdown, and error handling were each caught by a test.
- **Docs:** `AGENTS.md`, `README.md`, `Design.md`, and `Milestones.md` describe the tool bridge, the interruption policy, and the remaining M3 work.
- **Validation:** `npm run check` (0 errors, 0 warnings), `npx vitest run` (156/156 in 26 files), `npx eslint .`, Prettier on all changed files, `npm run build`, and `npm run test:e2e` (39/39) pass. `npm run lint` still fails on Prettier warnings in files this work did not touch. No real OpenAI session, microphone, or Home Assistant instance was used; the GPT-Live event flow is implemented from the documentation.

### 2026-11-24T21:40:00+01:00

- **M3 browser Live connection:** Added browser WebRTC setup, microphone mute/release, remote audio playback, event-channel parsing, delegation status, output-audio activity detection, cancellation handling, and automatic close after 60 seconds in a hidden tab. Text chat remains mounted beneath the voice dialog.
- **Transcript retention:** Voice transcript turns are appended to the active chat only when `history.retainTranscripts` is enabled; transcript text is cleared when the session ends and audio is never persisted. Returning to text restores focus to the Voice opener.
- **Endpoint and controller tests:** Added fake-browser lifecycle and hidden-tab tests, transcript aggregation/persistence checks, and endpoint response, credential isolation, and invalid-offer tests. No real provider, microphone, or Home Assistant service was used.
- **Validation:** `npm run check`, full `npx vitest run` (127/127), `npx eslint .`, Prettier on all changed files, and `npm run build` pass. `npm run lint` remains blocked by Prettier warnings in 37 unchanged repository files. Build output contains the existing Rollup annotation and adapter-auto environment warnings.

### 2026-11-24T21:06:00+01:00

- **M3 trusted session provisioning:** Added `POST /api/live/session` and a server-only OpenAI Live adapter. It validates a bounded SDP offer, uses the selected backend model and voice with `gpt-live-1.1` Responses delegation, applies the request timeout, validates the session ID/SDP answer, and never returns or logs API credentials or raw provider errors. Existing hooks provide same-origin, body-size, and rate-limit guards. Added focused tests for SDP validation, independent model configuration, credential isolation, provider errors, and malformed responses.
- **Documentation:** Recorded the documented `/v1/live/sessions` unified WebRTC exchange and updated M3 progress; prior product decisions are no longer listed as open.
- **Validation:** `npm run check`, `npx vitest run src/lib/server/live/session.spec.ts` (4/4), targeted ESLint, Prettier, and `npm run build` pass. The build reports the existing Rollup annotation and adapter-auto environment warnings. No real OpenAI session, microphone, or Home Assistant action was used.

### 2026-11-24T20:54:41+01:00

- **M3 start — presentation-only voice stage:** Added `VoiceStage.svelte` with ready, permission, connecting, listening, speaking, delegation/tool, confirmation, muted, and error samples. It supports concurrent status chips, hidden captions, read/change activity, and a solid confirmation card; controls are inert without callbacks. Added `/dev/voice-states`, gated to development; the gallery and sample-state copy are absent from the production client bundle. No microphone, audio, OpenAI, or Home Assistant calls are made.
- **Documentation alignment:** Reviewed the current [GPT-Live guide](https://developers.openai.com/api/docs/guides/live), WebRTC, delegation, and session-management docs plus OpenAI Live Console. Updated `AGENTS.md` from ephemeral credentials to the documented server SDP offer/answer exchange and `session.started` flow. The sample targets `gpt-live-1`, not the planned `gpt-live-1.1`, and uses a fictional read-only catalog.
- **Validation:** `npm run check` (0 errors/warnings), `npx vitest run src/lib/components/VoiceStage.svelte.spec.ts` (13/13), targeted ESLint, `npm run build`, and a production client-bundle scan confirming the gallery is absent. Inspected the development gallery in a browser using fake setup values, then reset that test data. The build passed with existing Rollup annotation and adapter-auto environment warnings. M3 remains in progress pending user review and the open voice decisions; audio integration has not started.

### 2026-11-24T20:27:06+01:00

- **M2a closed:** the user accepted the device acceptance (real iOS and Android browsers, on-screen keyboard, safe areas, screen reader, smoothness) on 2026-11-24, so the last open M2a todo is done. `Milestones.md` marks it `[x]` and notes that the agent did not run this check; `Design.md` no longer says the design is unimplemented or that voice specification and validation are open. Documentation only; no tests run.

### 2026-11-24T18:27:46+01:00

- **Favicon (user request):** replaced the default Svelte logo with the orb. `static/favicon.svg` is the source (simplified for 16 px: three outlines, six nodes, brighter sphere); `static/favicon.ico` (32 px PNG in an ICO container) and `static/apple-touch-icon.png` (180 px on `#0b142d`) were rendered from it with Playwright. `src/app.html` declares the icons and `theme-color`; the unused import in `+layout.svelte` and `src/lib/assets/favicon.svg` are removed. New E2E test in `e2e/onboarding.test.ts` checks that the icons are declared and served. `Design.md` documents it.
- **Validation:** `npm run check` (0 errors), ESLint on the test, full `npx playwright test` (37/37). Inspected the icon at 16, 32, 64, and 180 px.

### 2026-11-24T18:09:24+01:00

- **M2a finalization:** Specified the voice mode and validated the design against measured criteria.
  - `Design.md`: rewrote "Future Voice Mode" from the plan and the user's UX workspace prototype (entry points and first use, exits, layout for mobile and desktop, ten states with real signals and priority rules, confirmation in voice, canvas orb rendering, captions and transcripts, accessibility, development-only state gallery), updated the outdated Navigation text, added "Open Design Questions", "Verification Status", and the decisions below. `Milestones.md`: M2a voice specification and validation done; M3 gained the stage-first, first-use, mute, focus, and canvas-orb todos; added a user-owned device acceptance todo. `AGENTS.md`: testing strategy line.
  - New `e2e/design-acceptance.test.ts` (21 tests): layout at ten sizes, 200% text, touch targets, Axe WCAG 2.x A/AA audit, rendered contrast measured on screenshots with the text hidden, keyboard focus, reduced motion. New dev dependency `@axe-core/playwright`.
  - Fixes the checks found: `.field` had no 44 px minimum height (inputs were 42 px); a control that hid its own view dropped focus to the body, so `+page.svelte` now focuses the composer (entry card) or the Assistant view (shortcuts); horizontal scrolling at 200% text, fixed with `overflow-wrap: anywhere` on the shell, `min-width: 0` on fieldsets, and wrapping rows in `HomeView` and the `ChatPanel` header; the composer's textarea now fills the whole field and the field draws the 3 px focus ring.
  - `playwright.config.ts` raises `RATE_LIMIT_MAX_REQUESTS` for the E2E server, because parallel tests share its 30-requests-per-minute limiter.
- **Validation:** `npm run check` (0 errors), `npx eslint .` (clean), `npx vitest run` (90/90), `npx playwright test` (36/36). Mutation check: a weak secondary text color makes both the Axe audit and the contrast measurement fail. Inspected Home, Assistant with a pending confirmation, and Settings at 390 px and Home at 1280 px. Real devices, real screen readers, and the on-screen keyboard are not automated; see `Milestones.md`.

### 2026-11-24T11:00:00+00:00

- **Scrollbars (user request):** `layout.css` defines slim 6 px scrollbars with a transparent track and a translucent violet thumb for all scroll areas (page, Home column, chat list, code and tables). Chromium and Safari use `::-webkit-scrollbar` (without arrow buttons); Firefox uses `scrollbar-width: thin` and `scrollbar-color` via `@supports not selector(::-webkit-scrollbar)`. `Design.md` documents it.

### 2026-11-24T10:30:00+00:00

- **M2a mobile polish (user request):** On mobile, the Assistant view uses the full screen width without card border, and the page header becomes a transparent Home icon overlay. The composer in `ChatPanel.svelte` is a single field with the round Send/Stop button inside it, growing with its text up to about 160 px (all breakpoints). The mobile navigation bar is icon-only (accessible names unchanged), the orb keeps its size. `Design.md` documents the composer.
- **Validation:** `npm run check`, ESLint on both files, and the home and chat-history E2E suites (14/14). Inspected at 390 px and 1280x900.

### 2026-11-24T00:15:00+01:00

- **M2a composer (user request):** Send and Stop in `ChatPanel.svelte` are now round, icon-only 44 px buttons with `aria-label` and `title` set to "Send" and "Stop"; Stop uses a filled square. `Design.md` documents the pattern.
- **Validation:** `npm run check`, ESLint on the component, and the chat-history and home E2E suites (14/14). Inspected the composer at 390 px and 1280×720.

### 2026-11-24T00:05:57+01:00

- **M2a minimal settings (user request):** `SettingsForm.svelte` now shows only "Connect your home": server address, access token, OpenAI API key, "Test connection", and a summary of the active confirmation rule, with a warning icon when confirmations are off. All other options moved unchanged into a collapsed "Advanced settings" disclosure, which opens and focuses the field when it contains a validation error. The access-token field has the visible label "Access token", empty secret fields no longer show "Not stored.", and the address hint is shorter.
- **Defaults:** `settings.ts` defaults `mcp.authType` to `bearer` for new setups; existing stored settings keep their value.
- **Pages:** onboarding has a shorter intro, `StorageNotice` is condensed but keeps every required statement, and Settings groups stored credentials, history deletion, and reset in a collapsed "Data and privacy" disclosure. Added the `form-group` utility in `layout.css`.
- **Tests:** E2E tests and component specs use the new labels and open the disclosures where needed. Onboarding asserts three visible inputs and the required token. A new component test checks that hidden errors open Advanced settings.
- **Validation:** `npm run check` (0 errors), `npx eslint .`, `npx vitest run` (90/90), the full `npx playwright test` (15/15), and a targeted E2E rerun after the last text change (4/4). Onboarding inspected at 390 px.

## 2026-11-23

### 2026-11-23T23:46:41+01:00

- **M2a implementation:** Completed the design foundation, Home dashboard, scene shortcuts, Assistant redesign with the desktop orb, and the onboarding and Settings restyle.
  - `layout.css`: semantic color, radius, and easing tokens plus `surface-glass`, `surface-selected`, `surface-solid`, `surface-bar`, `icon-well`, `btn` variants, `field`, `notice` variants, and `form-section`; dark checkbox and radio styles; a reduced-motion override. The ambient shell moved to `+layout.svelte`, so every route shares it.
  - `AssistantOrb.svelte`: `header`, `nav`, `card`, and `hero` sizes and an optional slow rotation and breathing animation, static under reduced motion.
  - New `HomeView.svelte` (greeting, status, refresh, entry card, summaries, scenes, rooms), `DomainIcon.svelte`, and `src/lib/home/summary.ts` with unit tests; `HomeOverview.svelte` became the presentational `RoomList.svelte` with a domain filter. Scenes and scripts no longer show "unknown" as unavailable.
  - `chat-session.svelte.ts`: `switching`, `busy`, `awaitingApproval`, `shortcutBlockedReason`, and `submitShortcut()`; `ChatPanel` uses the shared `switching` state. Typed messages behave as before.
  - `ChatPanel`, `MarkdownMessage`, and `ToolCallCard` restyled; visible texts and accessible names are unchanged.
  - `settings.ts`: optional `profile.displayName` (max. 40), editable in a new Profile section of `SettingsForm`; older stored settings still load.
  - Onboarding, Settings, and `StorageNotice` restyled; Settings has a separate "Delete and reset" section.
  - The fake MCP server exposes a climate reading and a "Movie Night" scene for tests.
- **Tests:** added `summary.spec.ts`, a profile compatibility test in `settings.spec.ts`, HomeView component tests (greeting, filter, scene shortcut and disabled state), and an E2E test that a scene shortcut sends a visible request through the confirmation flow and blocks further shortcuts while pending.
- **Validation:** `npm run check` (0 errors), `npx eslint .` (clean), Prettier on all changed code files, `npx vitest run` (89/89), and two full `npx playwright test` runs (15/15 each). Inspected Home, Assistant with a pending confirmation, onboarding, and Settings at 390 px and 1280×720 with mocked services. The voice screen specification and the cross-device validation todo remain open.

### 2026-11-23T23:18:37+01:00

- **Test stabilization:** The cross-tab test in `e2e/chat-history.test.ts` was flaky under parallel runs, also on `main` (3/3 full runs failed there). Its storage snapshot could precede the other tab's write. It now waits for that write before snapshotting; the asserted behavior is unchanged.
- **Readiness check:** `npm run check` (0 errors), `npx eslint .` (clean), `npx vitest run` (80/80), and three full `npx playwright test` runs (14/14 each) passed. `npx prettier --check .` reports 19 files, all also failing on `main` because of CRLF working-tree line endings (`core.autocrlf=true`); every file changed on this branch passes Prettier except the three context Markdown files, which already failed on `main`.

### 2026-11-23T23:07:46+01:00

- **M2a planning:** Updated `Design.md` and `Milestones.md` with the desktop Assistant's prominent empty-state orb and compact conversational header orb; aligned the M3 voice transition and recorded the decision in `agent-knowledge.md`.
- **Validation:** Documentation-only change; no tests run.

### 2026-11-23T23:05:58+01:00

- **M2a navigation:** Enlarged and raised the center menu orb in `AssistantOrb.svelte` and `+page.svelte`, without changing the Home card orb. Extended the narrow-screen test in `e2e/home.test.ts` to check navigation spacing and composer clearance.
- **Validation:** The focused Playwright test, `npm run check`, targeted ESLint, and Prettier checks passed. Inspected the mobile view with mocked services.

### 2026-11-23T22:57:30+01:00

- **M2a initial slice:** Added the ambient shell, font, icons, original orb, mobile Home/Assistant/Settings navigation, and desktop split in `src/routes/+page.svelte`, `src/routes/layout.css`, and `src/lib/components/AssistantOrb.svelte`. Preserved mounted chat state and fixed narrow-screen input overflow in `ChatPanel.svelte`; added focused mobile navigation tests in `e2e/home.test.ts` and `e2e/chat-history.test.ts`. Updated dependencies, `Design.md`, and milestone status.
- **Validation:** `npm run check` and targeted ESLint passed; the build completed during Playwright runs. Mobile navigation, pending approval, narrow-screen, and desktop viewport tests passed. The combined Playwright selection had 12 of 13 pass; the existing cross-tab test intermittently snapshots storage before the other tab's latest write (three isolated repeats passed). `npm audit --omit=dev` reported no production vulnerabilities. Mobile visuals were inspected with mocked services; complete contrast and accessibility validation remains open.

### 2026-11-23T22:36:37+01:00

- **Plan review:** Checked M3 to M5 and the phase descriptions against `Design.md`. Revised the M3, M4, and M5 todos in `Milestones.md`, added Phase 2a and aligned Phases 3 and 4, the frontend overview, and the testing strategy in `AGENTS.md`, and added live captions and design requirements for later milestones to `Design.md`.
- **Status:** Planning only; no implementation and no tests required.

### 2026-11-23T22:27:27+01:00

- **M2a planning:** Reworked `Design.md` around the user's mobile reference screen, stored as `docs/design/reference-mobile-home.png`: Home-first navigation with a center orb, glass surfaces, the orb as the assistant's signature, a palette sampled from the reference, a font and icon direction, assistant shortcuts, and a reference-to-product mapping. Revised the M2a todos in `Milestones.md`, clarified M4 quick actions, and recorded the decisions in `AGENTS.md` and `agent-knowledge.md`.
- **Status:** Planning only; no UI implemented. Contrast figures in `Design.md` are preliminary calculations from sampled pixels, not measurements of a rendered interface.

### 2026-11-23T22:02:59+01:00

- **M2a documentation:** Translated `Design.md` into English and added the repository-wide project-context language rule to `AGENTS.md` and `agent-knowledge.md`. Documentation only; no application behavior changed.

### 2026-11-23T17:57:23+01:00

- **M2a planning:** Added the project-wide, evolving `Design.md` with the existing UI assessment, Ambient Home design system, responsive layouts, safety and accessibility principles, future voice concept, and incremental rollout. Linked it from `Milestones.md`, `AGENTS.md`, and `README.md`; updated `agent-knowledge.md`.
- **Status:** Documentation only; no UI or voice implementation and no tests required.

### 2026-11-23T17:52:19+01:00

- **M2a planning:** Inspected the existing routes, components, Tailwind setup, and project context. Added mobile-first product-design work and verification criteria to `Milestones.md`; updated the target in `AGENTS.md` and recorded the design direction in `agent-knowledge.md`.
- **Status:** Planning only; no UI or voice implementation. No tests run for documentation-only changes.

### 2026-11-23T17:38:19+01:00

- **M2:** Added safe assistant Markdown rendering in `MarkdownMessage.svelte` and `ChatPanel.svelte`, with tables, fenced code blocks, scrollable wide content, escaped raw HTML, sanitized links, and no automatic image loading. Saved conversations render the same way; user messages remain plain text.
- **Changed:** Added Marked and DOMPurify dependencies, documented rendering in `README.md`, and added focused component and chat-history browser tests.
- **Validation:** Three component tests, nine chat-history Playwright tests, `npm run check`, targeted ESLint, and source-file Prettier checks passed. The production build emitted existing Zod/Rollup annotation warnings.

### 2026-11-23T17:19:22+01:00

- **M2:** Implemented selectable, resumable text-chat sessions in `chat-history.ts`, `chat-session.svelte.ts`, and `ChatPanel.svelte`; reloads and new tabs start fresh while Settings navigation retains the active chat. The legacy single-chat key is deleted without altering configuration or credentials.
- **Safety:** Session switches cancel responses and pending approvals, isolate late results, and warn about unknown action outcomes. Web Locks and stale-write checks protect stored sessions; Settings history deletion and reset also clear the in-memory chat.
- **Validation:** `npm run check`, targeted ESLint, 10 storage/settings unit tests, 8 session Playwright tests, and onboarding/dashboard browser tests passed. Playwright's production build emitted existing Zod/Rollup annotation warnings.

### 2026-11-23T17:05:49+01:00

- **M2 planning:** Replaced legacy chat history migration with deletion during the session-history transition; settings and credentials remain untouched. No implementation or deletion performed.

### 2026-11-23T17:03:45+01:00

- **M2 planning:** Added session-based chat history, migration, lifecycle, switching safety, privacy, and testing todos to `Milestones.md`; recorded the user decisions in `AGENTS.md` and `agent-knowledge.md`.
- **Status:** Planning only; implementation has not started.

### 2026-11-23T16:09:21+01:00

- **M2:** Compared anonymized discovery and `GetLiveContext` output supplied by the user from a real Home Assistant instance against the existing gateway and policy. Added regression tests in `ha-policy.spec.ts` and `gateway.spec.ts` for observed tool prefixes, classifications, and result structure; no application behavior change was needed.
- **Validation:** 16 policy, gateway, and parser tests passed; `npm run check` and targeted ESLint passed. No independent live connection or real mutation was performed.

### 2026-11-23T15:42:40+01:00

- **M2:** Added versioned browser-side text chat history in `src/lib/home/chat-history.ts`, integrated it into `ChatPanel.svelte`, and added explicit deletion in Settings. Tool data and approvals are not restored; interrupted actions are flagged. Disabling history preserves but does not load or update saved data.
- **Changed:** `SettingsForm.svelte`, `README.md`, and `AGENTS.md` clarify text versus future voice transcript retention; `Milestones.md` records completion and the real-instance verification blocker.
- **Validation:** `npm run check`, targeted ESLint and Prettier, 2 history unit tests, 4 history Playwright tests, and the onboarding Playwright test passed. The Playwright production build reported only existing Zod/Rollup annotation warnings.

### 2026-11-23T15:28:08+01:00

- **Changed:** `.github/skills/git-branching/SKILL.md`: creating or switching a branch now always requires the user's confirmation via `ask_user` (recommended option as default, alternatives, handling of uncommitted changes). Staying on the current branch for the same topic needs no question. Reusing a merged branch is allowed when the user chooses it (fast-forward it to `main` first).
- **Changed:** `AGENTS.md` instruction updated accordingly.
- **Branch:** `docs/git-branching-skill` (reused at the user's choice, fast-forwarded to `main`).
- **No implementation:** Documentation/process-only change.

### 2026-11-23T15:24:36+01:00

- **Added:** `.github/skills/git-branching/SKILL.md`
- **Summary:** New repository skill that checks at the start of each request whether the current branch fits the work and creates a `<type>/<topic>` branch from `main` when needed.
- **Changed:** `.github/skills/commit-work/SKILL.md` (commit on topic branches), `AGENTS.md` (future agent instructions reference the branching workflow).
- **Branch:** work done on `docs/git-branching-skill`.
- **No implementation:** Documentation/process-only change.

## 2026-11-22

### 2026-11-22T16:10:00+01:00

- **Changed:** `src/lib/components/HomeOverview.svelte`: areas are collapsible `<details>` sections (favorite areas open by default), with device/active counts, "Expand all"/"Collapse all", and a sticky panel header.
- **Changed:** `src/routes/+page.svelte`, `src/lib/components/ChatPanel.svelte`: on large screens the app fits the viewport (`lg:h-dvh`); the chat message list and the home panel scroll independently, keeping the chat input and Send button visible. Below `lg`, the chat has a fixed `75dvh` height and the page scrolls to the home panel.
- **Changed:** `src/lib/server/mcp/live-context.ts`: natural sorting of areas and entities ("Room 2" before "Room 10").
- **Tests:** HomeOverview component tests (default open state, expand/collapse all), natural-sort unit test, e2e layout test at 1280×720 with many areas; the fake MCP server now returns 42 entities in 12 areas.
- **Validation:** `npm run check` 0 errors, ESLint clean, Vitest 72 passed, Playwright 3 passed; layout checked via screenshots.

### 2026-11-22T16:05:00+01:00

- **Fixed:** `src/lib/components/HomeOverview.svelte`: the "Your home" panel stayed empty with a real Home Assistant instance because entities with the same name and domain produced duplicate `{#each}` keys (`each_key_duplicate`), which aborted rendering. The key now includes the list position.
- **Added:** `src/lib/components/HomeOverview.svelte.spec.ts` regression test with duplicate entity names.
- **Validation:** component tests 7 passed, `npm run check` 0 errors, ESLint clean.

### 2026-11-22T15:50:03+01:00

- **Summary:** Implemented milestone M2 - Text MVP.
- **Dependency:** added `@ai-sdk/mcp` 2.0.102 (dev dependency, matching the existing `ai` packages).
- **Added (server):** `src/lib/server/mcp/{gateway.ts,url-guard.ts,live-context.ts,request.ts,fake-ha-mcp-server.ts}`, `src/lib/server/chat/{chat-service.ts,chat-test-helpers.ts}`, `src/lib/server/log.ts`; routes `src/routes/api/mcp/discover/+server.ts` and `src/routes/api/home/state/+server.ts`.
- **Added (shared/UI):** `src/lib/home/{ha-policy.ts,types.ts,api.ts}`, `src/lib/components/{ChatPanel.svelte,ToolCallCard.svelte,HomeOverview.svelte}`.
- **Changed:** `src/routes/api/chat/+server.ts` (MCP tools, Responses model, confirmation policy, signed approvals), `src/routes/+page.svelte` (chat + home layout), `SettingsForm.svelte` (Test connection), `src/lib/config/headers.ts` (`x-mcp-token`), `src/lib/server/env-schema.ts` (`MCP_ALLOW_MUTATIONS`, `MCP_TIMEOUT_MS`, `TOOL_APPROVAL_SECRET`), `playwright.config.ts` (fake MCP server, baseURL), `.env.example`, `README.md`, `AGENTS.md`.
- **Fixed:** removed UTF-8 BOMs from `README.md` and `.env.example`.
- **Tests:** policy, DNS/URL guard, pinned fetch, live-context parser, gateway (fake client), chat security (approval required, signed approval executes, denial, forged/unsigned/tampered approvals rejected, disallowed domain auto-denied, no-confirmation acknowledgement), chat + real MCP protocol integration, `ToolCallCard` component, e2e connection test + home overview.
- **Validation:** `npm run check` 0 errors, ESLint clean, Vitest server + client 69 passed, Playwright 2 passed; UI checked via screenshots.

### 2026-11-22T15:09:17+01:00

- **Added:** `.github/skills/commit-work/SKILL.md`
- **Summary:** Added a repository skill describing how agents commit work as small, traceable, independently revertable commits.
- **Changed:** `AGENTS.md`: referenced the new skill in the future agent instructions.
- **No implementation:** Documentation/process-only change.

### 2026-11-22T15:03:37+01:00

- **Summary:** Implemented milestone M1 - Foundation.
- **Removed:** `src/lib/server/auth.ts`, `src/lib/server/db/auth.schema.ts`, `src/routes/demo/**`, `src/demo.spec.ts`, `e2e/demo.test.ts`, the `auth:schema` script, and the `better-auth`/`@better-auth/cli` dependencies.
- **Added:** `src/lib/config/{settings.ts,app-config.svelte.ts,mcp-url.ts,headers.ts}`, `src/lib/security/redact.ts`, `src/lib/server/{env-schema.ts,env.ts,rate-limit.ts,request-guard.ts}`.
- **Added:** `src/lib/components/{SettingsForm.svelte,StorageNotice.svelte}`, `src/routes/onboarding/+page.svelte`, `src/routes/settings/+page.svelte`, `src/routes/+layout.ts`, `src/routes/+layout.server.ts`.
- **Changed:** `src/hooks.server.ts` (env validation on init, request IDs, same-origin/body-size/rate-limit guards), `src/routes/api/chat/+server.ts` (validated body, browser/server key, model selection, timeout), `src/routes/+page.svelte` (Settings link, key header, model), `src/app.d.ts`, `src/lib/server/db/schema.ts`, `.env.example`, `README.md`.
- **Tests:** unit tests for MCP URL policy, settings storage, redaction, env parsing, rate limiting, request guard; component tests for `SettingsForm`; e2e onboarding → settings → reset flow.
- **Validation:** `npm run check` (0 errors), `vitest` server (34 passed) and client (4 passed), Playwright e2e (1 passed), ESLint clean.

### 2026-11-22T08:03:48+01:00

- **Changed:** `AGENTS.md`
- **Summary:** Made mutating-action confirmation configurable and added a later-editable Settings requirement.
- **Details:** Added all/high-risk/domain/entity/no-confirmation policy choices, default behavior, server-side invariants, Settings revalidation, and reset behavior.
- **Changed:** `Milestones.md`
- **Summary:** Added a Settings implementation todo and recorded the configurable confirmation policy decision.
- **No implementation:** Documentation-only planning update.

### 2026-11-22T07:59:08+01:00

- **Changed:** `AGENTS.md`
- **Summary:** Finalized the remaining M0 product decisions.
- **Details:** Added all-action confirmation, browser history, single-user scope, onboarding-selectable backend/voice, and Home Assistant WebSocket entity updates.
- **Changed:** `Milestones.md`
- **Summary:** Finalized and completed M0.
- **Details:** M0 now has no remaining open todos. M1 remains ready for a future implementation session.
- **No implementation:** Documentation-only milestone update.

## 2026-11-21

### 2026-11-21T23:08:33+01:00

- **Changed:** `README.md`
- **Summary:** Replaced the generic Svelte scaffolding README with project-specific documentation.
- **Details:** Added project goal, milestones, planned GPT-Live/MCP architecture, Browser-first-MVP behavior, security requirements, repository context links, setup commands, and known validation conditions.
- **Language:** Translated the project README to English.
- **No implementation:** Documentation-only change.

### 2026-11-21T23:02:40+01:00

- **Changed:** `AGENTS.md`
- **Summary:** Finalized initial implementation settings.
- **Details:** Selected Browser Storage credentials for the private MVP, unauthenticated restricted testing, Responses delegation, and lights/climate/scenes/scripts/read-only Home Assistant tools.
- **Changed:** `Milestones.md`
- **Summary:** Checked resolved planning decisions and narrowed remaining open items.

### 2026-11-21T22:58:41+01:00

- **Added:** `agent-knowledge.md`
- **Summary:** Added the persistent timestamped project knowledge base.
- **Details:** Captured existing architecture, storage, onboarding, GPT-Live, MCP, security, and open-decision context.

- **Added:** `agent-changelog.md`
- **Summary:** Added a persistent timestamped implementation and documentation changelog.
- **Details:** Backfilled the relevant planning and initial chat implementation changes.

- **Added:** `Milestones.md`
- **Summary:** Added agent-owned milestones and concrete todos.
- **Details:** Added foundation, text MVP, GPT-Live MVP, dashboard, hardening, status conventions, and open planning work.

- **Added:** `.github/skills/agent-knowledge/SKILL.md`
- **Added:** `.github/skills/agent-changelog/SKILL.md`
- **Added:** `.github/skills/milestones/SKILL.md`
- **Summary:** Added repository maintenance skills for knowledge, changelog, and milestone workflows.

- **Changed:** `AGENTS.md`
- **Summary:** Added mandatory repository context-maintenance instructions for future sessions.

### 2026-11-21T22:58:41+01:00

- **Changed:** `AGENTS.md`
- **Summary:** Replaced the general Realtime/WebRTC plan with the GPT-Live duplex architecture.
- **Details:** Added `gpt-live-1.1` as the live/frontend model, separate backend reasoning/delegation models, Responses and client delegation modes, tool continuation, interruption policy, and a GPT-Live full-duplex MVP phase.
- **No implementation:** Documentation-only change.

### 2026-11-21T22:51:48+01:00

- **Changed:** `AGENTS.md`
- **Summary:** Added Browser Storage as the initial database and secret-storage mechanism for the SPA prototype.
- **Details:** Documented Browser Storage boundaries, cookie rules, credential deletion/replacement, and server-side hardening before public production use.
- **No implementation:** Documentation-only change.

### 2026-11-21T22:49:09+01:00

- **Changed:** `AGENTS.md`
- **Summary:** Added the first-run onboarding specification.
- **Details:** Added MCP address setup, transport/authentication fields, voice/model selection, confirmation preferences, settings/reset behavior, and an MCP connection test sequence.
- **No implementation:** Documentation-only change.

### 2026-11-21T22:47:15+01:00

- **Changed:** `AGENTS.md`
- **Summary:** Recorded core product decisions.
- **Details:** Added public internet deployment, WebRTC live transport, existing MCP assumption, and text-before-voice implementation order.
- **No implementation:** Documentation-only change.

### 2026-11-21T22:43:27+01:00

- **Changed:** `AGENTS.md`
- **Summary:** Created the initial project implementation plan.
- **Details:** Added goals, architecture, security requirements, phased rollout, testing, open decisions, and future agent instructions.
- **No implementation:** Documentation-only change.

### 2026-11-21T22:30:43+01:00

- **Changed:** `src/routes/api/chat/+server.ts`
- **Summary:** Added server-side OpenAI provider configuration.
- **Details:** Reads `OPENAI_API_KEY` through SvelteKit private environment variables and creates an OpenAI provider with an explicit API key.
- **Status:** Check affected by an unrelated placeholder auth schema. Playwright browser binaries are not installed.

- **Changed:** `src/routes/+page.svelte`
- **Summary:** Added the chat endpoint transport and basic loading/error UI.
- **Details:** Configured `DefaultChatTransport` for `/api/chat`, reactive input state, heading, and send-state handling.
- **Status:** Svelte autofixer found no remaining issues.
