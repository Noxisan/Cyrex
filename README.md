<p align="center">
  <img src="readme_logo.png" alt="Cyrex — Visual Git Client" width="100%" />
</p>

# Cyrex

A calm, cross-platform visual Git client for Windows, Linux, and macOS. Cyrex turns everyday Git work — commit, branch, merge, rebase, stash, remotes — into a fast, readable, graphical experience without hiding what Git is actually doing.

<p align="center">
  <a href="https://github.com/Noxisan/Cyrex/actions/workflows/release.yml"><img src="https://github.com/Noxisan/Cyrex/actions/workflows/release.yml/badge.svg" alt="Release build status" /></a>
  <a href="https://github.com/Noxisan/Cyrex/releases/latest"><img src="https://img.shields.io/github/v/release/Noxisan/Cyrex?label=release" alt="Latest release" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/platforms-Windows%20%7C%20Linux%20%7C%20macOS-555" alt="Supported platforms" />
</p>

<p align="center">
  <img src="docs/screenshots/graph.png" alt="Cyrex commit graph view" width="900" />
</p>

## Highlights

- Visual commit graph with lanes, refs, and tags — the signature view, rendered from real repository state.
- Stage by file, hunk, and line; amend; signed commits where configured.
- Branch, merge, rebase (including interactive), cherry-pick, revert, stash.
- Side-by-side and inline diffs with syntax highlighting.
- One wizard to open, clone (from a connected account or any git URL), or create a new local repository.
- Hosting integration with GitHub, GitLab, and Bitbucket: browser (OAuth) or token sign-in, and pull/merge request listing and creation.
- Multi-repo management with quick switching, and an in-app update check.
- Calm, flat, minimal UI with a single crimson accent, light and dark themes, adjustable text size, and 11 bundled languages.

## Install

Download the latest installer for your platform from the [Releases page](https://github.com/Noxisan/Cyrex/releases/latest):

- **Windows** — `Cyrex-Setup-*.exe` (NSIS installer) or `Cyrex-*.exe` (portable).
- **Linux** — `*.AppImage` or `*_amd64.deb`.
- **macOS** — `*-arm64.dmg` (Apple Silicon) or `*-x64.dmg` (Intel). The build is currently unsigned, so on first launch allow it under System Settings → Privacy & Security.

Prefer to build it yourself? See [Build from source](#build-from-source).

## Features

Cyrex aims to cover everyday Git work and then some — all rendered from real repository state, never faked.

**Core Git** — a single wizard to open, clone (from a connected account or any git URL), or create a new local repository (`git init`); switch between repositories; a visual commit graph with lanes/refs/tags; full working-tree status; and branch checkout/create/rename/delete. Commit, amend, and sign; merge, cherry-pick, and revert; rebase, including an interactive rebase UI.

**Staging & diffs** — stage and unstage by file, hunk, or line; inline and side-by-side diffs with syntax highlighting; visual image diffs (before/after with dimensions and size); and a Conventional Commit helper.

**Branches, tags & worktrees** — stash save/apply/pop/drop; lightweight and annotated tags; worktrees; submodules with status and init/update/sync; Git LFS awareness; and visual `.gitignore` editing with a live match preview.

**Remotes & hosting** — fetch (manual or on an auto-fetch interval), pull, push, and upstream tracking; conflict detection and a resolution UI; and credential-safe integration with GitHub, GitLab, and Bitbucket — browser (OAuth) or token sign-in, browse, clone, create, link, and listing/creating pull (merge) requests.

**Navigation & safety** — blame and per-file history, commit search by message/author/hash, an undo (reflog) surface, a command palette (Cmd/Ctrl+K), drag-and-drop branch merge/rebase, and clear confirmation on every destructive action.

**Experience** — an embedded terminal, multi-repo management, light/dark/system themes with accent palettes, adjustable interface text size, an in-app update check (with a startup notification), and 11 bundled languages.

## Supported languages

English, Mandarin Chinese, Hindi, Spanish, French, Arabic (RTL), Bengali, Portuguese, Russian, Urdu (RTL), and German. English and German ship complete today; the rest fall back to English until their translations land. Canonical Git nouns (commit, branch, rebase, stash) are kept in English across all locales by convention.

## Build from source

Prerequisites: Node 20 or newer, and your platform's standard build tools.

```bash
npm install
npm run dev        # launch the app in development
npm run build      # type-check and build to out/
npm run dist       # package installers for the current platform
```

### Hosting sign-in (optional OAuth)

Connecting GitHub, GitLab, or Bitbucket accounts works out of the box via personal access / API tokens (pasted, then stored in the OS keychain). To enable one-click browser sign-in instead, register an OAuth app per provider and supply its credentials at build/dev time. Copy `.env.example` to `.env` (gitignored) and fill in the values, or export them as environment variables:

| Provider | Variables | Flow | Callback to register |
|---|---|---|---|
| GitHub | `CYREX_GITHUB_CLIENT_ID` | Device flow (public client) | none |
| GitLab | `CYREX_GITLAB_CLIENT_ID` | Device flow (public client) | none |
| Bitbucket | `CYREX_BITBUCKET_CLIENT_ID`, `CYREX_BITBUCKET_CLIENT_SECRET` | Authorization code (loopback) | `http://localhost:47600/callback` |

Bitbucket has no device flow, so it uses an OAuth consumer (Workspace settings, OAuth consumers). Set its callback URL to `http://localhost:47600/callback`, grant the Account (read) and Repositories (read and write) permissions, and pass the consumer's key/secret as the two variables above. When a provider's variables are unset, Cyrex falls back to token paste for that provider.

You don't have to rebuild to use browser login. For any provider, pick it in the connect dialog, choose **Log in with browser**, and Cyrex prompts once for the OAuth app's identifier — a Client ID (GitHub), an Application ID (GitLab), or a consumer Key and Secret (Bitbucket) — stored in the OS keychain. GitHub and GitLab use device flow (no secret); GitLab's application must be public ("Confidential" unchecked) with the `api` scope. The `CYREX_*` build vars above are only for shipping a build where end users never see that prompt.

Note: Bitbucket app passwords are deprecated (they stop working 2026-06-09); the token-paste path uses an Atlassian API token (`id.atlassian.com`) created with scopes `read:user:bitbucket`, `read:repository:bitbucket`, `write:repository:bitbucket`, entered as `email:api_token`.

### Git engine note

Cyrex is a UI over real Git. The engine layer lives only in `src/main/git/` and the renderer never touches Git directly — all access goes through typed, zod-validated, allow-listed IPC.

The engine currently runs on the system `git` binary (the CLI fallback described in the project guide). The architecture leaves a clean seam for `nodegit` (libgit2) as the primary backend; because `nodegit` is a native module, integrating it requires `npm run rebuild` (electron-rebuild) after install and after any Electron upgrade. See `src/main/git/engine.ts`.

### Cross-platform builds

`npm run dist` packages installers for the machine it runs on. Building every OS from one machine isn't practical — macOS dmg needs macOS tooling, and Windows targets are most reliable on Windows.

Release installers are therefore produced by a GitHub Actions matrix (`ubuntu-latest`, `windows-latest`, `macos-latest`) that runs electron-builder per OS and publishes the artifacts to the GitHub Release — see [`.github/workflows/release.yml`](.github/workflows/release.yml). It triggers on each `v*` tag.

## Contributing

This project uses Gitflow with Conventional Commits and Semantic Versioning. Branch features from `develop`, use messages like `feat(graph): ...` or `fix(engine): ...`, and open pull requests against `develop`.

## License

MIT.
