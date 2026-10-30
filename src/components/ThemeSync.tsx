import { useLayoutEffect } from 'react'
import { useData } from '../data/context'

/** IndexedDB is the only preference source, including across tabs and imports. */
export function ThemeSync() {
  const { theme = 'dark', accent = 'violet' } = useData().settings[0]
  useLayoutEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = theme === 'system' ? system.matches ? 'dark' : 'light' : theme
      document.documentElement.dataset.theme = resolved
      document.documentElement.dataset.accent = accent
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#101113' : '#f4f5f8')
    }
    apply()
    system.addEventListener('change', apply)
    return () => system.removeEventListener('change', apply)
  }, [theme, accent])
  return null
}
