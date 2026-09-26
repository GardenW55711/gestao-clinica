import { useEffect, useState } from 'react'
import { useFeedback } from '../components/Feedback'
import type { ClinicSettings, ProcedureType } from '@shared/types'

const PUBLIC_BOOKING_BASE_URL = 'https://web-booking-omega.vercel.app/'

export function Configuracoes(): JSX.Element {
  const { toast } = useFeedback()
  const [settings, setSettings] = useState<ClinicSettings | null>(null)
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([])
  const [busy, setBusy] = useState(false)

  async function loadAll(): Promise<void> {
    const [s, pt] = await Promise.all([window.api.clinicSettings.get(), window.api.procedureTypes.list()])
    if (s.ok && s.data) setSettings(s.data)
    if (pt.ok && pt.data) setProcedureTypes(pt.data)
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function toggleSelfBooking(): Promise<void> {
    if (!settings) return
    setBusy(true)
    await window.api.clinicSettings.setSelfBooking(!settings.selfBookingEnabled)
    setBusy(false)
    toast.success(settings.selfBookingEnabled ? 'Autoagendamento desligado' : 'Autoagendamento ligado')
    loadAll()
  }

  async function toggleProcedureBookable(id: string, current: boolean): Promise<void> {
    await window.api.procedureTypeBookable(id, !current)
    loadAll()
  }

  if (!settings) {
    return (
      <div>
        <div className="skeleton title" />
        <div className="skeleton block" />
      </div>
    )
  }

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

    </div>
  )
}
