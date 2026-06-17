import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// App version, read from package.json and inlined into the renderer at build
// time (see __APP_VERSION__ in vite-env.d.ts) so the UI can show it without IPC.
const appVersion = JSON.parse(readFileSync(resolve('package.json'), 'utf-8')).version as string

export default defineConfig(({ mode }) => {
  // OAuth credentials come from a gitignored .env (or the shell environment), so
  // they can be set once instead of exported on every run. loadEnv merges both.
  const env = loadEnv(mode, process.cwd(), 'CYREX_')

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      // OAuth client ids for browser login. GitHub/GitLab use device flow (public
      // client, no secret). Bitbucket has no device flow, so it uses an authorization-
      // code consumer that also needs a secret. All empty unless the owner sets the
      // CYREX_* vars (in .env or the shell) — providers then fall back to token paste.
      define: {
        __GITHUB_CLIENT_ID__: JSON.stringify(env.CYREX_GITHUB_CLIENT_ID ?? ''),
        __GITLAB_CLIENT_ID__: JSON.stringify(env.CYREX_GITLAB_CLIENT_ID ?? ''),
        __BITBUCKET_CLIENT_ID__: JSON.stringify(env.CYREX_BITBUCKET_CLIENT_ID ?? ''),
        __BITBUCKET_CLIENT_SECRET__: JSON.stringify(env.CYREX_BITBUCKET_CLIENT_SECRET ?? '')
      },
      build: {
        rollupOptions: {
          input: { index: resolve('src/main/index.ts') }
        }
      },
      resolve: {
        alias: {
          '@shared': resolve('src/shared')
        }
      }
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          input: { index: resolve('src/preload/index.ts') },
          // Sandboxed preloads must be CommonJS (.js), not ESM. main/index.ts
          // loads `../preload/index.js`, so pin the format + extension here.
          output: { format: 'cjs', entryFileNames: '[name].js' }
        }
      },
      resolve: {
        alias: {
          '@shared': resolve('src/shared')
        }
      }
    },
    renderer: {
      root: 'src/renderer',
      plugins: [react(), tailwindcss()],
      define: {
        __APP_VERSION__: JSON.stringify(appVersion)
      },
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src'),
          '@shared': resolve('src/shared')
        }
      },
      build: {
        rollupOptions: {
          input: { index: resolve('src/renderer/index.html') }
        }
      }
    }
  }
})
