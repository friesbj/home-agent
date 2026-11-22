---
name: agent-knowledge
description: Maintain the agent-knowledge.md repository knowledge base with timestamped, append-only project decisions and discoveries.
---

# Agent Knowledge Maintenance

Use this skill whenever an implementation, investigation, or planning decision produces information that should survive a session.

## When to update

Update `agent-knowledge.md` after:

- Product, architecture, storage, security, or provider decisions
- Discovery of project constraints or existing code behavior
- Completion of a milestone or meaningful investigation
- Resolution of an open question
- Changes that affect future implementation choices

Do not update it for trivial formatting or temporary diagnostic output.

## Format

- Add entries to `agent-knowledge.md` in newest-first order.
- Include an ISO-style timestamp in the heading.
- Keep entries concise and future-actionable.
- Explain what was decided, why it matters, and what it affects.
- Separate facts from assumptions.
- Never record API keys, passwords, bearer tokens, raw secrets, or sensitive conversation content.

## Start of session

Before implementation:

1. Read `AGENTS.md`.
2. Read `Milestones.md`.
3. Read the newest relevant entries in `agent-knowledge.md`.
4. Read the newest entries in `agent-changelog.md` when recent changes affect the task.

## End of task

Append only durable knowledge, including open questions that must be resolved later.
