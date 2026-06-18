# Changelog

All notable changes to Cyrex are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-06-18

### Added
- Pull request review view: open a PR/MR from the list to see its description and
  changed-file diffs rendered inline (using the app's diff settings), across
  GitHub, GitLab, and Bitbucket.
- In-app auto-update: when an update is available, Settings → Updates offers
  Download & install with a progress bar, then Restart to install. Available on
  packaged Windows (NSIS) and Linux AppImage builds; macOS (unsigned) and `.deb`
  fall back to the release link.
- About section in Settings: app version, author, links to the repository and
  Ko-Fi, the technology stack, and the license.
- Rebindable fetch, pull, push, and stash keyboard shortcuts.

### Changed
- macOS builds now produce both Apple Silicon (arm64) and Intel (x64) dmgs.
- README synced with the 0.3.0 feature set and in-app browser-login options.

## [0.3.0] - 2026-06-18

### Added
- Repository wizard: a mode-based Open / Clone / Create dialog. Create now does a
  real local `git init`, and Clone accepts a pasted URL (any https/ssh git URL),
  not just repositories from a connected account.
- GitHub and GitLab browser login (OAuth device flow): enter an OAuth App client
  id / Application ID once (stored in the OS keychain) to enable one-click
  sign-in, or ship one via `CYREX_GITHUB_CLIENT_ID` / `CYREX_GITLAB_CLIENT_ID`.
- Update checker: an Updates section in Settings shows the current version with a
  Check for Updates button, plus an optional check on startup that notifies when
  a newer GitHub release exists.
- Interface text size (zoom) with a Settings control and `Ctrl/Cmd +`, `-`, `0`
  shortcuts.
- Diff view settings: persisted inline/side-by-side layout, line wrap, and tab
  width.
- General settings: background auto-fetch on an interval, reopen the last
  repository on launch, and relative/absolute commit dates in the graph.
- Command palette and shortcuts now cover Pull Requests (rebindable) and editing
  `.gitignore`; the palette's Open Repository opens the new wizard.
- Short descriptions under each setting, a Git Identity button in the top bar,
  and the CYREX wordmark in the accent color.
- `dev:x11` script to run the dev server via XWayland.

### Fixed
- Embedded terminal: run fish with `--no-config` so commands like `ls` work
  (its interactive aliases assumed a TTY and broke in the pipe runner).
- Browser login now surfaces the provider's real error (e.g. `invalid_scope`)
  instead of a bare HTTP status when device authorization fails to start.
- Taskbar and system-tray icon: trim the transparent padding so the mark fills
  its slot instead of looking too small.
- Remote URL parsing no longer leaves `.git` on a repo name for trailing-slash URLs.

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

[0.4.0]: https://github.com/Noxisan/Cyrex/releases/tag/v0.4.0
[0.3.0]: https://github.com/Noxisan/Cyrex/releases/tag/v0.3.0
[0.2.0]: https://github.com/Noxisan/Cyrex/releases/tag/v0.2.0
[0.1.0]: https://github.com/Noxisan/Cyrex/releases/tag/v0.1.0
