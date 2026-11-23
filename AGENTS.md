## Project Configuration

- **Language:** TypeScript
- **Framework:** Svelte 5 / SvelteKit
- **Package Manager:** npm
- **Styling:** Tailwind CSS
- **Authentication:** browser-first initial phase; Better Auth or a server-side session can be added later
- **Initial persistence:** Browser Storage (including `localStorage`/`sessionStorage`/IndexedDB) and cookies; no application database
- **Database:** SQLite with Drizzle ORM (reserved for a later optional history/account phase)
- **AI SDK:** Vercel AI SDK
- **Testing:** Vitest, Svelte component tests, Playwright
- **Linting and formatting:** ESLint and Prettier
- **Target:** Desktop-first responsive smart-home frontend

---

# Project Goal

Build a polished, secure frontend application that allows a user to control Home Assistant through natural language using OpenAI GPT-Live and text interfaces. GPT-Live must interact with Home Assistant only through a dedicated MCP (Model Context Protocol) server and must never receive direct credentials for Home Assistant.

The user interface should support voice conversation, text chat, live status feedback, tool-call visibility, confirmations for sensitive actions, and access to Home Assistant entities and dashboards.

# Current Planning State

This section is the implementation plan for future coding sessions.

**Do not implement application features until the user explicitly starts a separate implementation phase.** In the current planning phase, only this file may be changed unless the user explicitly requests otherwise.

## Confirmed Product Decisions

- The first deliverable is a public-facing text chat MVP.
- Browser voice uses OpenAI GPT-Live over WebRTC.
- GPT-Live is a full-duplex conversation model that listens and speaks independently of a separate backend reasoning model.
- Backend work is called delegation. The frontend/live model decides when to delegate, while the backend model reasons, uses tools, and returns results.
- Configure the live model and backend model independently. Initial live model: `gpt-live-1.1`; backend model selection remains configurable.
- The first GPT-Live implementation uses Responses delegation. Client delegation remains a documented later migration option.
- The browser must obtain only an ephemeral session credential from the server.
- Home Assistant is reached through an existing MCP server.
- The initial public-hosted MVP is a private testing phase with no login. It must be deployed only to an explicitly restricted environment, with no exposure to unrelated users.
- Authentication, rate limiting, origin controls, session isolation, and explicit action authorization remain required before a generally available public release.
- The initial application does not use SQLite or Drizzle for user/application data.
- Configuration and secrets may be stored in Browser Storage for the initial prototype.
- Browser-stored secrets are not a security boundary. They may be read by browser JavaScript and anyone with control of the browser origin.
- The public/internet-ready production phase should replace browser-only secret storage with an appropriate server-side secret flow before being treated as secure.
- On first start, the user completes an onboarding form for the essential MCP and voice settings.
- The private MVP is designed for one user and persists browser-side conversation/action history when enabled.
- M2 follow-up: text history is organized into selectable chat sessions. A new tab, browser restart, or page reload starts a new session; returning from Settings keeps the active session. Delete the legacy v1 chat history during the transition instead of migrating it; retain settings and credentials.
- Switching chat sessions cancels in-progress responses and pending confirmations; already-started device actions may have an unknown outcome and must not be assumed undone.
- Mutating Home Assistant actions can require confirmation according to the user's onboarding/settings preference.
- The default private-MVP preference is confirmation for every mutating action.
- Home Assistant entity updates use WebSocket events.
- The backend reasoning model and GPT-Live voice are selectable during onboarding.
- The Home Assistant MCP server is the official Home Assistant "Model Context Protocol" integration (Assist "Device control" tools, long-lived access token as bearer token).
- The server-side MCP client is `@ai-sdk/mcp`. Tool exposure is an explicit allowlist in `src/lib/home/ha-policy.ts`; unknown tools are never exposed.
- Mutating-action confirmations use AI SDK tool approvals with HMAC-signed approval requests (`TOOL_APPROVAL_SECRET`), so browser-side approvals cannot be forged or altered.

# Non-Negotiable Requirements

- For the initial browser-first prototype, secrets may be stored in Browser Storage when no server-side secret store is being used.
- Treat all Browser Storage secret values as exposed to browser JavaScript and as unsuitable for a production security boundary.
- Before public internet production hardening, move secrets to server-only storage and never expose raw secret values to browser JavaScript.
- Never place API keys in prompts, logs, screenshots, chat messages, or source examples.
- All Home Assistant mutations must go through MCP tools and be authorized server-side.
- Add confirmation and policy checks before actions that affect security, climate, locks, alarms, garage doors, presence, or multiple devices.
- Read-only discovery and status queries may run without confirmation.
- The frontend must remain usable with the existing text chat while GPT-Live voice integration is being implemented.
- The UI must be responsive and accessible.
- MCP and provider integrations must be isolated behind server-side adapters so transport or provider changes do not leak through the UI.

# Desired Architecture

## 1. SvelteKit frontend

`src/routes/+page.svelte` and future route components should contain presentation and interaction state only.

The frontend should communicate with server endpoints or server actions, not directly with OpenAI or Home Assistant.

Initial routes:

- `/` - primary smart-home assistant dashboard
- `/login` or existing better-auth login route - authentication
- `/settings` - provider, voice, and safety preferences
- `/history` - conversation history, if persistence is included

## 2. GPT-Live/full-duplex and text adapter

Create a server-only OpenAI adapter for the following duplex architecture:

### Frontend/live model

- Use `gpt-live-1.1` for conversation and speech.
- Use a short GPT-Live prompt that defines conversation style and when to delegate.
- Create and manage the Live session from the trusted server.
- Connect the browser microphone and speaker through WebRTC; carry JSON events on the data channel.
- Stream live transcripts and connection state to the UI.
- Apply the onboarding-selected voice.
- Never send a long-lived OpenAI API key to the browser. Use an ephemeral session credential or connection offer exchange created by the server.

### Backend/reasoning model

- Configure a separate backend model for reasoning and delegated tasks.
- Keep detailed instructions, Home Assistant rules, entity constraints, and tool workflows in the backend prompt.
- The frontend/live model can continue speaking while backend work is running.
- Track delegation lifecycle and task progress.
- Decide whether interrupted backend work is finished or cancelled according to application policy.
- Return approved tool results through the GPT-Live continuation flow.

### Delegation modes

- Prefer Responses delegation for the first implementation if it supports the selected Home Assistant MCP workflow. The server configures the independent backend Responses model and tools.
- Consider client delegation when the application needs to own context, routing, confirmations, model selection, or MCP execution completely.
- Switching delegation modes requires a new Live session.
- In both modes, custom application permissions, confirmation decisions, MCP execution, and task state remain server-side.
- Text chat remains available through the existing chat API and can use a separately selected text or Responses model.

## 3. MCP gateway

Create a server-only MCP gateway that connects to one or more MCP servers. The initial integration should include a dedicated Home Assistant MCP server.

The gateway is responsible for:

- MCP server discovery
- tool schema normalization
- allowlisting tools
- parameter validation
- timeout and retry handling
- audit logging
- confirmation policy
- translating MCP errors into safe UI messages
- returning function-call or MCP results to the GPT-Live continuation flow

For GPT-Live, MCP tools may be registered under Responses delegation or executed through client delegation. The application must not assume that a tool call means that a mutating action is authorized. The backend emits a call, but the server-side gateway must validate the call and confirmation state before execution.

## 4. Home Assistant connection

Use onboarding/browser configuration for:

- Home Assistant base URL
- Home Assistant access token
- MCP transport mode
- allowed areas, domains, entities, and actions

Use Home Assistant WebSocket events for live entity updates in the initial implementation.

The initial browser-first prototype may store the MCP address and credentials in Browser Storage and send them only to the application's own server proxy. Before a generally available public release, replace browser-only credential storage with server-side provisioning.

The initial allowlist should be conservative:

- list areas
- list entities
- read entity state
- turn lights on or off
- set light brightness and color temperature
- set supported climate values
- activate a script or scene

High-risk operations must be explicitly decided before implementation.

# Initial Onboarding

On the first application start, show a short onboarding flow before the main assistant is usable.

## Onboarding form

The initial form should collect:

- MCP server address (required)
- MCP transport type, if the server supports more than one transport
- optional MCP display name
- optional MCP authentication configuration
- optional preferred OpenAI voice
- optional preferred GPT-Live voice
- optional preferred backend/reasoning model
- optional preferred text model
- confirmation preferences for mutating Home Assistant actions
- optional favorite areas or entity domains

## Configuration handling

- Persist configuration in `localStorage`, `sessionStorage`, IndexedDB, or cookies as appropriate.
- For the initial prototype, persist OpenAI API keys, Home Assistant tokens, and MCP credentials in Browser Storage when required by the SPA flow.
- Use clear prefixes and versioned keys for stored configuration, for example `home-agent.settings.v1`.
- Store confirmation policy as a named, versioned setting rather than mixing it with unrelated UI state.
- Provide a dedicated Settings page or panel where all onboarding choices can be changed later.
- Revalidate the MCP address and secret status after relevant Settings changes.
- Disconnect or restart dependent chat/MCP/GPT-Live sessions when settings affecting connections or models change.
- Provide reset-to-default and reset-all-data actions with explicit confirmation.
- Clearly indicate whether a Settings change is applied immediately or requires a reconnect/restart.
- Avoid cookies for raw credentials unless server-side delivery and cookie security settings are part of the implementation.
- Add an explicit onboarding notice that Browser Storage secrets are readable by browser JavaScript and are not encrypted by the browser.
- If MCP authentication requires a secret, the initial prototype may store it in Browser Storage and send it through the existing server integration, with the value kept out of UI labels and logs.
- Before production hardening, replace Browser Storage secrets with a server-side secret store or per-user session provisioning.
- The MCP address should be validated as an allowed HTTP/HTTPS URL before use.
- Browser onboarding must clearly warn when a URL or credential is exposed to the wrong origin.
- Provide an edit and reset action in Settings.

## First-run sequence

1. Show the onboarding screen.
2. Validate the MCP server address.
3. Optionally test discovery/read-only access.
4. Save non-sensitive preferences locally.
5. Select the voice, GPT-Live frontend model, backend reasoning model, and text fallback defaults.
6. Open the smart-home assistant or dashboard.
7. Never execute a mutating Home Assistant action during onboarding without explicit confirmation.

# Mutating-Action Confirmation Settings

Expose the confirmation policy in onboarding and Settings:

- **Confirm every mutation:** read-only queries are unaffected; every state change or action requires confirmation.
- **Confirm only high-risk mutations:** locks, alarms, garage doors, irrigation, presence-sensitive actions, and other explicitly classified domains require confirmation.
- **Confirm by entity/domain:** allow the user to choose confirmation requirements per domain or entity category.
- **No confirmation:** intended only for explicitly trusted/private deployments after a visible warning and should be disabled by default.

The selected policy is a browser preference and must never weaken server-side allowlists or authorization checks. The server must always validate tool permissions, target entities, areas, action type, and the final confirmation decision.

Changing the confirmation policy in Settings applies to future actions immediately. Existing pending confirmations must be cancelled or revalidated against the new policy.

# Proposed Frontend

The UI should be structured around four areas:

1. **Conversation panel**
   - live transcript
   - text fallback
   - microphone state
   - connection state
   - assistant and tool-call status

2. **Smart-home overview**
   - areas
   - favorite entities
   - live state indicators
   - quick actions

3. **Onboarding**
   - MCP server address
   - MCP connection test
   - voice selection
   - confirmation preference
   - optional areas/domains

4. **Action confirmation drawer**
   - human-readable action summary
   - affected entities and areas
   - confirm/cancel
   - optional countdown or undo support

5. **Activity and diagnostics**
   - recent actions
   - MCP tool calls
   - success/failure states
   - timestamps
   - no secrets or raw token values

Use neutral, calm colors and avoid relying on color alone to communicate device or connection state.

# Safety and Confirmation Policy

Before a mutating tool is called, the server should evaluate:

- authenticated user
- allowed MCP tool
- allowed target entities
- allowed areas
- action type
- number of affected entities
- whether the action is reversible
- whether it affects high-risk domains

Recommended confirmation categories:

- **No confirmation:** read-only queries
- **All mutations:** default private-MVP setting; includes lights, climate, fan/media state, scenes, scripts, locks, alarms, garage doors, irrigation, and presence-sensitive actions
- **High-risk only:** locks, alarms, garage doors, irrigation, presence-sensitive actions, and explicitly configured sensitive domains
- **Per-domain/per-entity:** user-selected confirmation policy
- **Disabled:** explicit opt-out with visible warning and restricted/private deployment requirement
- **Out of scope initially:** destructive automation changes or broad device enablement

Tool calls must execute only after the server has approved the request. Client-only confirmation is not sufficient.

# Observability and Error Handling

- Add structured server-side logs for session, MCP tool, action, and provider events.
- Redact secrets and sensitive parameters.
- Display concise, user-oriented errors in the UI.
- Record invalid authentication, denied tools, MCP failures, provider failures, and confirmation rejections.
- Add request IDs for tracing provider and MCP failures.
- Do not log raw audio or full conversations unless the user explicitly enables retention.

# Data Model

The initial implementation does not use a database.

Possible browser-side persistence:

- MCP server address
- MCP display name
- selected voice
- selected model/provider preference
- selected confirmation preference
- favorite areas and entity IDs
- small, optional conversation metadata

Browser-side persistence must exclude:

- full raw voice recordings
- full voice transcripts unless the user explicitly enables retention

Browser-side persistence may include:

- OpenAI API keys
- Home Assistant access tokens
- MCP bearer tokens or passwords
- the MCP server address and transport settings
- voice and model preferences
- conversation metadata and timestamps
- redacted tool summaries
- text chat messages when browser-side history is enabled; optional voice transcript text when separately enabled

For the initial prototype, document each stored secret and provide Settings actions to view status, replace, and delete stored credentials. Browser Storage is not a security boundary.

Do not use credential-bearing cookies in JavaScript-readable form. If cookies are used for server sessions, prefer `HttpOnly`, `Secure`, and appropriate `SameSite` settings.

Persistent SQLite conversation history is a later optional phase. If enabled, store only the minimum required data:

- conversation metadata
- timestamps
- redacted tool summaries
- optional transcript text
- optional voice preference

Do not store Home Assistant tokens or OpenAI API keys in SQLite. Browser Storage may hold them in the initial browser-first prototype.

# Security Review Required

Before implementation:

- rotate the currently exposed OpenAI API key
- ensure `.env` is ignored by Git and secrets are not committed
- for the initial browser-first prototype, document and isolate any secrets stored in localStorage, IndexedDB, or sessionStorage
- the private testing MVP must not be broadly internet-accessible; restrict hosting by network/VPN/password or deployment platform controls
- treat browser-held API/MCP/Home Assistant secrets as shared testing credentials; do not use privileged production credentials
- prevent MCP proxy use as an arbitrary SSRF endpoint; validate schemes and reject private/link-local/loopback targets where public deployment policy does not permit local Home Assistant access
- prevent unauthenticated public mutating operations if no login is enabled, or keep mutating actions disabled for the private testing MVP
- before public production hardening, remove browser-only secret storage and use a server-side secret/session flow
- run `npm run auth:schema` only if better-auth/SQLite authentication is retained
- verify authentication protects all smart-home endpoints
- validate MCP URLs, protocols, and allowed origins before opening a connection
- add rate limiting and a maximum request duration
- restrict CORS and allowed origins
- define session ownership for all conversations and actions
- add tests for authorization bypass, tool allowlisting, and confirmation enforcement

# Implementation Phases

## Phase 1: Foundation

- Repair generated or placeholder database/auth schemas only if authentication persistence is later enabled
- Decide whether the existing better-auth/SQLite setup should be replaced or deferred for browser-first onboarding
- Stabilize the existing SvelteKit application
- Keep the private testing MVP deployment restricted and unauthenticated unless an explicit temporary access layer is configured
- Reserve Better Auth and session ownership for the generally available public release
- Protect mutating server actions even in the private testing MVP with explicit confirmation and restricted tool allowlists
- Add a server-only environment configuration module
- Add safe configuration validation
- Replace any leaked or placeholder model configuration
- Add the first-run onboarding form and browser configuration storage
- Establish unit, component, and end-to-end test conventions

## Phase 2: Text MVP

- Replace the basic chat implementation with a polished conversation UI
- Use the onboarding-selected MCP address and connection settings
- Add a server-side MCP connection test
- Connect the existing chat endpoint to an OpenAI text model
- Implement an MCP client/gateway
- Connect read-only Home Assistant discovery and state tools
- Display tool calls and results
- Add basic action confirmation

## Phase 3: GPT-Live Full-Duplex MVP

- Add ephemeral GPT-Live session creation on the trusted server.
- Establish the browser-to-GPT-Live WebRTC connection.
- Apply the onboarding-selected voice to `gpt-live-1.1`.
- Configure a separate backend reasoning model for delegation.
- Use Responses delegation for the first voice implementation.
- Stream live transcripts, delegation lifecycle, and connection state.
- Register approved MCP tools with the backend delegation configuration or client workflow.
- Route delegated tool calls through the server-side MCP gateway.
- Validate permissions and confirmations before executing any mutating call.
- Return tool and MCP results to GPT-Live and allow it to continue speaking independently.
- Support interruption, cancellation/continuation policy, and text fallback.

## Phase 4: Smart-Home Dashboard

- Add area and entity discovery
- Add favorites and quick actions
- Add live entity updates
- Add action history
- Add settings and voice preferences
- Improve responsive layout and accessibility

## Phase 5: Hardening

- Add confirmation policies and audit trails
- Add tool restrictions and entity allowlists
- Add rate limiting and session limits
- Add integration and security tests
- Add deployment configuration
- Review voice data handling and transcript retention

# Testing Strategy

- **Unit:** environment validation, authorization policy, MCP parameter validation, action classification
- **Component:** chat states, microphone states, transcript rendering, confirmation dialogs
- **Integration:** OpenAI adapter, MCP gateway, mocked Home Assistant MCP server
- **End-to-end:** login, text chat, read-only entity discovery, approved action, denied action, voice connection state
- **Security:** secret redaction, no secrets in logs or UI labels, browser credential deletion and replacement, expired sessions, cross-user isolation, allowlist bypass attempts

Testing must use mocks or a test Home Assistant instance; no real smart-home command should run in automated tests.

# Open Questions Before Implementation

The following decisions have been made:

1. **OpenAI live interface:** GPT-Live over WebRTC in the browser is the primary live integration target.
2. **GPT-Live architecture:** a `gpt-live-1.1` frontend/live model delegates reasoning and tools to an independently configured backend model.
3. **Deployment:** the application is intended for public internet deployment.
4. **Home Assistant MCP:** an existing MCP server is expected and will be integrated first.
5. **Initial MVP:** the text chat MVP comes first; live voice follows after the text vertical slice is stable.
6. **Initial storage:** browser storage and cookies only; no database for the first implementation.
7. **Onboarding:** MCP server address and voice selection are part of the first-start experience.
8. **Initial secret storage:** Browser Storage may hold API and MCP credentials for the prototype, but this is not treated as a production security boundary.
9. **MVP API secrets:** OpenAI and MCP/Home Assistant credentials are configured and read from Browser Storage by the private testing MVP.
10. **Authentication scope:** The private testing MVP is unauthenticated; Better Auth is deferred until a generally available public release.
11. **Initial Home Assistant domains:** lights, climate, scenes, scripts, and read-only states.
12. **GPT-Live delegation:** Responses delegation is the first implementation choice.
13. **Mutating actions:** confirm-every-mutation is the default private-MVP preference; the confirmation policy is editable in onboarding and Settings.
14. **History:** browser-side conversation/action history is persisted when enabled.
15. **User model:** the private MVP supports one user.
16. **Backend and voice defaults:** backend reasoning model and GPT-Live voice are selectable during onboarding.
17. **Entity updates:** use Home Assistant WebSocket events.

# Future Agent Instructions

For later implementation sessions:

- Write all project context in the repository in English.
- Read this file before making code changes.
- Read `agent-knowledge.md`, `Milestones.md`, and recent `agent-changelog.md` entries before planning or implementation.
- Use the repository skills under `.github/skills/agent-knowledge`, `.github/skills/agent-changelog`, `.github/skills/milestones`, `.github/skills/git-branching`, and `.github/skills/commit-work`.
- At the start of every user request that may change files, use the `git-branching` skill: check whether the current branch fits the work; if a new or different branch is advisable, ask the user before creating or switching. Do not merge, push, or delete branches without the user's request.
- Commit verified work with the `commit-work` skill: small, self-contained, conventional commits linked to milestones so each can be reverted independently.
- Maintain `agent-knowledge.md` with timestamped durable discoveries and decisions.
- Maintain `agent-changelog.md` after relevant implementation or documentation changes.
- Maintain `Milestones.md` by selecting, starting, completing, or blocking concrete todos.
- Implement only the explicitly assigned phase or task.
- Start with the smallest vertical slice that is testable end to end.
- Use existing project conventions and Svelte MCP documentation.
- Do not introduce a dependency until the task requires it.
- Keep API keys and tokens server-side for production-ready implementations. The explicit browser-first prototype may store them in Browser Storage until server-side secret provisioning is implemented.
- Update this file when architectural decisions or scope requirements change.
- Ask for clarification when a requirement would materially change security, cost, architecture, or user behavior.
