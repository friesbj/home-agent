---
name: milestones
description: Maintain Milestones.md and independently create, prioritize, execute, and check off concrete project todos.
---

# Milestone Maintenance

Use this skill to maintain project milestones and implementation todos.

## When to update

Update `Milestones.md`:

- At the start of an implementation session
- After selecting work or adding a discovered todo
- After completing, blocking, or reprioritizing work
- When architecture decisions change a planned phase

## Planning rules

- Keep milestones ordered from foundation to hardening.
- Create concrete, independently completable todos.
- Prefer vertical slices that can be tested end to end.
- Break work into the smallest relevant implementation unit.
- Mark `[~]` for active work, `[x]` for verified work, and `[!]` for blocked work.
- Explain blockers directly below or beside the todo.
- Do not mark work complete until validation is performed.

## Autonomous execution

When an implementation phase is explicitly authorized:

1. Read `AGENTS.md`, `Milestones.md`, `agent-knowledge.md`, and recent changelog entries.
2. Select the smallest relevant milestone todo.
3. Mark it `[~]`.
4. Inspect and implement the existing project patterns.
5. Verify using the smallest relevant test/check/build.
6. Mark `[x]` or `[!]`.
7. Update the knowledge base and changelog.
