import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { PatientAlert, PatientAlertSeverity, PatientInput } from '@shared/types'
import { AlertBanner } from '../../components/AlertBanner'
import { useFeedback } from '../../components/Feedback'
import { Icon } from '../../components/Icons'
import { useClinic } from '../../context/ClinicContext'
import { maskCpf, maskPhone } from '../../utils/masks'
import { useEscapeKey } from '../../utils/useEscapeKey'
import type { PatientFileContext } from './PatientFile'

function NewAlertModal({
  patientId,
  onClose,
  onSaved
}: {
  patientId: string
  onClose: () => void
  onSaved: (alert: PatientAlert) => void
}): JSX.Element {
  useEscapeKey(onClose)
  const [text, setText] = useState('')
  const [severity, setSeverity] = useState<PatientAlertSeverity>('atencao')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const result = await window.api.patientAlerts.create({ patientId, text, severity })
    setSaving(false)
    if (!result.ok || !result.data) return setError(result.error ?? 'Não foi possível salvar')
    onSaved(result.data)
  }

  return (
    <div className="modal-overlay">
      <form className="card modal-card" role="dialog" aria-modal="true" aria-labelledby="alert-title" onSubmit={handleSubmit}>
        <div className="modal-head">
          <h2 id="alert-title">Novo alerta</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>
        <label>
          Descrição
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: Alergia a penicilina" required autoComplete="off" />
        </label>
        <label>
          Gravidade
          <div className="period-picker" role="group" aria-label="Gravidade">
            <button type="button" className={severity === 'atencao' ? 'period-btn active' : 'period-btn'} onClick={() => setSeverity('atencao')}>
              Atenção
            </button>
            <button type="button" className={severity === 'grave' ? 'period-btn active' : 'period-btn'} onClick={() => setSeverity('grave')}>
              Grave
            </button>
          </div>
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Adicionar alerta'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function PatientSummary(): JSX.Element {
  const { patient, reload } = useOutletContext<PatientFileContext>()
  const { toast } = useFeedback()
  const { staff } = useClinic()

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

  const [alerts, setAlerts] = useState<PatientAlert[]>([])
  const [loadedAlerts, setLoadedAlerts] = useState(false)
  const [addingAlert, setAddingAlert] = useState(false)

  const loadAlerts = useCallback((): void => {
    window.api.patientAlerts.list(patient.id).then((r) => {
      if (r.ok && r.data) setAlerts(r.data)
      setLoadedAlerts(true)
    })
  }, [patient.id])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

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

  async function toggleAlert(alert: PatientAlert): Promise<void> {
    const result = await window.api.patientAlerts.setActive(alert.id, !alert.active)
    if (!result.ok) return void toast.error(result.error ?? 'Não foi possível atualizar')
    loadAlerts()
  }

  const activeAlerts = alerts.filter((a) => a.active)

  return (
    <div>
      <AlertBanner alerts={activeAlerts} />

      <div className="page-head">
        <h2 className="section-title">Alertas de saúde</h2>
        {staff.clinicalAccess && (
          <button type="button" className="with-icon" onClick={() => setAddingAlert(true)}>
            <Icon name="plus" size={18} />
            Novo alerta
          </button>
        )}
      </div>

      {loadedAlerts && alerts.length === 0 && <p className="subtitle">Nenhum alerta registrado para este paciente.</p>}
      {alerts.length > 0 && (
        <ul className="alert-list">
          {alerts.map((a) => (
            <li key={a.id} className={a.active ? undefined : 'inactive'}>
              <span className={`sale-chip ${a.severity === 'grave' ? 'atrasada' : 'pendente'}`}>
                {a.severity === 'grave' ? 'Grave' : 'Atenção'}
              </span>
              <span className="alert-text">{a.text}</span>
              <small className="muted">{a.origin === 'anamnese' ? 'da anamnese' : 'manual'}</small>
              {staff.clinicalAccess && a.origin === 'manual' && (
                <button type="button" className="link-button" onClick={() => toggleAlert(a)}>
                  {a.active ? 'Desativar' : 'Reativar'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-title">Dados</h2>
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

      {addingAlert && (
        <NewAlertModal
          patientId={patient.id}
          onClose={() => setAddingAlert(false)}
          onSaved={() => {
            setAddingAlert(false)
            toast.success('Alerta adicionado')
            loadAlerts()
          }}
        />
      )}
    </div>
  )
}
