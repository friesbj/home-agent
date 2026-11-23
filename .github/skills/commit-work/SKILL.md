---
name: commit-work
description: Commit agent work as small, traceable, independently revertable git commits with conventional messages linked to milestones.
---

# Commit Work

Use this skill whenever agent work is ready to be committed. The goals are:

- **Traceability:** every change can be found via `git log` and linked to a milestone todo.
- **Modularity:** each commit is one logical unit that can be reverted with `git revert <sha>` without breaking the build or unrelated features.

## When to commit

- After a milestone todo (or a coherent part of one) is implemented **and verified**.
- Commit on the topic branch chosen with the `git-branching` skill, never directly on `main` for feature, fix, or docs work.
- Before starting unrelated work, so changes do not mix.
- Only when the user has asked for commits or explicitly authorized autonomous implementation including commits.
- Never push, force-push, rebase, amend published commits, or rewrite history unless explicitly asked.

## Before committing

1. Run `git status --short` and `git --no-pager diff --stat` to review all changes.
2. Confirm no secrets are staged: `.env`, `*.db`, keys, tokens, or local credentials. `.env` and `*.db` are git-ignored; never force-add them. Review the staged diff (`git --no-pager diff --cached`) for key-like values.
3. Ensure validation passed for the files in each commit (smallest relevant of `npm run check`, `npx vitest run --project server|client`, `npm run test:e2e`, `npx eslint .`). Do not commit known-broken states; if unavoidable, say so in the commit body.
4. Make sure `agent-changelog.md`, `agent-knowledge.md`, and `Milestones.md` are updated (see the related skills).

## Splitting work into commits

Group changes into commits that each build and pass tests on their own, ordered so dependencies come first:

1. **Removals/cleanup** (e.g. dropping placeholder code or dependencies), including the matching `package.json`/`package-lock.json` changes.
2. **Foundational modules** (shared libraries, server utilities) together with their unit tests.
3. **Features/UI** that use those modules, together with their component/e2e tests.
4. **Configuration and documentation** that describe the feature (`README.md`, `.env.example`, `AGENTS.md`), unless they fit naturally into the feature commit.
5. **Context files** (`agent-changelog.md`, `agent-knowledge.md`, `Milestones.md`): either in the commit of the work they describe, or as a final `docs(context)` commit for the batch.

Rules:

- Tests belong in the same commit as the code they test.
- Dependency changes go in the commit that first needs (or stops needing) the dependency, including the lockfile.
- Do not mix formatting-only changes with behavior changes; put repository-wide formatting in its own `style:` commit.
- Do not combine unrelated milestone todos in one commit.
- Stage explicit paths (`git add <paths>`); never run `git add -A` blindly. Use `git add -p` only when one file contains changes for multiple commits.
- If a split would leave an intermediate commit that fails `npm run check`, combine those parts into one commit instead.

## Commit message format

Use Conventional Commits:

```text
<type>(<scope>): <imperative summary, max ~72 chars>

<why the change was made and what it does, wrapped at ~72 chars>
- notable details, decisions, or follow-ups
- validation performed (commands and results)

Milestone: M<n> - <todo text or short reference>
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

- **Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore` (deps/tooling), `build`, `style`, `security`.
- **Scopes:** the affected area, e.g. `config`, `settings`, `onboarding`, `chat`, `server`, `mcp`, `auth`, `deps`, `context`, `skills`.
- Write messages in English. Never include secret values.
- Reference the milestone line so the commit can be traced back to `Milestones.md`. Use `Milestone: none` for maintenance work.

## Committing

On Windows PowerShell, pass multi-line messages via a file to avoid quoting problems. Write the file as UTF-8 **without BOM** (Windows PowerShell 5.1 `Set-Content -Encoding utf8` adds a BOM that ends up in the commit subject):

```powershell
git add <paths>
$message = @'
feat(config): add versioned browser-storage settings

...
'@
$file = Join-Path $env:TEMP 'commit-msg.txt'
[IO.File]::WriteAllText($file, $message, (New-Object Text.UTF8Encoding $false))
git commit -F $file
Remove-Item $file
```

After all commits:

1. Run `git status --short`; the working tree should be clean apart from intentionally uncommitted files.
2. Run `git --no-pager log --oneline -n <count>` and report the commit list to the user.

## Reverting

Because each commit is self-contained, the latest change can be undone with `git revert <sha>` (preferred, keeps history) or, for unpublished local work only and with user consent, `git reset`. When reverting a feature, revert its commits newest-first and re-run validation.
