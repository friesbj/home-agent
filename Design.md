# Home Agent: Design Concept

## Status and Scope

This document is the evolving, project-wide foundation for Home Agent's design. It describes the design direction and implementation plan for [M2a](./Milestones.md#m2a---mobile-first-product-design); it does not imply that the design has already been implemented or visually approved.

New features should fit this shared product language. As requirements or insights change, evolve the concept deliberately rather than creating different visual styles for individual pages. Specific values are starting points to be verified during implementation against contrast, devices, and actual behavior.

M2a implementation status: the foundation, shell, Home dashboard, scene shortcuts, Assistant, onboarding, and Settings use this design system; no primary view keeps the earlier light style. The voice screen specification and the final cross-device validation are still open; see [Milestones.md](./Milestones.md#m2a---mobile-first-product-design). Decisions taken during implementation are recorded under [Resolved Design Decisions](#resolved-design-decisions).

The working application is the foundation, not a throwaway prototype. Preserve its architecture, data flows, security, and core functionality. This document does not authorize implementation: the immersive voice screen is a concept here; actual voice functionality belongs to M3.

## Visual Reference

The user supplied [a mobile reference screen](./docs/design/reference-mobile-home.png) as the model for the entire design milestone. It defines the intended taste: mood, color, surfaces, the orb, layout rhythm, and navigation.

What it shows, top to bottom:

- a header with a logo mark, product name, subtitle, and a rounded-square notification button;
- a large greeting ("Good evening, John") with a one-line status sentence;
- a wide hero card with a glowing network sphere and "Talk to your home";
- a two-column row of device cards: Lights with counts and a switch, Climate with a temperature;
- a "Scenes" section header with "See All" and four icon tiles, one highlighted;
- a hint line ("Tap the mic to start voice mode") above a bottom navigation bar with Home, Settings, and a large glowing orb docked in the center.

How to use it:

- It is the reference for **visual language and layout**, not a functional specification. Where it shows capabilities the product does not have, follow [Reference to Product Mapping](#reference-to-product-mapping).
- Do not adopt its product name or logo; the product is Home Agent. Build all visual assets originally in code; the reference image is documentation and is never shipped in the application.
- When a design question is not answered in this document, prefer the solution closest to the reference that still satisfies the safety and accessibility rules below.

## Product Idea: Ambient Home

Home Agent should feel like a calm, intelligent center for the home: modern, elegant, and slightly magical, but never playful or cluttered. A deep navy environment, soft fields of blue and violet light, and translucent cards create depth; one glowing orb gives the assistant a presence.

**Design principles**

1. **One product, multiple contexts:** Home, Assistant, onboarding, Settings, and later Voice share colors, surfaces, states, and interaction patterns.
2. **Glance first, then ask:** The start screen answers "how is my home?" at a glance and offers one obvious way to ask for more.
3. **The orb is the assistant:** One signature element represents the assistant everywhere. It is never used as decoration for unrelated content.
4. **Mobile first:** The most important tasks are reachable with one thumb on small screens. Tablet and desktop use additional space purposefully rather than merely scaling up.
5. **Calm over decoration:** Light, depth, and motion guide attention intentionally; they do not compete with text, device status, or decisions.
6. **Trust through clarity:** Read-only information and changes are explicitly distinguishable. Progress, errors, and unknown outcomes are not presented as success. The interface never shows a control, state, or claim the product cannot back up.
7. **Accessibility is part of the aesthetic:** Visible focus states, contrast, readable type, adequate touch targets, and reduced motion are essential properties.

## Starting Point Before M2a

This section records the state M2a started from; it no longer describes the current interface.

This assessment is based on code analysis, not a new visual inspection on real devices:

- The [home page](./src/routes/+page.svelte) shows chat and the home overview side by side on large screens; on mobile they are stacked, and chat receives `75dvh`. Many rooms create a long page flow. There is no navigation bar; Settings is a text link.
- [ChatPanel](./src/lib/components/ChatPanel.svelte) provides sessions, input, streaming, tool calls, and confirmations. It cancels in-progress work when it is unmounted. [MarkdownMessage](./src/lib/components/MarkdownMessage.svelte) renders Markdown safely; user messages remain plain text.
- `HomeOverview` (now [RoomList](./src/lib/components/RoomList.svelte), with fetching moved to [HomeView](./src/lib/components/HomeView.svelte)) lists rooms and entities from one fetch, with manual refresh, collapsible rooms, favorite prioritization, and a timestamp. Entities carry a name, domain, state, areas, and attributes such as `current_temperature`; there are no entity IDs.
- All device changes run through the chat endpoint with server-side policy and approval. There is no endpoint for direct device actions outside the conversation.
- Onboarding and Settings share [SettingsForm](./src/lib/components/SettingsForm.svelte). The many technical fields are presented in sequence with largely equal emphasis. There is no setting for the user's name.
- [ToolCallCard](./src/lib/components/ToolCallCard.svelte) already distinguishes read and change calls and their execution states.
- [layout.css](./src/routes/layout.css) imports Tailwind and its forms and typography plugins; there is no shared token system. Components use individual light Stone classes.
- Voice is not yet available. The existing text chat must remain usable during M3.

## Visual System

### Background and Light

The background is a deep navy base with two or three large, soft fields of light: a blue-violet arc in the upper right and a wide, low arc above the navigation. These are static CSS gradients fixed to the viewport, not images. They stay low in contrast so that any text placed over them remains readable.

### Color

The values below were sampled from the reference image and are starting points. Semantic roles matter more than individual values; verify every text and control combination in the real rendering.

| Role                       | Starting value                   | Use                                                     |
| -------------------------- | -------------------------------- | ------------------------------------------------------- |
| Background                 | `#0B142D` to `#0D193E`           | Navy base, slightly lighter toward the top              |
| Ambient light              | `#8B89FC` at its brightest point | Peak of the background light fields; fades to the base  |
| Glass surface, violet tint | `#22254D`                        | Resulting color of resting cards and tiles              |
| Glass surface, blue tint   | `#142241`                        | Alternative card tint, as on the reference Climate card |
| Selected surface           | `#303172`                        | Selected or pressed tile                                |
| Bar surface                | `#131A38`                        | Bottom navigation and other docked bars                 |
| Hairline border            | `#5B7DD3` at low opacity         | Luminous edge of cards                                  |
| Selected border            | `#5A50C6`                        | Edge of selected elements, with a soft outer glow       |
| Primary accent             | `#7664FC`                        | Switches, selection, primary interactive elements       |
| Accent text                | `#9076FA`                        | Links such as "See all", active navigation              |
| Primary text               | `#FCFCFF`                        | Content, labels, key status                             |
| Secondary text             | `#A6B7E7`                        | Supporting information                                  |
| Cool accent                | cyan, near `#5CD0FF`             | Orb points, climate icon                                |
| Warm accent                | amber, near `#F5B556`            | Light and morning icons                                 |

The cool and warm accent values are estimates by eye; their icons are too thin to sample reliably.

Preliminary contrast calculations from these samples: secondary text reaches about 7:1 on the resting card and about 5.8:1 on the selected surface; accent text reaches about 5.3:1 on the background. White text on a solid primary-accent fill reaches only about 4.2:1, below the 4.5:1 target, so filled primary buttons need a slightly darker fill or large, bold labels. Recalculate with the final tokens.

Define separate semantic tokens for success, warning, error, and neutral information. Color is never the only distinguishing feature. Because amber is also the domain color for lights, a warning is always identified by its icon, label, and surface treatment, never by amber alone.

### Surfaces

Translucent "glass" cards are the signature surface, as in the reference. Three levels keep them consistent and safe:

1. **Glass card:** a low-opacity tint over the background, a subtle top-to-bottom gradient, a one-pixel luminous hairline border, and a large radius. Used for summaries, tiles, navigation, and sections.
2. **Selected glass:** the selected surface color, the selected border, and a soft outer glow. Used for the current selection or an element being pressed.
3. **Solid surface:** nearly opaque. Used wherever a decision or precise reading matters: confirmations, errors, form inputs, tool results, and code.

Rules:

- The background behind cards is a controlled gradient, so a glass card has a predictable contrast floor. Test text against the brightest light field a card can sit on.
- Use real backdrop blur only for surfaces that float above scrolling content: the bottom navigation, sticky headers, and sheets. Cards on the static background use plain translucent fills, which look the same and cost less on mobile devices. Provide a more opaque fallback where backdrop blur is unavailable.
- Cards may carry a subtle tint: violet by default, blue as an alternative. Tint is decoration and never encodes meaning on its own.

### Glow

Glow is a budget, not a default. Each view has at most one primary glow source, the orb, and one selection glow. Background light fields are ambient. Cards do not glow at rest. Errors, warnings, and confirmations never use decorative glow.

### Typography

The reference uses a geometric, slightly rounded sans-serif that gives the product much of its character. Use a self-hosted variable font of that kind with a system sans-serif fallback; do not load fonts from a third-party network. Candidates under an open license are Plus Jakarta Sans, Figtree, and Outfit; choose one in the foundation step by comparing it with the reference at mobile widths. Reserve monospace for code and technical details.

| Style         | Starting size                   | Use                                 |
| ------------- | ------------------------------- | ----------------------------------- |
| Display       | 28 px, semibold                 | Greeting                            |
| Lead          | 18 px, regular, secondary color | Status sentence under the greeting  |
| Section title | 18 px, semibold                 | "Scenes", "Rooms"                   |
| Card title    | 17 px, semibold                 | "Lights", "Ask your home"           |
| Body          | 16 px                           | Messages, form fields, descriptions |
| Secondary     | 14 px                           | Card details, hints                 |
| Caption       | 13 px minimum                   | Timestamps, tile labels             |

Secondary information remains readable and is not pushed into the background solely through low contrast.

### Shape and Spacing

- Use a 4-px spacing grid: a 16 to 20 px screen gutter, 16 to 20 px card padding, 12 to 16 px between cards, and 24 to 32 px between sections.
- Radii: about 12 px for inputs and icon wells, 16 px for tiles and small cards, 20 to 24 px for wide cards and panels, 28 px for the top corners of the navigation bar, and fully rounded switches and pills.
- An **icon well** is a rounded-square, tinted container of at least 40 px that holds a domain icon, as on the reference Lights and Climate cards.
- Interactive elements are at least 44 by 44 CSS px, even where the reference draws them smaller.

### Iconography

Use one outline icon set with rounded caps and a consistent stroke of about 1.75 px at 24 px. Lucide is the candidate; add it when the first slice needs it and import icons individually.

- Domain icons carry an accent color: amber for lights, cyan for climate, violet for scenes and night.
- Navigation icons are neutral; the active destination uses a filled icon, the accent color, its label, and an underline indicator.
- Colored icons reinforce meaning. Every icon that conveys status or triggers an action has a text label or an accessible name.

### Motion

Transitions support orientation and feedback: about 150 to 250 ms for state changes, expanding sections, and focus. The orb is the only element with continuous motion, and only while it is the focus of the view. Respect `prefers-reduced-motion` by reducing or removing animation; all information and states remain understandable without motion.

## The Orb

The orb is a sphere of connected points of light, cyan-white at its points and blue to violet at its rim, with a soft outer glow. It is the product's signature and stands for the assistant.

- **Where it appears:** small in the assistant entry card on Home, medium as the docked center button of the mobile navigation, prominent in the empty desktop Assistant, compact in the Assistant header during a conversation, and large as the focus of the future voice mode.
- **One component:** a reusable `AssistantOrb` with size and state properties. Generate it in code, for example by distributing points on a sphere, projecting them, and connecting near neighbors, rendered as SVG or canvas. Do not trace or embed the reference image.
- **Hierarchy:** at most one orb is animated per view. On Home, the navigation orb is the live one; the orb in the entry card is a static illustration.
- **States:** idle is a slow rotation or gentle breathing. Voice states in M3 build on the same component. With reduced motion it is a static render.
- **Honest affordance:** until M3 the navigation orb opens the text assistant, so it shows an assistant glyph rather than a microphone, and the hint above it reads "Ask your home" rather than "Tap the mic to start voice mode". The microphone and the voice hint appear only when voice works.
- **Accessibility:** the orb button has an accessible name describing what it opens and a visible focus indicator that does not rely on its glow.

## Information Architecture

### Navigation

The product has three destinations: **Home** (start), **Assistant**, and **Settings**.

On mobile, a bottom navigation bar shows Home on the left and Settings on the right. The orb sits in the center, raised above the bar, which curves around it. The bar respects the bottom safe area and uses backdrop blur over scrolling content.

Assistant opens from the orb and from the entry card on Home. It is a full-height view without the bottom bar, with a clear way back to Home, so that the composer has room and nothing competes with the conversation. Voice mode in M3 uses the same pattern.

Switching between Home and Assistant must not lose or restart an active response, the current conversation, or a pending approval. ChatPanel currently cancels in-progress work when it is unmounted, so the shell has to keep the conversation alive across these two views, for example by keeping it mounted or by moving its lifecycle into the shell. Decide the technical shape, route or in-page view, in the shell slice. Navigating to Settings keeps today's behavior unless it is changed deliberately.

### Home

Home follows the reference from top to bottom:

1. **Header:** product mark, "Home Agent", and a compact subtitle with the connection name. An activity button sits on the right; see [Activity](#activity).
2. **Greeting:** a time-of-day greeting with the optional display name from Settings, and a status sentence. The sentence is derived only from fetched data, for example "5 lights on · 21.5 °C in the living room", "Everything is off", or "Could not reach your home". It never states an unconditional judgment such as "Your home is looking great". The time of the last update and a labeled refresh control sit nearby.
3. **Assistant entry card:** the orb, "Ask your home", and one supporting line. It opens Assistant. In M3 it also offers voice.
4. **Domain summary cards:** a two-column row. Lights shows how many are on and off. Climate shows the current temperature, or a range when several climate devices are exposed. Both are read-only summaries with a chevron that opens the matching devices. They show no switch in M2a.
5. **Scenes:** a section header with "See all" and a horizontally scrolling row of icon tiles for exposed scenes. Each tile is an [assistant shortcut](#assistant-shortcuts). The section is hidden when no scenes are exposed.
6. **Rooms:** the existing collapsible room list in the same section pattern, favorites first, collapsed by default. It keeps its behavior with many rooms and repeated entity names.
7. **Hint and navigation:** the hint line and the bottom bar with the orb.

Summaries are pure functions over the fetched home state and are covered by unit tests. Home reflects one fetch: it never suggests a live connection, which arrives with M4.

### Assistant Shortcuts

A shortcut is a tile or chip that asks the assistant to do something. This is how Home offers actions in M2a without a new action path.

- A shortcut submits a fixed, visible request, such as activating a named scene, through the same conversation path as a typed message, and opens Assistant so the outcome is visible.
- The request passes through the existing server-side policy and confirmation. A shortcut never bypasses or pre-approves a confirmation.
- Because the assistant interprets the request, the tile does not claim success. The result appears in the conversation as a tool card.
- Shortcuts are disabled, with an explanation, while a response is in progress or a confirmation is pending.
- Home Assistant scenes have no on or off state, so a scene tile has no persistent "active" look. The highlighted tile in the reference is used only as pressed or in-progress feedback.

Direct switches and one-tap actions outside the conversation, including the Lights switch in the reference, belong to M4 quick actions. A switch for all lights changes several devices at once and will require confirmation according to the policy.

### Assistant

The conversation is the visual priority: glass message surfaces for the assistant, accent-tinted bubbles for the user, and a composer docked above the keyboard and the bottom safe area. Send and Stop are round, icon-only 44 px buttons with the accessible names "Send" and "Stop", so the composer keeps its width on small screens. The header shows a small orb, the conversation selector, and "New chat". Empty, waiting, streaming, interrupted, and error states have clear labels.

On desktop, the empty conversation gives the orb a prominent central position in the Assistant panel, alongside the existing suggestions. Once a conversation contains messages, the orb remains visible in a compact header so that messages, tool activity, confirmations, and the composer have priority. Switching between these presentations must not create a new chat or interrupt the current one. The orb must not imply voice, listening, or activity that is not actually available.

Markdown remains safely processed. Tables and long code blocks scroll horizontally within their own area and never displace the composer. Preserve saved conversations, session switching, cancellation, and warnings about unknown action outcomes.

### Tools and Confirmations

Read-only calls carry a clear category such as "Read"; state changes are labeled "Change". The tool card communicates progress and outcome, with technical details available when needed.

Confirmations use the solid surface. The action and its targets take priority; "Approve" and "Deny" are clearly distinguishable and touch-friendly. Pending, denied, failed, and interrupted actions must not look like completed ones. Visual changes must not weaken server-side authorization, the allowlist, or the existing approval flow.

### Activity

The header button on Home is the place for things that need attention. In M2a it shows an indicator when the conversation has a pending confirmation or an interrupted action, and opens Assistant at that point. Full action history arrives with M4. If the indicator cannot be built without changing chat behavior, leave the button out; the interface has no decorative controls.

### Onboarding and Settings

Both share form language and behavior. Sections are glass cards; inputs use the solid surface. Onboarding leads with connection and safety, followed by preferences; technical details remain accessible without giving all information equal emphasis. A step-by-step presentation is appropriate only if all existing options, validations, and a clear way back are preserved.

**Minimal by default (user requirement):** getting started must feel effortless. The form shows one "Connect your home" section with only three fields, the server address, the access token, and the OpenAI API key, plus "Test connection" and a one-line summary of the active confirmation rule, so safety stays visible. Everything else sits in a collapsed "Advanced settings" disclosure in this order: Profile, confirmations, voice and models, favorites and history, connection details (transport, display name, authentication), and the optional Home Assistant WebSocket settings. A validation error inside the collapsed section opens it and focuses the field. New setups default to bearer authentication, because the Home Assistant MCP integration requires a long-lived access token. On the Settings page, stored credentials, history deletion, and reset sit in a collapsed "Data and privacy" disclosure. The Browser Storage notice stays visible, in short form. New options go into Advanced settings unless every user needs them to start.

Settings groups connection, models and voice, confirmations, favorites, history, and a profile section with the optional display name. The name is stored with the browser settings and used only for the greeting. Browser Storage and credential notices, connection testing, field errors, and storage status remain visible. Delete and reset actions are spatially and verbally distinct from ordinary settings and keep their explicit confirmation.

### Tablet and Desktop

Home and Assistant sit side by side, each scrolling independently, with the composer always visible; the existing viewport-bound behavior with `min-h-0` is preserved. Because Assistant is always visible, shortcuts act on it in place. Navigation moves from the bottom bar to a slim rail or header. The Assistant's empty-state orb is a central visual focus; during a conversation it becomes a compact header presence. Onboarding and Settings use a limited reading width.

## Reference to Product Mapping

| Reference element                                    | In Home Agent                                                        | When                           |
| ---------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------ |
| "HomeAI" name and logo                               | "Home Agent" and an original mark                                    | M2a                            |
| Notification button with dot                         | Activity indicator for pending confirmations and interrupted actions | M2a if feasible; history in M4 |
| "Good evening, John"                                 | Time-of-day greeting with the optional display name                  | M2a                            |
| "Your home is looking great."                        | Status sentence derived from fetched data                            | M2a                            |
| "Talk to your home" card                             | Assistant entry: text in M2a, voice added in M3                      | M2a, M3                        |
| Lights card with switch                              | Read-only counts in M2a; direct switch with confirmation             | M2a, M4                        |
| Climate card                                         | Read-only current temperature or range                               | M2a                            |
| Scene tiles                                          | Assistant shortcuts through the existing confirmation                | M2a                            |
| Highlighted scene tile                               | Pressed or in-progress feedback only                                 | M2a                            |
| "Tap the mic to start voice mode" and microphone orb | "Ask your home" with an assistant glyph until voice works            | M2a, M3                        |
| Home and Settings tabs with center orb               | Adopted as shown                                                     | M2a                            |
| No rooms and no chat on the screen                   | Rooms section on Home; chat as the Assistant view                    | M2a                            |

## Future Voice Mode

Voice should feel **present and focused**, as if the assistant is attentive in the room, without pretending to be human or implying unwarranted safety.

### Layout

- Entering voice mode, the orb grows from its current navigation or Assistant position to the center of the screen while surrounding panels and navigation fade out.
- Top: connection and microphone status and a way to leave.
- Center: the large orb on the calm background. It never dominates a warning.
- Bottom: microphone control, text fallback, and relevant actions. Tool activity and confirmations appear on a solid, clearly bounded surface.
- Live captions of what is heard and said appear below the orb and can be hidden. They are the text equivalent of the conversation and are not stored unless transcript retention is enabled.

### States and Transitions

| State                 | Visual direction                                                      | Clear feedback                                |
| --------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| Ready / listening     | Calm orb, subtle motion                                               | Microphone and listening status in text       |
| Speaking              | Gentle speech-reactive motion, only when real audio data is available | Assistant is speaking                         |
| Thinking / delegation | Slow, restrained motion                                               | Task is being processed                       |
| Tool use              | Compact activity strip                                                | Read or change call and progress              |
| Confirmation          | Orb recedes; the card takes priority                                  | Action, targets, Approve and Deny             |
| Error / disconnection | Calm state without a misleading activity glow                         | Cause where known, reconnect or text fallback |

Full duplex permits overlapping states: listening, speaking, and delegated backend work must not be modeled as mutually exclusive. Microphone status must match the actual permission state. With reduced motion the orb is static and states are conveyed in text. No animation simulates unavailable audio or connection data.

## Technical Direction

- Introduce semantic tokens and Tailwind 4 theme mappings for color, typography, spacing, radii, focus, and motion in [layout.css](./src/routes/layout.css). Components use roles such as glass surface or warning rather than one-off values.
- Keep the existing Tailwind forms and typography plugins; verify dark styles for inputs and Markdown deliberately.
- New dependencies are limited to what the design needs: one self-hosted font and one icon set. Add each in the slice that first uses it.
- Add a way to submit a request to the active conversation from outside ChatPanel for shortcuts. M2a adds no server endpoints and no direct device actions.
- Keep presentation changes separate from MCP, chat sessions, and server-side security.
- Prefer evolving existing components. Extract a shared pattern only when it clearly reduces duplication. Expected shared building blocks: app shell and navigation, orb, glass card and solid panel, section header, icon well, summary card, tile, button and link variants, form field, status badge and notice.

## M2a: Incremental Rollout

1. **Foundation:** tokens, background, font, glass and solid surfaces, focus and status styles, buttons, the icon set, and the orb.
2. **Shell and Home:** bottom navigation with the orb, the Home, Assistant, and Settings structure, and the Home dashboard with greeting, status, entry card, summaries, scene shortcuts, and rooms.
3. **Assistant:** conversation, session selection, Markdown, tool cards, and confirmations in the new language.
4. **Onboarding and Settings:** forms, warnings, safeguards, and the optional display name.
5. **Voice concept:** refine states and transitions; voice itself is implemented in M3.
6. **Acceptance:** preserve existing behavior and security tests and extend them for layout, accessibility, and states.

Develop M2a on a feature branch and do not merge a state in which primary views mix the old light style and the new dark one.

### Recommended First Implementation Step

Build the foundation and render it as the top of the reference screen: tokens, background, font, glass card, orb, and bottom navigation on Home, with existing behavior untouched. This is the earliest point at which the design can be judged against the reference. Starting points are [layout.css](./src/routes/layout.css), the [root layout](./src/routes/+layout.svelte), the [home page](./src/routes/+page.svelte), and new shared components under `src/lib/components`, along with affected tests.

## Design Requirements for Later Milestones

Later milestones add capabilities to the views that M2a designs. They extend the existing patterns and do not introduce new card styles, colors, or navigation.

### M3: Voice

- Voice mode implements [Future Voice Mode](#future-voice-mode) inside the Assistant view; text and voice are two modes of one assistant with a visible switch between them.
- When voice works, the navigation orb shows the microphone, the hint reads as in the reference, and the Home entry card offers voice.
- Confirmations in voice mode use the same solid confirmation card as text. Until the product decides otherwise, approval requires the on-screen control.

### M4: Live Data and Direct Control

- **Live status:** a labeled live indicator replaces the fetch time and manual refresh. When the connection drops, Home shows the time of the last known state and that it is reconnecting; stale data is never presented as live.
- **Quick actions:** a switch or tile shows a pending state until the server reports the outcome and returns to its previous state on failure, with the reason. It does not stay flipped on an unconfirmed change.
- **Confirmation outside the conversation:** actions that require confirmation open a sheet on the solid surface with the action, the targets, the number of affected devices for group actions, and Approve and Deny.
- **Activity:** the header button opens a list of recent actions with time, the Read or Change category, target, and outcome, using the vocabulary of the tool card. It shows no secrets.
- **Favorite entities:** shown on Home with the existing summary-card or tile patterns.

### M5: Accounts and Hardening

- Login and session-expiry screens use the onboarding form language and the solid surface for credentials.
- When secrets move to the server, credential fields and the Browser Storage notices in onboarding and Settings change accordingly.
- The application loads its font and icons from its own origin, so a strict Content Security Policy remains possible.

## Resolved Design Decisions

These questions were open in the plan and were decided during M2a implementation:

- **Font:** Plus Jakarta Sans, self-hosted through `@fontsource-variable/plus-jakarta-sans` with a system sans-serif fallback.
- **Icons:** Lucide (`@lucide/svelte`) covers every icon so far, imported individually. `DomainIcon` maps domains to an icon and accent color; unknown domains use a neutral power icon.
- **Scene icons:** fetched scenes carry only a name, so every scene tile uses the same scene icon. Per-scene icons would need data the product does not have.
- **Climate summary:** one reading shows its value and area; several readings show the range and the number of devices. Climate devices without `current_temperature` are counted but never shown as a value.
- **Activity indicator:** not shipped in M2a. The header has no activity button rather than a decorative one; Home's scene hint and the disabled tiles already say when a confirmation is pending. The Activity view arrives with M4.
- **Assistant placement:** an in-page view on `/`, not a route. Home and Assistant both stay mounted and the inactive one is hidden on mobile, because unmounting `ChatPanel` cancels running work.
- **Hint line and "See all":** the label "Assistant" under the navigation orb replaces the reference's separate hint line, and the scene row scrolls horizontally on mobile and wraps on desktop instead of linking to a "See all" page.
- **Summary cards:** the chevron on Lights and Climate filters Rooms to that domain, with a visible "Showing … only" status and a "Show all devices" control.
- **Shortcut gating:** shortcuts are disabled while a session switch, a response, or a pending confirmation is in progress, and the reason is shown under the Scenes heading. Typed messages keep their previous behavior.
- **Danger zone:** delete and reset actions sit in a separate "Delete and reset" section, outlined in the danger color at rest; only the explicit confirmation step uses a filled destructive button.

## Quality and Acceptance Criteria

- Compare Home with the reference at 384 to 430 px width; mood, hierarchy, and rhythm should match.
- Check layouts from 320 px through desktop, including 200% zoom, many rooms, many scenes, long names, long messages, tables, and code blocks. Composer, navigation, and confirmations remain usable.
- Target at least 44 by 44 CSS px for touch targets, visible focus indicators, and full keyboard operation.
- Contrast targets: at least 4.5:1 for normal text and 3:1 for controls and state indicators, measured on glass surfaces over the brightest background region and including focus states.
- Check screen-reader labels, status messages, and focus management; information is not conveyed exclusively through color, position, or animation.
- Account for reduced motion, loading and error states, the on-screen keyboard, and safe areas. Check scrolling and animation smoothness on a mid-range phone.
- Test existing chat, history, settings, and approval workflows with mocks, and verify that shortcuts go through the confirmation flow. Do not run real smart-home actions in automated tests.
- Visual acceptance covers coherent views and states, not just isolated components.
