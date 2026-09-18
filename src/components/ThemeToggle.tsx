import { useState } from 'react'
import { Icon } from './Icons'

type ThemeMode = 'auto' | 'light' | 'dark'

const STORAGE_KEY = 'theme-mode'
const NEXT: Record<ThemeMode, ThemeMode> = { auto: 'light', light: 'dark', dark: 'auto' }
const LABEL: Record<ThemeMode, string> = { auto: 'Automático', light: 'Claro', dark: 'Escuro' }
const ICON = { auto: 'auto', light: 'sun', dark: 'moon' } as const

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
    // Troca suave: a página inteira faz um fade curto entre os dois visuais.
    document.documentElement.classList.add('theme-fade')
    applyTheme(next)
    window.setTimeout(() => document.documentElement.classList.remove('theme-fade'), 400)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // se não der pra salvar, vale só nesta sessão
    }
  }

  return (
    <button
      type="button"
      className={floating ? 'theme-toggle floating' : 'theme-toggle'}
      onClick={handleClick}
      title={`Tema: ${LABEL[mode]} (clique para alternar)`}
    >
      <Icon name={ICON[mode]} size={16} />
      <span className="nav-label">Tema: {LABEL[mode]}</span>
    </button>
  )
}
