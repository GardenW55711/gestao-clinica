import { useEffect, useMemo, useRef, useState } from 'react'
import { useFeedback } from '../components/Feedback'
import { NewAppointmentForm } from '../components/NewAppointmentForm'
import { CompleteAppointmentModal } from '../components/CompleteAppointmentModal'
import type {
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  Patient,
  Professional,
  ProcedureType,
  Room,
  StockUsageItem
} from '@shared/types'

function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function generateSlots(startHour: number, endHour: number, stepMinutes: number): string[] {
  const slots: string[] = []
  for (let m = startHour * 60; m < endHour * 60; m += stepMinutes) {
    const h = String(Math.floor(m / 60)).padStart(2, '0')
    const mm = String(m % 60).padStart(2, '0')
    slots.push(`${h}:${mm}`)
  }
  return slots
}

const SLOT_MINUTES = 30
const SLOTS = generateSlots(8, 19, SLOT_MINUTES)

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Realizado',
  cancelled: 'Cancelado',
  no_show: 'Faltou'
}

type GridCell = { kind: 'start' | 'covered'; appt?: Appointment }

function isCurrentSlot(date: string, slot: string): boolean {
  const now = new Date()
  if (date !== toDateInputValue(now)) return false
  const [h, m] = slot.split(':').map(Number)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return nowMin >= h * 60 + m && nowMin < h * 60 + m + SLOT_MINUTES
}

export function Agenda(): JSX.Element {
  const { toast } = useFeedback()
  const nowRef = useRef<HTMLTableCellElement>(null)
  const [date, setDate] = useState(() => toDateInputValue(new Date()))
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [formSlot, setFormSlot] = useState<{ professionalId: string; time: string } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)

  async function loadAppointments(): Promise<void> {
    const result = await window.api.appointments.listByDate(date)
    if (result.ok && result.data) setAppointments(result.data)
  }

  useEffect(() => {
    loadAppointments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  // Ao abrir o dia de hoje, rola até o horário atual (como o Calendário do iPhone).
  useEffect(() => {
    nowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [date, professionals.length])

  useEffect(() => {
    window.api.professionals.list().then((r) => r.ok && r.data && setProfessionals(r.data.filter((p) => p.active)))
    window.api.patients.list().then((r) => r.ok && r.data && setPatients(r.data))
    window.api.procedureTypes.list().then((r) => r.ok && r.data && setProcedureTypes(r.data.filter((p) => p.active)))
    window.api.rooms.list().then((r) => r.ok && r.data && setRooms(r.data.filter((rm) => rm.active)))
  }, [])

  const grid = useMemo(() => {
    const map = new Map<string, Map<string, GridCell>>()
    for (const prof of professionals) map.set(prof.id, new Map())

    for (const appt of appointments) {
      const profMap = map.get(appt.professionalId)
      if (!profMap) continue
      const start = new Date(appt.startAt)
      const end = new Date(appt.endAt)
      let first = true
      for (const slot of SLOTS) {
        const [h, m] = slot.split(':').map(Number)
        const slotDate = new Date(start)
        slotDate.setHours(h, m, 0, 0)
        if (slotDate >= start && slotDate < end) {
          profMap.set(slot, first ? { kind: 'start', appt } : { kind: 'covered' })
          first = false
        }
      }
    }
    return map
  }, [appointments, professionals])

  async function handleCreate(input: AppointmentInput): Promise<void> {
    const result = await window.api.appointments.create(input)
    if (!result.ok) {
      setFormError(result.error ?? 'Não foi possível agendar')
      return
    }
    setFormError(null)
    setFormSlot(null)
    toast.success('Agendamento criado')
    loadAppointments()
  }

  async function handleStatus(id: string, status: AppointmentStatus): Promise<void> {
    if (status === 'completed') {
      setCompletingId(id)
      return
    }
    await window.api.appointments.setStatus(id, status)
    loadAppointments()
  }

  async function handleConfirmComplete(usedItems: StockUsageItem[]): Promise<void> {
    if (!completingId) return
    const result = await window.api.appointments.complete(completingId, usedItems)
    if (!result.ok) throw new Error(result.error ?? 'Não foi possível finalizar')
    setCompletingId(null)
    toast.success('Atendimento finalizado')
    loadAppointments()
  }

  return (
    <div>
      <h1>Agenda</h1>
      <div className="agenda-toolbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {professionals.length === 0 ? (
        <p>Cadastre ao menos um profissional em "Profissionais" para começar a agendar.</p>
      ) : (
        <table className="agenda-table">
          <thead>
            <tr>
              <th>Hora</th>
              {professionals.map((p) => (
                <th key={p.id}>{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot) => (
              <tr key={slot}>
                <td className={isCurrentSlot(date, slot) ? 'agenda-time now' : 'agenda-time'} ref={isCurrentSlot(date, slot) ? nowRef : undefined}>{slot}</td>
                {professionals.map((prof) => {
                  const cell = grid.get(prof.id)?.get(slot)
                  if (cell?.kind === 'covered') return null

                  if (cell?.kind === 'start' && cell.appt) {
                    const appt = cell.appt
                    const rowSpan = Math.max(
                      1,
                      Math.round(
                        (new Date(appt.endAt).getTime() - new Date(appt.startAt).getTime()) / (SLOT_MINUTES * 60000)
                      )
                    )
                    return (
                      <td key={prof.id} rowSpan={rowSpan} className={`agenda-appt status-${appt.status}`}>
                        <div className="agenda-appt-patient">{appt.patientName}</div>
                        <div className="agenda-appt-proc">{appt.procedureTypeName}</div>
                        <select value={appt.status} onChange={(e) => handleStatus(appt.id, e.target.value as AppointmentStatus)}>
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                    )
                  }

                  return (
                    <td
                      key={prof.id}
                      className="agenda-empty"
                      onClick={() => {
                        setFormError(null)
                        setFormSlot({ professionalId: prof.id, time: slot })
                      }}
                    >
                      +
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {formSlot && (
        <NewAppointmentForm
          date={date}
          professionalId={formSlot.professionalId}
          time={formSlot.time}
          professionals={professionals}
          patients={patients}
          procedureTypes={procedureTypes}
          rooms={rooms}
          error={formError}
          onCancel={() => {
            setFormSlot(null)
            setFormError(null)
          }}
          onSubmit={handleCreate}
        />
      )}

      {completingId && (
        <CompleteAppointmentModal onCancel={() => setCompletingId(null)} onConfirm={handleConfirmComplete} />
      )}
    </div>
  )
}
