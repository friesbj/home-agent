# Agent Changelog

This file records implementation and repository changes made by agents. Entries are append-only and ordered newest first.

## 2026-11-23

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

