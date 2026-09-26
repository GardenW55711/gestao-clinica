import { FormEvent, useState } from 'react'
import type { Patient, PatientInput } from '@shared/types'
import { maskCpf, maskPhone } from '../utils/masks'
import { useEscapeKey } from '../utils/useEscapeKey'
import { Icon } from './Icons'

/** Janela de cadastro de um paciente novo (com aceite LGPD obrigatório). */
export function PatientFormModal({
  onClose,
  onSaved
}: {
  onClose: () => void
  onSaved: (patient: Patient) => void
}): JSX.Element {
  useEscapeKey(onClose)
  const [form, setForm] = useState<PatientInput>({
    name: '',
    phone: '',
    cpf: '',
    email: '',
    birthDate: '',
    notes: '',
    lgpdConsent: false
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof PatientInput>(key: K, value: PatientInput[K]): void => setForm((f) => ({ ...f, [key]: value }))

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const result = await window.api.patients.create(form)
    setSaving(false)
    if (!result.ok || !result.data) return setError(result.error ?? 'Não foi possível salvar')
    onSaved(result.data)
  }

  return (
    <div className="modal-overlay">
      <form className="card modal-card wide" role="dialog" aria-modal="true" aria-labelledby="pat-title" onSubmit={handleSubmit}>
        <div className="modal-head">
          <h2 id="pat-title">Novo paciente</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>

        <label>
          Nome
          <input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} required autoComplete="off" />
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
          <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
        <label className="switch-row compact">
          <input type="checkbox" checked={form.lgpdConsent} onChange={(e) => set('lgpdConsent', e.target.checked)} />
          Paciente autorizou o uso dos dados (LGPD)
        </label>

        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Cadastrar paciente'}
          </button>
        </div>
      </form>
    </div>
  )
}
