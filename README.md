# Home Agent

Home Agent is a SvelteKit smart-home application for controlling Home Assistant through natural language and text.

The application connects a text or GPT-Live chat interface with a server-side MCP gateway. Home Assistant is not addressed directly by the browser.

## Current Status

The project is in the planning and MVP start phase.

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
- Better Auth/SQLite is not required for the initial browser-first MVP.

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

## Known Start Requirements

- Replace the placeholder in `src/lib/server/db/auth.schema.ts` or generate the Better Auth schema file.
- Install the Playwright browser binaries for browser and Playwright tests:

```sh
npx playwright install
```

- The previously exposed OpenAI key must be revoked and removed or replaced in the local configuration.
