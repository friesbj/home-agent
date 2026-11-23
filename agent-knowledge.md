# Agent Knowledge

This file is the persistent project knowledge base. Entries are append-only and ordered newest first. It complements `AGENTS.md` with decisions, discoveries, constraints, and context learned during implementation sessions.

## 2026-11-24

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

