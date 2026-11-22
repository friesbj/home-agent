# Agent Knowledge

This file is the persistent project knowledge base. Entries are append-only and ordered newest first. It complements `AGENTS.md` with decisions, discoveries, constraints, and context learned during implementation sessions.

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

