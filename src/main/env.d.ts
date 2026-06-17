/**
 * electron-vite copies files imported with the `?asset` suffix into the build
 * output and resolves the import to their runtime path (string).
 */
declare module '*?asset' {
  const assetPath: string
  export default assetPath
}

/**
 * OAuth app credentials, injected at build time from CYREX_* env vars via a Vite
 * `define`. GitHub/GitLab use device flow (public client id, no secret); Bitbucket
 * uses an authorization-code consumer that also needs a secret. Empty string when
 * unset — browser login is then unavailable for that provider and token paste is used.
 */
declare const __GITHUB_CLIENT_ID__: string
declare const __GITLAB_CLIENT_ID__: string
declare const __BITBUCKET_CLIENT_ID__: string
declare const __BITBUCKET_CLIENT_SECRET__: string
