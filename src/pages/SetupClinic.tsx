import { FormEvent, useState } from 'react'
import type { ClinicLoginResult } from '@shared/types'

interface Props {
  onDone: (result: ClinicLoginResult) => void
}

export function SetupClinic({ onDone }: Props): JSX.Element {
  const [clinicName, setClinicName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [masterPassword, setMasterPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [ownerPin, setOwnerPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)

    if (masterPassword !== confirmPassword) {
      setError('As duas senhas mestras digitadas são diferentes')
      return
    }
    if (ownerPin.length < 4) {
      setError('O PIN precisa ter pelo menos 4 dígitos')
      return
    }

    setLoading(true)
    const result = await window.api.clinicCreate({
      clinicName,
      cnpj: cnpj || undefined,
      ownerEmail,
      masterPassword,
      ownerName,
      ownerPin
    })
    setLoading(false)

    if (!result.ok || !result.data) {
      setError(result.error ?? 'Não foi possível criar a clínica')
      return
    }
    onDone(result.data)
  }

  return (
    <div className="centered-page">
      <form className="card" onSubmit={handleSubmit}>
        <h1>Criar sua clínica</h1>
        <p className="subtitle">
          Isso é feito uma única vez neste computador. A senha mestra protege todos os dados
          salvos aqui — guarde-a em local seguro.
        </p>

        <label>
          Nome da clínica
          <input value={clinicName} onChange={(e) => setClinicName(e.target.value)} required />
        </label>

        <label>
          CNPJ (opcional)
          <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
        </label>

        <label>
          Seu nome (responsável)
          <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
        </label>

        <label>
          Seu e-mail
          <input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Senha mestra (mín. 8 caracteres)
          <input
            type="password"
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>

        <label>
          Confirmar senha mestra
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </label>

        <label>
          Seu PIN pessoal (4 a 6 dígitos, usado no dia a dia para identificar quem está usando o
          programa)
          <input
            value={ownerPin}
            onChange={(e) => setOwnerPin(e.target.value)}
            inputMode="numeric"
            minLength={4}
            maxLength={6}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Criando...' : 'Criar clínica'}
        </button>
      </form>
    </div>
  )
}
