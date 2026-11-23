---
name: git-branching
description: Before acting on any new user request, check whether the current git branch fits the work and, after asking the user, switch to or create a dedicated feature/fix branch when it does not.
---

# Git Branching

Use this skill at the **start of every new user request** that may change repository files, before editing anything. New features, fixes, and documentation work are developed on separate branches so they stay isolated, reviewable, and easy to discard or revert.

**The agent recommends; the user decides.** Never create or switch a branch without the user's explicit confirmation for that request (see step 3).

## 1. Inspect the current state

```powershell
git status --short --branch
git --no-pager branch --list
git --no-pager log --oneline -5
```

Determine:

- the current branch and what topic it is for (branch name, recent commits)
- whether there are uncommitted changes and which topic they belong to
- whether the current branch is ahead/behind its upstream

## 2. Determine a recommendation: stay, switch, or create

| Situation                                                                                                                          | Recommendation                               |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Request does not change files (questions, explanations, reviews, status)                                                           | Stay; no branch needed, do not ask           |
| On a topic branch and the request continues that topic (follow-up, review feedback, bug in the feature just built, its tests/docs) | Stay on the current branch, do not ask       |
| On a topic branch and the request is a different topic                                                                             | Create a new branch from `main`              |
| On `main` and the request changes files                                                                                            | Create a new branch                          |
| A matching branch for the topic already exists                                                                                     | Switch to it instead of creating a duplicate |
| Request is about committing, merging, or pushing existing work                                                                     | Stay; follow `commit-work`                   |

Treat as **the same topic**: anything that would naturally be reviewed and reverted together with the current branch's changes. Treat as **a different topic**: another milestone todo, an unrelated bug, or a change that should be mergeable or revertable on its own.

## 3. Ask the user before creating or switching

Whenever the recommendation involves creating or switching a branch, ask with the `ask_user` tool **before** running any `git switch`/`git checkout`/`git branch` command or editing files. Only staying on the current branch for the same topic may proceed without asking.

The question must include:

- the current branch and whether it has uncommitted changes or unpushed commits
- the recommended option as the default, with the proposed branch name and base (e.g. "Create `feat/m3-gpt-live-session` from `main`")
- sensible alternatives, typically: switch to an existing related branch, create with a different name, or stay on the current branch
- the handling of uncommitted changes, if any (step 4)

Example form field: a single-choice `branch` field with options such as "Create `<type>/<topic>` from `main` (recommended)", "Switch to existing `<branch>`", and "Stay on `<current-branch>`". The user can also enter a custom branch name.

Follow the user's answer even if it differs from the recommendation (for example reusing an already merged branch or staying on `main`). If the user declines or cancels, do not change branches; ask how to proceed before editing files.

## 4. Handle uncommitted changes before switching

Never carry unrelated uncommitted changes onto another branch, and never discard them.

- Changes belong to the current topic and are verified: offer to commit them on the current branch first (`commit-work`).
- Changes are unfinished or the user has not approved a commit: offer to commit, `git stash push -m "<topic>"`, or stay on the current branch.
- Changes belong to the new topic (work started on the wrong branch): `git switch -c <new-branch>` carries them over; that is fine.

Include these choices in the same `ask_user` question as the branch decision where possible.

## 5. Create or switch the branch (after confirmation)

Branch from an up-to-date `main` unless the new work depends on unmerged work from another branch (then branch from that branch and say so in the question).

```powershell
git switch main
git pull --ff-only          # only if main has an upstream and the tree is clean
git switch -c <type>/<short-topic>
```

When switching to an existing branch that is behind `main` (for example a branch that was already merged), bring it up to date with `git merge --ff-only main` if possible; otherwise mention the divergence to the user before continuing.

Naming: `<type>/<short-kebab-topic>`, using the Conventional Commit types from `commit-work`:

- `feat/m3-gpt-live-session` – new feature, include the milestone ID when it maps to one
- `fix/home-overview-duplicate-keys` – bug fix
- `docs/…`, `chore/…`, `refactor/…`, `test/…`

Keep names short, lowercase, and descriptive. Prefer a new branch over reusing a merged one, but reuse it if the user chooses to.

## 6. Tell the user

At the start of the response, state briefly which branch you are working on and why (stayed, switched, or created), e.g. "Working on new branch `feat/m3-gpt-live-session` from `main`, as confirmed."

## 7. Finishing a branch

- Commit on the branch with `commit-work`.
- Do **not** merge into `main`, push, or delete branches unless the user asks. When the topic is complete, offer the options:
  - merge locally: `git switch main`, `git merge --no-ff <branch>` (keeps the feature grouped in history and revertable with `git revert -m 1 <merge-sha>`)
  - push the branch and open a pull request
- After a merge the user requested, delete the local branch with `git branch -d <branch>` only if the user agrees.

## Safety rules

- Never create or switch branches without the user's confirmation for the current request.
- Never force-push, rebase published branches, or reset shared history without an explicit request.
- Never switch branches with uncommitted changes that would be lost or mixed into another topic.
- Never edit files directly on `main` for feature, fix, or docs work.
