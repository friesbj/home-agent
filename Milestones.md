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

- [~] Establish the design foundation: semantic tokens and Tailwind theme mappings, ambient background, self-hosted font, glass and solid surfaces, focus, motion, and status styles, an icon set, and the reusable assistant orb; verify accessible contrast.
  - [x] Add an initial ambient shell, self-hosted font, Lucide icons, focus treatment, and static reusable orb; remaining tokens, surfaces, motion, status styles, and contrast validation are still required.
- [~] Build the mobile-first app shell with Home, Assistant, and Settings: bottom navigation with the center orb opening the text assistant, and a side-by-side layout on larger screens. Keep the active conversation, responses, and pending approvals intact when switching between Home and Assistant.
  - [x] Add Home-first mobile navigation and a desktop split, keeping chat mounted and preserving running responses and pending approvals on mobile view changes.
- [ ] Redesign Home as a glanceable dashboard: greeting with optional display name, data-derived status sentence, assistant entry card, read-only light and climate summaries, and collapsible rooms with refresh and freshness states; retain favorites and existing entity behavior.
- [ ] Add assistant shortcuts for scenes: a tile submits a visible request to the conversation and goes through the existing server-side confirmation; no new action endpoint.
- [ ] Redesign the Assistant view: text chat, session selection, Markdown, tool status, and approval presentation; keep input accessible and preserve the existing server-side approval flow.
  - [ ] Give desktop Assistant a prominent central orb when the conversation is empty and a compact header orb when it contains messages; preserve chat state, visible composer, and confirmation priority.
- [ ] Apply the same design system to onboarding and Settings, including the optional display name, keeping credential notices, validation, connection testing, confirmation preferences, and reset safeguards visible and functional.
- [ ] Specify the future voice screen and its listening, speaking, thinking, tool-use, confirmation, and error states; implement actual voice interaction only in M3.
- [ ] Validate against the reference and across mobile, tablet, and desktop layouts: keyboard and screen-reader access, reduced motion, zoom, touch targets, and existing chat, settings, history, and approval workflows using mocked services.

## M3 - GPT-Live Full-Duplex MVP

M2a specifies the voice mode in [Design.md](./Design.md#future-voice-mode); M3 implements it inside the Assistant view.

- [ ] Create trusted-server GPT-Live session provisioning.
- [ ] Implement browser WebRTC microphone/speaker/audio tracks.
- [ ] Add Live data-channel event handling.
- [ ] Configure `gpt-live-1.1` separately from the backend reasoning model.
- [ ] Implement Responses delegation, as decided in M0; client delegation remains a later option.
- [ ] Connect delegated MCP/Home Assistant tools.
- [ ] Implement tool-result continuation and confirmation handling; show confirmations on the solid confirmation surface in voice mode.
  - Open decision: whether a spoken confirmation may approve an action. Until decided, approval requires the on-screen control.
- [ ] Add interrupt/cancel/continue behavior.
- [ ] Build the voice mode screen: large orb, connection and microphone permission states, overlapping listening, speaking, and delegation states, tool activity, live captions, and error and reconnect states, each with a text equivalent and a reduced-motion variant.
- [ ] Drive orb motion only from real audio levels and session state.
- [ ] Switch the assistant entry points to voice once it works: microphone glyph and voice hint on the navigation orb and a voice offer in the Home entry card.
- [ ] Keep text chat as fallback, reachable in the same Assistant view with a visible switch between voice and text.
- [ ] Add GPT-Live integration tests with mocked MCP/Home Assistant services and component tests for the voice states.

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
