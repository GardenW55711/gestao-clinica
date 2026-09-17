import { FormEvent, useState } from 'react'
import type { StaffSummary } from '@shared/types'

interface Props {
  clinicName: string
  staff: StaffSummary[]
  onDone: (staff: StaffSummary) => void
}

const ROLE_LABELS: Record<StaffSummary['role'], string> = {
  owner: 'Dono(a)',
  admin: 'Administrador(a)',
  professional: 'Profissional',
  receptionist: 'Recepção'
}

export function StaffPicker({ clinicName, staff, onDone }: Props): JSX.Element {
  const [selectedId, setSelectedId] = useState(staff[0]?.id ?? '')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await window.api.staffVerifyPin(selectedId, pin)
    setLoading(false)

    if (!result.ok || !result.data) {
      setError(result.error ?? 'Não foi possível confirmar')
      return
    }
    onDone(result.data)
  }

  return (
    <div className="centered-page">
      <form className="card" onSubmit={handleSubmit}>
        <h1>{clinicName}</h1>
        <p className="subtitle">Quem está usando o programa agora?</p>

        <label>
          Funcionário
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} required>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} — {ROLE_LABELS[member.role]}
              </option>
            ))}
          </select>
        </label>

        <label>
          PIN
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
            autoFocus
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Confirmando...' : 'Continuar'}
        </button>
      </form>
    </div>
  )
}
