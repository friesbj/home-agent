---
name: git-branching
description: Before acting on any new user request, check whether the current git branch fits the work and create a dedicated feature/fix branch when it does not.
---

# Git Branching

Use this skill at the **start of every new user request** that may change repository files, before editing anything. New features, fixes, and documentation work are developed on separate branches so they stay isolated, reviewable, and easy to discard or revert.

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

## 2. Decide: stay, switch, or create

| Situation                                                                                                                          | Action                                       |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Request does not change files (questions, explanations, reviews, status)                                                           | Stay; no branch needed                       |
| On a topic branch and the request continues that topic (follow-up, review feedback, bug in the feature just built, its tests/docs) | Stay on the current branch                   |
| On a topic branch and the request is a different topic                                                                             | Create a new branch from `main` (see below)  |
| On `main` and the request changes files                                                                                            | Create a new branch                          |
| A matching branch for the topic already exists                                                                                     | Switch to it instead of creating a duplicate |
| Request is about committing, merging, or pushing existing work                                                                     | Stay; follow `commit-work`                   |

Treat as **the same topic**: anything that would naturally be reviewed and reverted together with the current branch's changes. Treat as **a different topic**: another milestone todo, an unrelated bug, or a change that should be mergeable or revertable on its own.

If the decision is ambiguous (for example a small fix that could belong to the current feature or stand alone), ask the user with the `ask_user` tool and propose a default.

## 3. Handle uncommitted changes before switching

Never carry unrelated uncommitted changes onto another branch, and never discard them.

- Changes belong to the current topic and are verified: commit them on the current branch first (`commit-work`, with the user's approval).
- Changes are unfinished or the user has not approved a commit: ask whether to commit, `git stash push -m "<topic>"`, or stay on the current branch.
- Changes belong to the new topic (work started on the wrong branch): `git switch -c <new-branch>` carries them over; that is fine.

## 4. Create the branch

Branch from an up-to-date `main` unless the new work depends on unmerged work from another branch (then branch from that branch and say so).

```powershell
git switch main
git pull --ff-only          # only if main has an upstream and the tree is clean
git switch -c <type>/<short-topic>
```

Naming: `<type>/<short-kebab-topic>`, using the Conventional Commit types from `commit-work`:

- `feat/m3-gpt-live-session` – new feature, include the milestone ID when it maps to one
- `fix/home-overview-duplicate-keys` – bug fix
- `docs/…`, `chore/…`, `refactor/…`, `test/…`

Keep names short, lowercase, and descriptive. Do not reuse a merged branch for new work.

## 5. Tell the user

At the start of the response, state briefly which branch you are working on and why (stayed, switched, or created), e.g. "Working on new branch `feat/m3-gpt-live-session` from `main`."

## 6. Finishing a branch

- Commit on the branch with `commit-work`.
- Do **not** merge into `main`, push, or delete branches unless the user asks. When the topic is complete, offer the options:
  - merge locally: `git switch main`, `git merge --no-ff <branch>` (keeps the feature grouped in history and revertable with `git revert -m 1 <merge-sha>`)
  - push the branch and open a pull request
- After a merge the user requested, delete the local branch with `git branch -d <branch>` only if the user agrees.

## Safety rules

- Never force-push, rebase published branches, or reset shared history without an explicit request.
- Never switch branches with uncommitted changes that would be lost or mixed into another topic.
- Never edit files directly on `main` for feature, fix, or docs work.
