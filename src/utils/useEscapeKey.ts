import { useEffect } from 'react'

/** Fecha janelas com a tecla Esc, como qualquer app nativo. */
export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    function handler(e: KeyboardEvent): void {
      if (e.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onEscape])
}
