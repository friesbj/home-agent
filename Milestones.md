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
- [ ] Resolve remaining product decisions: confirmation scope, history, user/role model, backend/voice defaults, and entity updates.

## M1 - Foundation

- [ ] Repair or replace the placeholder Better Auth database schema if it remains in use.
- [ ] Establish a browser-storage configuration module with versioned keys and redaction-safe helpers.
- [ ] Implement onboarding for MCP address, transport, credentials, voice, and model preferences.
- [ ] Add MCP URL validation and an HTTPS/localhost development policy.
- [ ] Replace the leaked/placeholder API-key setup with secure configuration review.
- [ ] Protect public server routes and add authentication/session ownership.
- [ ] Add rate limiting and request-duration limits.
- [ ] Add unit/component test conventions.
- [ ] Validate configuration and environment values at startup.

## M2 - Text MVP

- [ ] Build a polished text chat interface.
- [ ] Connect the chat endpoint to the selected text/Responses model.
- [ ] Implement a server-side MCP gateway.
- [ ] Support existing MCP server discovery and read-only tool discovery.
- [ ] Add Home Assistant area/entity status views.
- [ ] Show tool calls and redacted results.
- [ ] Add basic mutating-action confirmation.
- [ ] Add text chat integration and security tests.

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
