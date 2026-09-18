import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/types'

function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  useEffect(() => {
    window.api.update.getStatus().then(setStatus)
    return window.api.update.onStatus(setStatus)
  }, [])
  return status
}

/** Faixa no topo do conteúdo quando há versão nova baixando ou pronta. */
export function UpdateBanner(): JSX.Element | null {
  const status = useUpdateStatus()

  if (status.state === 'downloading') {
    return (
      <div className="update-banner">
        Baixando a versão {status.version} ({status.percent ?? 0}%)... você pode continuar usando o programa.
      </div>
    )
  }
  if (status.state === 'ready') {
    return (
      <div className="update-banner ready">
        <span>A versão {status.version} está pronta.</span>
        <button type="button" onClick={() => window.api.update.installNow()}>
          Reiniciar e atualizar agora
        </button>
      </div>
    )
  }
  return null
}

/** Versão instalada + botão pra verificar atualização na hora (rodapé do menu). */
export function VersionFooter(): JSX.Element {
  const [version, setVersion] = useState('')
  const status = useUpdateStatus()

  useEffect(() => {
    window.api.appVersion().then(setVersion)
  }, [])

  const text =
    status.state === 'checking'
      ? 'Verificando...'
      : status.state === 'uptodate'
        ? 'Você está na versão mais recente'
        : status.state === 'error'
          ? 'Não foi possível verificar'
          : ''

  return (
    <div className="version-footer">
      <span>Versão {version}</span>
      {text && <span className="version-status">{text}</span>}
      <button type="button" className="link-button neutral" onClick={() => window.api.update.check()}>
        Verificar atualização
      </button>
    </div>
  )
}
