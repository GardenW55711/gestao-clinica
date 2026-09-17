import { FormEvent, useState } from 'react'
import type { ClinicLoginResult } from '@shared/types'

interface Props {
  onDone: (result: ClinicLoginResult) => void
}

export function ClinicLogin({ onDone }: Props): JSX.Element {
  const [masterPassword, setMasterPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await window.api.clinicLogin(masterPassword)
    setLoading(false)

    if (!result.ok || !result.data) {
      setError(result.error ?? 'Não foi possível entrar')
      return
    }
    onDone(result.data)
  }

  return (
    <div className="centered-page">
      <form className="card" onSubmit={handleSubmit}>
        <h1>Entrar</h1>
        <p className="subtitle">Digite a senha mestra desta clínica.</p>

        <label>
          Senha mestra
          <input
            type="password"
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            autoFocus
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
