# Home Agent

Home Agent is a SvelteKit smart-home application for controlling Home Assistant through natural language and text.

The application connects a text or GPT-Live chat interface with a server-side MCP gateway. Home Assistant is not addressed directly by the browser.

## Current Status

Phases 1 (Foundation) and 2 (Text MVP) are implemented: onboarding and Settings, a text chat connected to Home Assistant through a server-side MCP gateway, an area/entity overview, visible tool calls, and server-enforced confirmation of device changes. GPT-Live voice follows in Phase 3.

- Phase 1: Foundation and onboarding
- Phase 2: Text chat with MCP and read-only Home Assistant queries
- Phase 3: GPT-Live with WebRTC and duplex delegation
- Phase 4: Smart-home dashboard
- Phase 5: Public-internet hardening

Concrete tasks and decisions are maintained in [AGENTS.md](./AGENTS.md), [Milestones.md](./Milestones.md), [agent-knowledge.md](./agent-knowledge.md), and [agent-changelog.md](./agent-changelog.md).

## Planned Architecture

- **Frontend:** Svelte 5, SvelteKit, and Tailwind CSS
- **Text MVP:** OpenAI text/Responses model through a server-side chat endpoint
- **Voice mode:** GPT-Live with `gpt-live-1.1` as the frontend/conversation model
- **Delegation:** Separate backend model for reasoning and tool calls
- **MCP:** Existing MCP server as the Home Assistant integration
- **Persistence:** Initial browser-first MVP using Browser Storage instead of a database
- **Tool scope:** Read-only states and Lights, Climate, Scenes, and Scripts

GPT-Live uses a duplex architecture: the live model leads the conversation and delegates tasks to a separately configured backend model. Tool execution and confirmation decisions remain controlled by the server.

## Browser-First MVP

On the first start, the application opens onboarding for:

- MCP server address
- Optional transport and MCP name
- Optional MCP access token
- OpenAI API key
- Preferred voice and models
- Security and confirmation preferences
- Favorite areas or entity domains

All onboarding preferences can be changed later in Settings, including the MCP connection, credentials, voice/model, favorites, confirmation policy, and reset options.

Mutating-action confirmation supports a default "confirm every mutation" policy plus high-risk-only, per-domain/per-entity, and explicit trusted-deployment opt-out modes.

The private test MVP may store API and MCP credentials in Browser Storage. Browser Storage is not a secure production boundary: JavaScript and any attacker with control over the browser origin can read its values.

The private MVP must not be operated as a broadly public service. Use VPN, password protection, or network restrictions. Mutating actions are confirmed and restricted to the allowed domains.

## Security

- `OPENAI_API_KEY`, Home Assistant tokens, and MCP credentials must not appear in logs, UI text, or commits.
- A previously exposed OpenAI key must be revoked and replaced.
- The MCP proxy must not allow arbitrary external or private network addresses as SSRF targets.
- Read-only queries require no confirmation; mutating actions require server-side validation and confirmation.
- Secrets, sessions, and user permissions must be implemented server-side before a public release.
- Better Auth/SQLite is not used by the browser-first MVP; the placeholder wiring was removed and authentication is planned for the public release (M5).
- `/api/*` requests must be same-origin (or listed in `ALLOWED_ORIGINS`), are rate limited per client, have a body-size limit, and model calls have a total timeout.
- MCP addresses are validated (https/http policy, no URL credentials, private/loopback hosts only when allowed, link-local always blocked). The server re-validates them, checks the addresses the hostname resolves to, never follows redirects, and only talks to the validated origin.

## Home Assistant MCP Server

Home Agent targets the official Home Assistant **Model Context Protocol** integration (`/api/mcp`).

1. In Home Assistant, enable the integration under **Settings > System > AI** and copy the MCP URL. The individual **Device control** URL (`/api/mcp/assist`) is recommended because it only exposes entities you share with voice assistants.
2. Create a dedicated, least-privilege long-lived access token (profile > Security) and enter it as the MCP bearer token. OAuth is not supported.
3. Use **Test connection** in onboarding or Settings to see how many tools are available and how many are blocked.

The gateway only exposes an allowlist of Assist tools (`src/lib/home/ha-policy.ts`):

| Kind | Tools | Behavior |
| --- | --- | --- |
| Read | `GetLiveContext`, `GetDateTime`, `HassGetState`, `HassGetWeather`, `HassClimateGetTemperature` | Run without confirmation |
| Change | `HassTurnOn`, `HassTurnOff` (with `domain`), `HassLightSet`, `HassClimateSetTemperature` | Only for `light`, `climate`, `scene`, `script`; confirmation according to the Settings policy |
| Blocked | Everything else, including the administrator "Call action" tool | Never shown to the model |

Confirmations are enforced on the server: approval requests are HMAC-signed (`TOOL_APPROVAL_SECRET`), so a modified or forged approval from the browser is rejected, and every tool call is re-checked against the allowlist before it is executed. `MCP_ALLOW_MUTATIONS=false` turns off all device changes.

## API Endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST /api/chat` | Streaming text chat with Home Assistant tools and tool approvals |
| `POST /api/mcp/discover` | Connection test; lists MCP tools with their allowlist classification |
| `POST /api/home/state` | Read-only area/entity snapshot from `GetLiveContext` |

The browser sends the MCP address in the JSON body and the stored credentials in the `x-openai-api-key` and `x-mcp-token` headers to this application's own server only.

## Local Development

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

The application runs at `http://localhost:5173` by default.

## Available Commands

```sh
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Test the production build locally
npm run check        # Svelte and TypeScript checks
npm run test         # Unit and E2E tests
npm run lint         # Prettier and ESLint checks
npm run format       # Format files
```

## Configuration

Copy `.env.example` to `.env`. All variables are optional and validated at server startup; invalid values stop the server with a message that names the variable without echoing its value.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | unset | Server fallback key when the browser has none |
| `OPENAI_TEXT_MODEL` | `gpt-6-astra` | Default text chat model |
| `MCP_ALLOW_PRIVATE_HOSTS` | `true` in dev, `false` in production | Allow loopback/private-network MCP hosts |
| `MCP_ALLOW_INSECURE_HTTP` | `true` in dev, `false` in production | Allow `http://` MCP addresses |
| `MCP_ALLOW_MUTATIONS` | `true` | Expose device-changing tools at all |
| `MCP_TIMEOUT_MS` | `15000` | MCP connection and tool-call timeout |
| `TOOL_APPROVAL_SECRET` | random per process | HMAC secret (≥ 32 chars) for signed tool approvals |
| `ALLOWED_ORIGINS` | none | Extra origins allowed to call `/api` |
| `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_MS` | `30` / `60000` | Per-client API rate limit |
| `REQUEST_TIMEOUT_MS` | `60000` | Maximum model request duration |
| `MAX_REQUEST_BODY_BYTES` | `1000000` | Maximum API request body |

Browser Storage keys are versioned under the `home-agent.` prefix: `home-agent.settings.v1`, `home-agent.confirmation-policy.v1`, and `home-agent.secrets.v1`.

## Testing Conventions

- **Unit tests:** `src/**/*.spec.ts` next to the module, run in Node (`npx vitest run --project server`). Keep logic in pure modules (for example `src/lib/config/settings.ts`, `src/lib/server/env-schema.ts`) so it can be tested without SvelteKit runtime imports.
- **Component tests:** `src/**/*.svelte.spec.ts`, run in Chromium via `vitest-browser-svelte` (`npx vitest run --project client`).
- **End-to-end tests:** `e2e/*.test.ts` with Playwright against the production build (`npm run test:e2e`).
- Never call real OpenAI, MCP, or Home Assistant services from automated tests; use mocks.
  - Chat tests drive `streamChat` with `MockLanguageModelV4` via `src/lib/server/chat/chat-test-helpers.ts`.
  - `src/lib/server/mcp/fake-ha-mcp-server.ts` is a fake Home Assistant MCP server (Streamable HTTP, token `e2e-mcp-token`) used by integration tests and, via `e2e/support/fake-mcp-server.ts`, by Playwright.
- Install browser binaries once with `npx playwright install chromium`.

## Known Start Requirements

- The previously exposed OpenAI key must be revoked and removed or replaced in the local configuration.