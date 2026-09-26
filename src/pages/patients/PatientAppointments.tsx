import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { Appointment } from '@shared/types'
import { Icon } from '../../components/Icons'
import { STATUS_META } from '../../utils/calendar'
import type { PatientFileContext } from './PatientFile'

const SALE_LABEL = { pendente: 'Pendente', parcial: 'Parcial', paga: 'Paga', cancelada: 'Cancelada' } as const

export function PatientAppointments(): JSX.Element {
  const { patient } = useOutletContext<PatientFileContext>()
  const [list, setList] = useState<Appointment[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.api.appointments.listByPatient(patient.id).then((r) => {
      if (r.ok && r.data) setList(r.data)
      setLoaded(true)
    })
  }, [patient.id])

  const count = (status: Appointment['status']): number => list.filter((a) => a.status === status).length
  const noShows = count('no_show')

  return (
    <div>
      <div className="patient-stats">
        <span className="stat-chip">
          <strong>{count('completed')}</strong> realizados
        </span>
        <span className="stat-chip">
          <strong>{count('scheduled') + count('confirmed')}</strong> agendados
        </span>
        <span className={noShows > 0 ? 'stat-chip warn' : 'stat-chip'}>
          <strong>{noShows}</strong> {noShows === 1 ? 'falta' : 'faltas'}
        </span>
        <span className="stat-chip">
          <strong>{count('cancelled')}</strong> cancelados
        </span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Procedimento</th>
            <th>Profissional</th>
            <th>Situação</th>
            <th>Cobrança</th>
          </tr>
        </thead>
        <tbody>
          {loaded &&
            list.map((a) => (
              <tr key={a.id} className="row-enter">
                <td>
                  {new Date(a.startAt).toLocaleDateString('pt-BR')}{' '}
                  <small className="muted">{new Date(a.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>
                </td>
                <td>{a.procedureTypeName}</td>
                <td>{a.professionalName}</td>
                <td>
                  <span className={`status-pill status-${a.status}`}>{STATUS_META[a.status].label}</span>
                </td>
                <td>{a.saleStatus ? <span className={`sale-chip ${a.saleStatus}`}>{SALE_LABEL[a.saleStatus]}</span> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          {loaded && list.length === 0 && (
            <tr>
              <td colSpan={5}>
                <div className="empty-state">
                  <Icon name="calendar" size={34} />
                  <strong>Nenhum atendimento ainda</strong>
                  <span>Os agendamentos deste paciente aparecem aqui.</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
