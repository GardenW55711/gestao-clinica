import { useState } from 'react'
import type { StaffSummary } from '@shared/types'

interface Props {
  clinicName: string
  staff: StaffSummary
}

export function Home({ clinicName, staff }: Props): JSX.Element {
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  async function handleSync(): Promise<void> {
    setSyncing(true)
    setSyncStatus(null)
    const result = await window.api.syncNow()
    setSyncing(false)
    setSyncStatus(result.ok ? 'Sincronizado com a nuvem ✓' : `Não sincronizou: ${result.error}`)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2>{clinicName}</h2>
        <nav>
          <span className="nav-item active">Início</span>
          <span className="nav-item disabled">Agenda (em breve)</span>
          <span className="nav-item disabled">Pacientes (em breve)</span>
          <span className="nav-item disabled">Estoque (em breve)</span>
          <span className="nav-item disabled">Vendas (em breve)</span>
        </nav>
      </aside>
      <main className="content">
        <h1>Bem-vindo(a), {staff.name}</h1>
        <p>Fundação do sistema pronta: clínica cadastrada, login funcionando, banco local criptografado.</p>
        <button onClick={handleSync} disabled={syncing} style={{ width: 200 }}>
          {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
        </button>
        {syncStatus && <p>{syncStatus}</p>}
      </main>
    </div>
  )
}
