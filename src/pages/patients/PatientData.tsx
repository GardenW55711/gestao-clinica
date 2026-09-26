import { FormEvent, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { PatientInput } from '@shared/types'
import { useFeedback } from '../../components/Feedback'
import { maskCpf, maskPhone } from '../../utils/masks'
import type { PatientFileContext } from './PatientFile'

export function PatientData(): JSX.Element {
  const { patient, reload } = useOutletContext<PatientFileContext>()
  const { toast } = useFeedback()
  const [form, setForm] = useState<PatientInput>({
    name: patient.name,
    phone: patient.phone ?? '',
    cpf: patient.cpf ?? '',
    email: patient.email ?? '',
    birthDate: patient.birthDate ?? '',
    notes: patient.notes ?? '',
    lgpdConsent: true
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof PatientInput>(key: K, value: PatientInput[K]): void => setForm((f) => ({ ...f, [key]: value }))

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const result = await window.api.patients.update(patient.id, form)
    setSaving(false)
    if (!result.ok) return setError(result.error ?? 'Não foi possível salvar')
    toast.success('Dados salvos')
    reload()
  }

  return (
    <form className="card settings-card" onSubmit={handleSubmit}>
      <label>
        Nome
        <input value={form.name} onChange={(e) => set('name', e.target.value)} required autoComplete="off" />
      </label>
      <div className="form-row">
        <label>
          Telefone
          <input value={form.phone} inputMode="numeric" placeholder="(00) 00000-0000" onChange={(e) => set('phone', maskPhone(e.target.value))} autoComplete="off" />
        </label>
        <label>
          CPF
          <input value={form.cpf} inputMode="numeric" placeholder="000.000.000-00" onChange={(e) => set('cpf', maskCpf(e.target.value))} autoComplete="off" />
        </label>
      </div>
      <div className="form-row">
        <label>
          E-mail
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />
        </label>
        <label>
          Nascimento
          <input type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
        </label>
      </div>
      <label>
        Observações
        <textarea rows={4} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Alergias, preferências, recados..." />
      </label>

      <p className="subtitle">
        Aceite de uso dos dados (LGPD):{' '}
        {patient.lgpdConsentAt ? `registrado em ${new Date(patient.lgpdConsentAt).toLocaleDateString('pt-BR')}` : 'não registrado'}.
      </p>

      {error && <p className="error">{error}</p>}
      <div className="modal-actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar dados'}
        </button>
      </div>
    </form>
  )
}
