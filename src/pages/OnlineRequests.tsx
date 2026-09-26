import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useFeedback } from '../components/Feedback'
import { Icon } from '../components/Icons'
import type { BookingRequestSummary } from '@shared/types'
import type { AgendaOutletContext } from './Agenda'

/** Pedidos de agendamento enviados pelos pacientes pela página pública. */
export function OnlineRequests(): JSX.Element {
  const { toast, confirm } = useFeedback()
  const { refreshPending } = useOutletContext<AgendaOutletContext>()
  const [requests, setRequests] = useState<BookingRequestSummary[]>([])
  const [loaded, setLoaded] = useState(false)

  async function load(): Promise<void> {
    const r = await window.api.bookingRequests.listPending()
    if (r.ok && r.data) setRequests(r.data)
    setLoaded(true)
    refreshPending()
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleApprove(id: string): Promise<void> {
    const result = await window.api.bookingRequests.approve(id)
    if (!result.ok) {
      toast.error(result.error ?? 'Não foi possível aprovar')
      return
    }
    toast.success('Pedido aprovado — agendamento criado')
    load()
  }

  async function handleReject(id: string): Promise<void> {
    const ok = await confirm({
      title: 'Recusar este pedido?',
      message: 'O paciente não será avisado automaticamente.',
      confirmLabel: 'Recusar',
      danger: true
    })
    if (!ok) return
    await window.api.bookingRequests.reject(id)
    toast.info('Pedido recusado')
    load()
  }

  return (
    <div className="agenda-scroll">
      <p className="subtitle">
        Pedidos enviados pelos pacientes na página pública de autoagendamento. Ao aprovar, o horário entra na agenda.
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Telefone</th>
            <th>Profissional</th>
            <th>Procedimento</th>
            <th>Horário desejado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="row-enter">
              <td>{r.patientName}</td>
              <td>{r.patientPhone}</td>
              <td>{r.professionalName ?? '-'}</td>
              <td>{r.procedureTypeName ?? '-'}</td>
              <td>{new Date(r.desiredStartAt).toLocaleString('pt-BR')}</td>
              <td className="request-actions">
                <button type="button" onClick={() => handleApprove(r.id)}>
                  Aprovar
                </button>
                <button type="button" className="link-button" onClick={() => handleReject(r.id)}>
                  Recusar
                </button>
              </td>
            </tr>
          ))}
          {loaded && requests.length === 0 && (
            <tr>
              <td colSpan={6}>
                <div className="empty-state">
                  <Icon name="calendar" size={34} />
                  <strong>Nenhum pedido pendente</strong>
                  <span>Quando um paciente agendar pela página pública, o pedido aparece aqui.</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
