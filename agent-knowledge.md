# Agent Knowledge

This file is the persistent project knowledge base. Entries are append-only and ordered newest first. It complements `AGENTS.md` with decisions, discoveries, constraints, and context learned during implementation sessions.

## 2026-11-23

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

