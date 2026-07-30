import { useState, useEffect, useCallback } from 'react'

function getInitialTheme(): 'dark' | 'light' {
  const stored = localStorage.getItem('theme')
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setThemeState] = useState<'dark' | 'light'>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback((checked?: boolean) => {
    setThemeState(prev => {
      if (checked !== undefined) return checked ? 'dark' : 'light'
      return prev === 'dark' ? 'light' : 'dark'
    })
  }, [])

  return { theme, toggleTheme }
}
