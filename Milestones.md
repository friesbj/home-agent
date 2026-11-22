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
- [ ] Persist browser-side chat history when history is enabled in Settings.
- [ ] Verify the gateway against a real Home Assistant instance (tool names, prefixes, and GetLiveContext format).

## M3 - GPT-Live Full-Duplex MVP

- [ ] Create trusted-server GPT-Live session provisioning.
- [ ] Implement browser WebRTC microphone/speaker/audio tracks.
- [ ] Add Live data-channel event handling.
- [ ] Configure `gpt-live-1.1` separately from the backend reasoning model.
- [ ] Choose and implement Responses or client delegation.
- [ ] Connect delegated MCP/Home Assistant tools.
- [ ] Implement tool-result continuation and confirmation handling.
- [ ] Add interrupt/cancel/continue behavior.
- [ ] Keep text chat as fallback.
- [ ] Add GPT-Live integration tests with mocked MCP/Home Assistant services.

## M4 - Smart-Home Dashboard

- [ ] Add area and favorite entity discovery.
- [ ] Add live entity state updates.
- [ ] Add quick actions.
- [ ] Add action history.
- [ ] Add voice, model, confirmation, and MCP settings.
- [ ] Improve responsive layout and accessibility.

## M5 - Public-Internet Hardening

- [ ] Move secrets out of Browser Storage to server-side provisioning.
- [ ] Use server-side sessions and ownership checks.
- [ ] Restrict CORS and allowed MCP origins.
- [ ] Add tool/entity allowlists.
- [ ] Add audit logs with secret redaction.
- [ ] Add confirmation/denial and authorization bypass tests.
- [ ] Review voice/transcript retention.
- [ ] Configure deployment and verify HTTPS.
