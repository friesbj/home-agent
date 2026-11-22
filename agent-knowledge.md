# Agent Knowledge

This file is the persistent project knowledge base. Entries are append-only and ordered newest first. It complements `AGENTS.md` with decisions, discoveries, constraints, and context learned during implementation sessions.

## 2026-11-22

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

