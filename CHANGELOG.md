# Changelog

All notable changes to Cyrex are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-17

### Added
- Pull request integration: list and create pull/merge requests for the active
  repository across GitHub, GitLab, and Bitbucket, with state badges and
  open-in-browser links. Access tokens never leave the main process.
- Configurable Bitbucket OAuth app (client id/secret) for browser sign-in,
  stored encrypted in the OS keychain.
- Commit-graph history pagination: the graph streams older commits on scroll
  instead of capping the view, backed by the engine's skip/limit paging.
- Commit-graph virtualization: only the rows (and graph nodes/edges) within the
  scroll viewport are rendered, keeping large histories fast.
- Engine test harness (Vitest): integration tests against real throwaway repos
  covering the status, log, branch, tag, stash, diff, reflog, and merge-conflict
  parsers, plus unit tests for the commit-graph layout and secret scrubbing.

### Changed
- Sidebar sections are grouped under labeled separators (Repositories,
  Branches & Tags, Workspace) for a clearer, scannable hierarchy.

### Fixed
- Security: `scrubSecrets` now masks the entire `Authorization` header value, not
  just the scheme, so a `Bearer <token>` no longer leaks the token in surfaced
  errors.
- Remote URL parsing strips a trailing slash before `.git`, so a trailing-slash
  remote URL no longer leaves `.git` attached to the parsed repository name.

## [0.1.0]

### Added
- Initial Cyrex scaffold: Electron 42 + React 19 + TypeScript visual Git client.
- Core engine (system `git` CLI) behind a typed, zod-validated IPC boundary.
- Commit graph, hunk/line staging, branches, merge, rebase (incl. interactive),
  cherry-pick, revert, stash, tags, blame, file history, worktrees, submodules,
  and Git LFS awareness.
- Conflict-resolution UI, reflog/undo surface, commit search, command palette,
  visual `.gitignore` editor, and an embedded terminal.
- Hosting account integration (GitHub/GitLab/Bitbucket) for clone and auth.
- Theming (light/dark + accent), and English/German localization.

[0.2.0]: https://github.com/Noxisan/Cyrex/releases/tag/v0.2.0
[0.1.0]: https://github.com/Noxisan/Cyrex/releases/tag/v0.1.0
