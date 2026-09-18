import { useState } from 'react'

type ThemeMode = 'auto' | 'light' | 'dark'

const STORAGE_KEY = 'theme-mode'
const NEXT: Record<ThemeMode, ThemeMode> = { auto: 'light', light: 'dark', dark: 'auto' }
const LABEL: Record<ThemeMode, string> = { auto: 'Automático', light: 'Claro', dark: 'Escuro' }

function readMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved
  } catch {
    // sem armazenamento disponível: segue o sistema
  }
  return 'auto'
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement
  if (mode === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)
}

export function initTheme(): void {
  applyTheme(readMode())
}

export function ThemeToggle({ floating = false }: { floating?: boolean }): JSX.Element {
  const [mode, setMode] = useState<ThemeMode>(readMode)

  function handleClick(): void {
    const next = NEXT[mode]
    setMode(next)
    applyTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // se não der pra salvar, vale só nesta sessão
    }
  }

  return (
    <button type="button" className={floating ? 'theme-toggle floating' : 'theme-toggle'} onClick={handleClick}>
      Tema: {LABEL[mode]}
    </button>
  )
}
