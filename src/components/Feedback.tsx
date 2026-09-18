import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useEscapeKey } from '../utils/useEscapeKey'

type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  text: string
  leaving: boolean
}

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}

interface FeedbackApi {
  toast: {
    success: (text: string) => void
    error: (text: string) => void
    info: (text: string) => void
  }
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackApi | null>(null)

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback precisa estar dentro do FeedbackProvider')
  return ctx
}

const TOAST_ICON: Record<ToastKind, string> = {
  success: 'M5 12.5l4.5 4.5L19 7.5',
  error: 'M12 7v6M12 17v.01',
  info: 'M12 11v6M12 7v.01'
}

export function FeedbackProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const nextId = useRef(1)

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = nextId.current++
    setToasts((prev) => [...prev.slice(-2), { id, kind, text, leaving: false }])
    const life = kind === 'error' ? 5200 : 3000
    window.setTimeout(() => setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))), life)
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), life + 260)
  }, [])

  const api = useMemo<FeedbackApi>(
    () => ({
      toast: {
        success: (t) => push('success', t),
        error: (t) => push('error', t),
        info: (t) => push('info', t)
      },
      confirm: (options) => new Promise<boolean>((resolve) => setDialog({ ...options, resolve }))
    }),
    [push]
  )

  function close(result: boolean): void {
    dialog?.resolve(result)
    setDialog(null)
  }

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}${t.leaving ? ' leaving' : ''}`}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9.5" opacity="0.35" />
              <path d={TOAST_ICON[t.kind]} />
            </svg>
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {dialog && <ConfirmDialog options={dialog} onClose={close} />}
    </FeedbackContext.Provider>
  )
}

function ConfirmDialog({
  options,
  onClose
}: {
  options: ConfirmOptions
  onClose: (result: boolean) => void
}): JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEscapeKey(() => onClose(false))

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div
        className="alert-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="alert-body">
          <h3 id="alert-title">{options.title}</h3>
          {options.message && <p>{options.message}</p>}
        </div>
        <div className="alert-actions">
          <button ref={cancelRef} type="button" className="alert-btn" onClick={() => onClose(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className={options.danger ? 'alert-btn danger' : 'alert-btn primary'}
            onClick={() => onClose(true)}
          >
            {options.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
