import { useState } from 'react'
import { useClinic } from '../context/ClinicContext'

export function Home(): JSX.Element {
  const { staff } = useClinic()
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
    <div>
      <h1>Bem-vindo(a), {staff.name}</h1>
      <p>Cadastros disponíveis: Pacientes, Profissionais, Salas e Tipos de procedimento.</p>
      <button onClick={handleSync} disabled={syncing} style={{ width: 200 }}>
        {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
      </button>
      {syncStatus && <p>{syncStatus}</p>}
    </div>
  )
}
