# Agent Changelog

This file records implementation and repository changes made by agents. Entries are append-only and ordered newest first.

## 2026-11-24

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

