# Agent Changelog

This file records implementation and repository changes made by agents. Entries are append-only and ordered newest first.

## 2026-11-22

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

