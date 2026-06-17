import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Test runner for the Git engine and pure helpers. Engine tests spawn the real
 * `git` binary against throwaway temp repos (no mocks) — the most truthful way to
 * exercise the porcelain parsers. Runs in the node environment; the `@shared`
 * alias mirrors the app's tsconfig path mapping.
 */
export default defineConfig({
  resolve: {
    alias: { '@shared': resolve(__dirname, 'src/shared') }
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // git operations on a cold temp repo can exceed the 5s default on first run.
    testTimeout: 20_000
  }
})
