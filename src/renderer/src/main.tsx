import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './i18n'
import './styles/index.css'
import { App } from './App'
import { applyAppearance, applyFontScale, useRepoStore } from './store/repoStore'

// Apply the persisted template (theme + accent) and interface zoom before first paint.
{
  const s = useRepoStore.getState()
  applyAppearance(s.template, s.themeMode, s.accent)
  applyFontScale(s.fontScale)
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5_000 }
  }
})

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
