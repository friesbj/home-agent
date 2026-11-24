# Home Agent: Design Concept

## Status and Scope

This document is the evolving, project-wide foundation for Home Agent's design. It describes the design direction and implementation plan for [M2a](./Milestones.md#m2a---mobile-first-product-design); M2a implemented it and the user accepted it on real devices on 2026-11-24; later milestones extend it.

New features should fit this shared product language. As requirements or insights change, evolve the concept deliberately rather than creating different visual styles for individual pages. Specific values are starting points to be verified during implementation against contrast, devices, and actual behavior.

M2a status: complete. The foundation, shell, Home dashboard, scene shortcuts, Assistant, onboarding, and Settings use this design system, no primary view keeps the earlier light style, the voice screen is specified, and the design was validated by automated checks and accepted by the user on real devices; see [Milestones.md](./Milestones.md#m2a---mobile-first-product-design). Decisions taken during implementation are recorded under [Resolved Design Decisions](#resolved-design-decisions).

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
- Scrollbars are slim (6 px, `scrollbar-width: thin`), with a transparent track and a translucent violet thumb (`accent-ink` at 35 %, 55 % on hover), defined globally in `layout.css`.

### Iconography

Use one outline icon set with rounded caps and a consistent stroke of about 1.75 px at 24 px. Lucide is the candidate; add it when the first slice needs it and import icons individually.

- Domain icons carry an accent color: amber for lights, cyan for climate, violet for scenes and night.
- Navigation icons are neutral; the active destination uses a filled icon, the accent color, its label, and an underline indicator.
- Colored icons reinforce meaning. Every icon that conveys status or triggers an action has a text label or an accessible name.
- **App icon:** the orb, simplified for small sizes (three outlines, six nodes, brighter sphere) so that it stays recognizable at 16 px. `static/favicon.svg` is the source; `favicon.ico` (32 px) and `apple-touch-icon.png` (180 px, on the app background because iOS fills transparency with black) are rendered from it. `theme-color` is the app background `#0b142d`. When the orb changes, update the favicon too.

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

On mobile, a bottom navigation bar shows Home on the left and Settings on the right, as icons without labels; each has an accessible name and a pressed or current state. The orb sits in the center, raised above the bar, which curves around it. The bar respects the bottom safe area and uses backdrop blur over scrolling content.

Assistant opens from the orb and from the entry card on Home. On mobile it fills the screen, the page header shrinks to a small Home icon overlay, and the navigation bar stays so that Home is one tap away. The voice stage in M3 is different: it is an immersive full-screen mode without the bar; see [Future Voice Mode](#future-voice-mode).

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

The conversation is the visual priority: glass message surfaces for the assistant, accent-tinted bubbles for the user, and a composer docked above the keyboard and the bottom safe area. The composer is a single field with Send and Stop as round, icon-only 40 px buttons inside it, at the bottom right, with the accessible names "Send" and "Stop"; the field grows with its text up to about 160 px. On mobile, the Assistant uses the full screen width without a card border, and the page header shrinks to a transparent Home icon overlay so that messages get the space. The header shows a small orb (tablet and desktop), the conversation selector, and "New chat". Empty, waiting, streaming, interrupted, and error states have clear labels.

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

Voice should feel **present and focused**, as if the assistant is attentive in the room, without pretending to be human or implying unwarranted safety. It is a mode of the Assistant, not a separate app: text and voice share one conversation, one confirmation path, and one visual language, with a visible switch between them.

This section is a specification. Actual voice (WebRTC, GPT-Live, delegation) is implemented in M3; nothing here may appear in the product before it works.

### Reference Input

The user supplied an external UX workspace with a clickable voice simulation and two reference images. Its findings are adopted where they fit the product; the workspace itself is a design tool and may disappear, so the decisions are recorded here.

- **The simulation:** a centered card with an eyebrow, the title "Home Agent Live", a large orb, a status word, two equal buttons (mute, end), a text link back to the text assistant, and a close button. It has seven states: ready, connecting, listening, responding, muted, approval, and error. The approval state shows a solid card with the action, its scope, and two buttons below the orb. A first screen lets the user pick a voice before the simulation starts. A state selector, which is a prototyping aid, drives everything, and the microphone is never used.
- **The orb reference:** a blue wireframe sphere of connected nodes. It confirms the direction in [The Orb](#the-orb): a sphere of points and neighbor links, generated in code.
- **The chat reference:** a large rounded composer with an icon-only circular send button, a soft colored glow along its bottom edge, message bubbles of graded dark surfaces, and small action chips (Copy, Edit) under messages. The composer and icon-only send button already match; the other two ideas are listed under [Open Design Questions](#open-design-questions).
- **The workspace roadmap:** acceptance for the voice step requires that states are understandable and that focus returns to the trigger on close; acceptance for M3 requires permission, cancellation, reconnection, and server-validated device confirmation to be tested with mocks. Both are reflected below and in M3.

| Prototype                                               | Product decision                                                                                                                            | Why                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Eyebrow "SIMULATION · VOICE"                            | "Live conversation"                                                                                                                         | The product is not a simulation.                                                             |
| "Muted" is a state and also the name of the mute button | Mute is a property of the microphone, shown by an always-visible indicator; the button reads "Turn microphone off" and "Turn microphone on" | The assistant can speak while muted; a name that is both a state and an action is ambiguous. |
| Listening and responding pulse identically              | Distinct motion for listening, speaking, and thinking; amplitude only from real audio levels                                                | The motion must tell the states apart and must never fake audio.                             |
| No thinking or tool state                               | Added: thinking and delegation, tool use                                                                                                    | GPT-Live delegates work to a backend model that uses tools.                                  |
| Three exits (close, end, back to text)                  | Two: End and Back to text                                                                                                                   | Fewer, clearer choices.                                                                      |
| Voice picker before the simulation                      | The voice stays in Settings under Advanced; first use shows the current voice and a link to change it                                       | Starting must need as few decisions as possible.                                             |
| Modal card on every screen size                         | Full screen on mobile; centered panel over the dimmed app on larger screens                                                                 | Immersion on small screens, orientation on large ones.                                       |
| Same orb brightness when muted                          | Muted dims and desaturates the orb and marks it with a slashed microphone                                                                   | Mute must be visible at a glance.                                                            |

### Entry, First Use, and Exit

- **Entry points:** the navigation orb (which shows a microphone once voice works), the voice offer in the Home entry card, and a Text/Voice switch in the Assistant header. All of them open the same stage.
- **First use:** if the microphone permission is not granted, or no OpenAI key is available, the stage opens on a single setup screen instead of connecting. It states in two sentences what happens (audio goes to the model provider through this application's server, only while the stage is open, and transcripts are not stored unless the user enabled it), shows the current voice with a link to Advanced settings, and offers one primary button, "Allow microphone". The browser prompt is triggered by that button, as browsers require. Once permission exists, tapping the orb connects immediately.
- **Permission denied:** the stage shows "Microphone blocked", a short note on how to allow it in the browser, and "Back to text". Text chat stays fully usable.
- **End:** stops the session and releases the microphone, and the stage stays open in the Ready state so that one tap starts again.
- **Back to text:** leaves the stage. A running session ends first. Escape does the same. A pending confirmation is cancelled and marked as interrupted, exactly like the existing text behavior when the conversation is left.
- **Focus:** opening the stage moves focus to the primary control of the current state; closing it returns focus to the element that opened it, or to the Assistant heading if that element no longer exists.
- **Microphone lifetime:** the microphone is captured only while a session runs. Closing the stage, ending the session, and navigating away release it. Whether a session continues when the tab is hidden is an open decision.

### Layout

Mobile is full screen, respects the top and bottom safe areas, and hides the navigation bar. Tablet and desktop use a centered panel of about 560 px over the dimmed app; the app behind it stays mounted but inert, and the panel is a modal dialog with a focus trap. The content is one column on every size, top to bottom:

1. **Header:** the eyebrow "Live conversation", the title "Home Agent", and a microphone chip that always states whether the microphone is on or off. Next to them sits the Back to text control, at least 44 by 44 px.
2. **Orb:** the focus. About 60 % of the width on mobile, between 180 and 320 px; on viewports shorter than 600 px it shrinks to 140 px. While a confirmation is open it recedes to about 96 px.
3. **Status:** one word in 19 to 20 px semibold in the primary text color, in a polite live region, with one line of secondary text below it. The color is the same in every state, so the state is always carried by the word.
4. **Captions:** the last heard and last spoken sentences, up to three lines on mobile and more on desktop, with a Hide captions control. Captions are not announced by screen readers, to avoid speaking over the assistant.
5. **Activity strip:** shown during delegation and tool use, in the vocabulary of the tool card: "Read" or "Change", the target, and progress.
6. **Confirmation card:** on the solid surface, between the orb and the controls, only while a confirmation is pending.
7. **Controls:** in the lower, thumb-reachable area, two equal-width buttons with icon and label, "Turn microphone off/on" and "End", each at least 44 px high. "Back to text" sits below them as a text button.

In landscape on a phone (width greater than height and height below 500 px) the orb moves to the left and the status, captions, and controls to the right.

### States and Transitions

The status word shows the dominant conversation state. The microphone chip and the orb treatment show the microphone separately, so "Speaking" and "Microphone off" can be true at once. Full duplex permits listening, speaking, and delegated work to overlap: when they do, the status shows the highest of the priority order below and the others appear as chips (for example "Working on it" while the assistant speaks).

Priority: Error, Confirmation, Speaking, Thinking, Listening, Connecting, Ready.

| State                 | Real signal                                                 | Orb                                                                               | Status and detail                                              | Controls                                   |
| --------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| Ready                 | No session                                                  | Static, dimmed                                                                    | "Ready"                                                        | Start conversation (primary), Back to text |
| Needs microphone      | Permission not granted or an unanswered prompt              | Static, dimmed                                                                    | "Microphone access needed"                                     | Allow microphone (primary), Back to text   |
| Connecting            | Session creation and WebRTC negotiation in progress         | Slow indeterminate shimmer                                                        | "Connecting…"; after 15 s becomes Error                        | End                                        |
| Listening             | Connected and the microphone is on                          | Slow, fixed-rate breathing; amplitude follows the real input level when available | "Listening"                                                    | Turn microphone off, End                   |
| Speaking              | Assistant audio is playing                                  | Motion follows the real output level; static breathing if no level is available   | "Speaking"                                                     | Turn microphone off, End                   |
| Thinking / delegation | A delegated backend task is running                         | Slow rotation, restrained                                                         | "Working on it…"; chip stays while the assistant speaks        | Turn microphone off, End                   |
| Tool use              | A tool call is running                                      | As in the state beneath it                                                        | Activity strip: Read or Change, target, progress               | Unchanged                                  |
| Confirmation          | The server issued an approval request                       | Recedes and dims                                                                  | "Waiting for your confirmation" and the card                   | Approve, Deny (card); End                  |
| Microphone off        | The audio track is disabled                                 | Dimmed, desaturated, slashed microphone mark                                      | Chip "Microphone off"; the status keeps the conversation state | Turn microphone on, End                    |
| Error / disconnected  | Connection lost, session expired, or microphone unavailable | Static, no glow                                                                   | "Connection lost" or the specific cause, one line              | Try again (primary), Back to text          |

Transitions:

- Opening: the stage fades in over about 200 ms and the orb scales from its origin (the navigation orb or the Assistant orb) to its stage position. With reduced motion it appears without movement.
- Connecting to Listening: the shimmer settles into breathing over about 400 ms.
- Confirmation: the orb recedes over about 250 ms while the card fades in; it returns when the decision is made.
- Error: the glow fades out; nothing pulses.

Rules:

- **Muting must mute.** The button disables the outgoing audio track, not just the visuals, and a test proves it.
- **No retry loops.** After a lost connection the product makes at most one automatic attempt, then shows Error with "Try again".
- **No faked signals.** The breathing means "connected and attentive", never "sound detected". Amplitude-driven motion exists only when real level data does.

### Confirmation in Voice

The assistant may announce that it needs a confirmation, but speaking "yes" does not approve anything; approval requires the on-screen buttons until the product decides otherwise (see M3).

- The card shows the question in plain words ("Turn on the living-room light?"), the Read or Change label, the targets and, for group actions, the number of affected devices, then **Approve** (primary) and **Deny** (secondary), each at least 44 px high.
- When the card appears, a polite announcement states the action, and focus moves to the card itself, which has an accessible name. Neither button is focused, so a stray Enter or Space cannot approve.
- The live model is instructed to say that a confirmation is waiting on screen.
- Approving, denying, ending the session, and leaving the stage all resolve the card; none of them leaves a stale confirmation behind.

### Orb Rendering for M3

`AssistantOrb` gains a `state` (`idle`, `connecting`, `listening`, `speaking`, `thinking`, `confirming`, `error`), a `muted` flag, and an optional `level` from 0 to 1. The static SVG remains the fallback.

- Generate points on a sphere (for example a Fibonacci distribution), project them with a light perspective, connect near neighbors, and draw on a canvas with the device pixel ratio capped at 2.
- Rotate slowly; displace points radially by `level` only when real data is passed in.
- Pause drawing when the tab is hidden; keep the frame cost low enough for a mid-range phone; fall back to the static SVG under `prefers-reduced-motion` or without canvas support.
- Colors stay as in [The Orb](#the-orb): cyan-white points and a blue to violet rim. Error draws no glow, and muted draws desaturated and dim.

### Captions and Transcripts

- Captions show the latest turns and can be hidden. They are the text equivalent of the conversation.
- Nothing is stored unless the user enabled transcript retention in Settings. Audio is never stored.
- Proposed, pending the user's decision: when retention is on, voice turns are added as text messages to the current chat session, so they appear in the Assistant and are removed by the existing "Clear chat history". When it is off, captions vanish with the stage.

### Accessibility

- The stage is a dialog with an accessible name, a focus trap, and inert content behind it; Escape leaves it.
- Every state has a text equivalent, and no state relies on color, position, or motion alone. The microphone chip makes the microphone state readable without sight.
- Touch targets are at least 44 by 44 px; the controls sit in the thumb zone; safe areas, the on-screen keyboard (not needed here), and landscape are handled.
- Reduced motion removes all orb animation; status text and chips carry the information.
- The product plays no interface sounds in M3.

### Prototyping Aid

A state gallery that renders the stage in every state from fixed data helps review and test the design before audio exists. It may be built as a development-only route that is excluded from production builds. It must never be reachable by users, and nothing in it may suggest that voice works.

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

- Voice mode implements [Future Voice Mode](#future-voice-mode), which is the complete specification of the stage, its states, first use, confirmations, captions, rendering, and accessibility. Text and voice are two modes of one assistant with a visible switch between them.
- When voice works, the navigation orb shows the microphone, the hint reads as in the reference, and the Home entry card offers voice.
- Confirmations in voice mode use the same solid confirmation card as text. Until the product decides otherwise, approval requires the on-screen control.
- Build the presentational stage and the orb states first, from fixed data, and review every state before audio is connected.

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
- **Danger zone:** delete and reset actions sit in a separate "Delete and reset" section, inside the collapsed "Data and privacy" disclosure and outlined in the danger color at rest; only the explicit confirmation step uses a filled destructive button.
- **Focus after view changes:** a control that hides its own view would drop focus to the page body. Opening the Assistant from the Home entry card moves focus to the composer; a scene shortcut moves it to the Assistant view, a programmatic-only focus target without a ring, so that screen readers continue in the conversation where the confirmation appears.
- **Long words and large text:** the shell sets `overflow-wrap: anywhere` and fieldsets may shrink, so long names, addresses, and words wrap instead of forcing horizontal scrolling. Rows of buttons and the chat header wrap when text is enlarged.
- **Form fields:** every `field` is at least 44 px high. In the composer, the textarea fills the whole 52 px field, so the entire field is the touch target, and the field draws the same 3 px focus ring as every other control.
- **Touch-target exception:** the composer's Send and Stop buttons stay at 40 px by the user's request. They sit inside a 52 px field with 6 px of space around them and exceed the WCAG 2.2 AA minimum of 24 px.

## Open Design Questions

These stay open until the user decides or the M3 work shows the answer:

- **Voice transcripts:** when retention is enabled, should voice turns be added as text messages to the current chat session (the proposal in [Captions and Transcripts](#captions-and-transcripts)), or kept separately?
- **Spoken approval:** may a spoken confirmation ever approve an action? Until decided, approval requires the on-screen control.
- **Hidden tab:** should a running voice session end when the tab has been hidden for a while (for example 60 seconds), or continue?
- **Voice samples:** should Settings offer a short sample of each voice? It needs an audio sample per voice and may cost provider usage.
- **Composer glow:** the chat reference has a soft colored glow along the composer's bottom edge. It could replace the plain focus treatment as the view's one selection glow, provided the focus outline stays visible.
- **Message actions:** small chips under messages (for example Copy) as in the chat reference; a candidate after M2a.

## Quality and Acceptance Criteria

- Compare Home with the reference at 384 to 430 px width; mood, hierarchy, and rhythm should match.
- Check layouts from 320 px through desktop, including 200% zoom, many rooms, many scenes, long names, long messages, tables, and code blocks. Composer, navigation, and confirmations remain usable.
- Target at least 44 by 44 CSS px for touch targets, visible focus indicators, and full keyboard operation.
- Contrast targets: at least 4.5:1 for normal text and 3:1 for controls and state indicators, measured on glass surfaces over the brightest background region and including focus states.
- Check screen-reader labels, status messages, and focus management; information is not conveyed exclusively through color, position, or animation.
- Account for reduced motion, loading and error states, the on-screen keyboard, and safe areas. Check scrolling and animation smoothness on a mid-range phone.
- Test existing chat, history, settings, and approval workflows with mocks, and verify that shortcuts go through the confirmation flow. Do not run real smart-home actions in automated tests.
- Visual acceptance covers coherent views and states, not just isolated components.

### Verification Status

The criteria above are checked by `e2e/design-acceptance.test.ts`, which runs against mocked services in the regular `npm run test:e2e` run.

| Criterion                          | How it is checked                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout from 320 px to wide desktop | Ten viewports, including a small phone, a phone with the on-screen keyboard (short viewport), landscape, 200% zoom of a laptop (640 by 360), tablet, and 1920 by 1080: no horizontal scrolling on Home, Assistant, and Settings, and the composer sits above the navigation bar                                                                                                                                                                                                                |
| 200% text size                     | Root font size doubled on Home, Assistant, and onboarding: no horizontal scrolling and the composer stays reachable                                                                                                                                                                                                                                                                                                                                                                            |
| Touch targets                      | Every visible interactive element is at least 44 by 44 px, except the documented 40 px Send and Stop buttons and inline links in a sentence                                                                                                                                                                                                                                                                                                                                                    |
| Contrast                           | Rendered measurement: all text is made transparent, a screenshot captures the real background under each text box (gradients, glass, blur), and the worst sampled pixel is compared with the text color; AA thresholds of 4.5:1, and 3:1 for large text. Run on Home (also scrolled, expanded, and filtered), the empty Assistant, the Assistant with a pending confirmation, Settings (including every disclosure and the reset confirmation), and onboarding with errors, at 390 and 1280 px |
| Automated accessibility            | Axe with the WCAG 2.0, 2.1, and 2.2 A and AA rules on the same pages and states: no violations                                                                                                                                                                                                                                                                                                                                                                                                 |
| Keyboard                           | Every tab stop shows a solid outline of at least 2 px in the accent color, inside the viewport; the accent color against the brightest background light field is above 3:1; disclosures open with Enter and Space; focus is not lost when a control hides its own view                                                                                                                                                                                                                         |
| Reduced motion                     | No CSS animation runs on Home or in the Assistant with `prefers-reduced-motion`, and the orb does animate without it                                                                                                                                                                                                                                                                                                                                                                           |

The checks are known to fail when something regresses: replacing the secondary text color with a weak gray makes both the Axe audit and the rendered contrast measurement fail.

Not covered by automation, and therefore checked by the user on real devices (accepted on 2026-11-24): real iOS Safari and Android Chrome behavior with the on-screen keyboard and safe areas (the keyboard is emulated by a short viewport), a pass with a real screen reader (VoiceOver, TalkBack, or NVDA), and scrolling and animation smoothness on a mid-range phone.
