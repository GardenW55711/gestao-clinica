import { useEffect, useState } from 'react'
import type { BookingRequestSummary, ClinicSettings, ProcedureType } from '@shared/types'

const PUBLIC_BOOKING_BASE_URL = 'https://web-booking-omega.vercel.app/'

export function Configuracoes(): JSX.Element {
  const [settings, setSettings] = useState<ClinicSettings | null>(null)
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([])
  const [requests, setRequests] = useState<BookingRequestSummary[]>([])
  const [busy, setBusy] = useState(false)

  async function loadAll(): Promise<void> {
    const [s, pt, br] = await Promise.all([
      window.api.clinicSettings.get(),
      window.api.procedureTypes.list(),
      window.api.bookingRequests.listPending()
    ])
    if (s.ok && s.data) setSettings(s.data)
    if (pt.ok && pt.data) setProcedureTypes(pt.data)
    if (br.ok && br.data) setRequests(br.data)
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function toggleSelfBooking(): Promise<void> {
    if (!settings) return
    setBusy(true)
    await window.api.clinicSettings.setSelfBooking(!settings.selfBookingEnabled)
    setBusy(false)
    loadAll()
  }

  async function toggleProcedureBookable(id: string, current: boolean): Promise<void> {
    await window.api.procedureTypeBookable(id, !current)
    loadAll()
  }

  async function handleApprove(id: string): Promise<void> {
    const result = await window.api.bookingRequests.approve(id)
    if (!result.ok) {
      alert(result.error ?? 'Não foi possível aprovar')
      return
    }
    loadAll()
  }

  async function handleReject(id: string): Promise<void> {
    await window.api.bookingRequests.reject(id)
    loadAll()
  }

  if (!settings) return <p>Carregando...</p>

  return (
    <div>
      <h1>Configurações</h1>

      <h2>Autoagendamento pelo paciente</h2>
      <div className="card settings-card">
        <label className="switch-row">
          <input type="checkbox" checked={settings.selfBookingEnabled} onChange={toggleSelfBooking} disabled={busy} />
          Permitir que pacientes agendem sozinhos pela página pública
        </label>

        {settings.selfBookingEnabled && (
          <p className="subtitle">
            Link da sua página pública:{' '}
            <code>
              {PUBLIC_BOOKING_BASE_URL}?clinic={settings.clinicId}
            </code>
          </p>
        )}

        <h3>Procedimentos disponíveis para autoagendamento</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Procedimento</th>
              <th>Disponível online</th>
            </tr>
          </thead>
          <tbody>
            {procedureTypes.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={p.bookableOnline}
                    onChange={() => toggleProcedureBookable(p.id, p.bookableOnline)}
                  />
                </td>
              </tr>
            ))}
            {procedureTypes.length === 0 && (
              <tr>
                <td colSpan={2} className="empty-row">
                  Cadastre tipos de procedimento primeiro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2>Pedidos de agendamento pendentes</h2>
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
            <tr key={r.id}>
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
          {requests.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-row">
                Nenhum pedido pendente.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
