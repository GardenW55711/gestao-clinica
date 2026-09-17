import { FormEvent, useState } from 'react'
import type { AppointmentInput, Patient, Professional, ProcedureType, Room } from '@shared/types'

interface Props {
  date: string
  professionalId: string
  time: string
  professionals: Professional[]
  patients: Patient[]
  procedureTypes: ProcedureType[]
  rooms: Room[]
  error?: string | null
  onCancel: () => void
  onSubmit: (input: AppointmentInput) => Promise<void>
}

export function NewAppointmentForm(props: Props): JSX.Element {
  const [patientId, setPatientId] = useState('')
  const [professionalId, setProfessionalId] = useState(props.professionalId)
  const [procedureTypeId, setProcedureTypeId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [time, setTime] = useState(props.time)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedProcedure = props.procedureTypes.find((p) => p.id === procedureTypeId)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setLoading(true)
    const startAt = new Date(`${props.date}T${time}:00`).toISOString()
    await props.onSubmit({
      patientId,
      professionalId,
      procedureTypeId,
      roomId: roomId || undefined,
      startAt,
      notes: notes || undefined
    })
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={props.onCancel}>
      <form className="card modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>Novo agendamento</h2>

        <label>
          Paciente
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
            <option value="" disabled>
              Selecione...
            </option>
            {props.patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Profissional
          <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} required>
            {props.professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tipo de procedimento
          <select value={procedureTypeId} onChange={(e) => setProcedureTypeId(e.target.value)} required>
            <option value="" disabled>
              Selecione...
            </option>
            {props.procedureTypes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.durationMinutes} min)
              </option>
            ))}
          </select>
        </label>

        {selectedProcedure?.requiresRoom && (
          <label>
            Sala
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)} required>
              <option value="" disabled>
                Selecione...
              </option>
              {props.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          Horário
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>

        <label>
          Observações
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {props.error && <p className="error">{props.error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={props.onCancel}>
            Cancelar
          </button>
          <button type="submit" disabled={loading || !patientId || !procedureTypeId}>
            {loading ? 'Salvando...' : 'Agendar'}
          </button>
        </div>
      </form>
    </div>
  )
}
