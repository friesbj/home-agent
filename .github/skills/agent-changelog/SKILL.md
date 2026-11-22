---
name: agent-changelog
description: Maintain agent-changelog.md with timestamped summaries of repository changes made by agents.
---

# Agent Changelog Maintenance

Use this skill for relevant repository changes made by an agent.

## When to update

Update `agent-changelog.md` after:

- Source or configuration changes
- Dependency changes
- Documentation changes that affect architecture or implementation
- Test additions or fixes
- Completed migration steps or milestone work

Do not add entries for inspection-only sessions or temporary files.

## Format

- Add entries to `agent-changelog.md` in newest-first order.
- Include an ISO-style timestamp in the heading.
- State changed file(s), summary, implementation details, and validation status.
- Reference relevant milestone IDs when possible.
- Never include secret values or full sensitive payloads.
- Mention known validation blockers honestly.

## End of task

After code changes:

1. Verify the change.
2. Append a changelog entry.
3. Update `Milestones.md` for completed or blocked todos.
4. Append durable discoveries to `agent-knowledge.md`.
