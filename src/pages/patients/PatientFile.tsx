import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import type { Patient, PatientAlertSummary } from '@shared/types'
import { AlertBanner } from '../../components/AlertBanner'
import { Icon } from '../../components/Icons'
import { SubTabs } from '../../components/SubTabs'

export interface PatientFileContext {
  patient: Patient
  reload: () => void
}

/** Ficha do paciente: cabeçalho + abas (Dados, Atendimentos, Financeiro). */
export function PatientFile(): JSX.Element {
  const { id = '' } = useParams()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [missing, setMissing] = useState(false)
  const [alerts, setAlerts] = useState<PatientAlertSummary[]>([])

  const reload = useCallback((): void => {
    window.api.patients.list().then((r) => {
      if (!r.ok || !r.data) return
      const found = r.data.find((p) => p.id === id)
      if (found) setPatient(found)
      else setMissing(true)
    })
    window.api.patientAlerts.list(id).then((r) => {
      if (r.ok && r.data) setAlerts(r.data.filter((a) => a.active))
    })
  }, [id])

  useEffect(() => {
    reload()
  }, [reload])

  if (missing) {
    return (
      <div className="empty-state card">
        <Icon name="patients" size={34} />
        <strong>Paciente não encontrado</strong>
        <Link to="/patients">Voltar para a lista</Link>
      </div>
    )
  }

  if (!patient) return <div className="skeleton block" />

  return (
    <div>
      <Link to="/patients" className="back-link">
        <Icon name="chevronLeft" size={16} /> Pacientes
      </Link>
      <div className="patient-head">
        <span className="patient-avatar" aria-hidden="true">
          {patient.name.trim().charAt(0).toUpperCase()}
        </span>
        <div>
          <h1>{patient.name}</h1>
          <p className="subtitle">{[patient.phone, patient.email].filter(Boolean).join(' · ') || 'Sem contato cadastrado'}</p>
        </div>
      </div>
      <AlertBanner alerts={alerts} />
      <SubTabs
        tabs={[
          { to: `/patients/${id}`, label: 'Resumo', end: true },
          { to: `/patients/${id}/anamnese`, label: 'Anamnese' },
          { to: `/patients/${id}/odontograma`, label: 'Odontograma' },
          { to: `/patients/${id}/plano`, label: 'Plano de tratamento' },
          { to: `/patients/${id}/evolucao`, label: 'Evolução' },
          { to: `/patients/${id}/imagens`, label: 'Imagens' },
          { to: `/patients/${id}/documentos`, label: 'Documentos' },
          { to: `/patients/${id}/atendimentos`, label: 'Atendimentos' },
          { to: `/patients/${id}/financeiro`, label: 'Financeiro' }
        ]}
      />
      <Outlet context={{ patient, reload } satisfies PatientFileContext} />
    </div>
  )
}
