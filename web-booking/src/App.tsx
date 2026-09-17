import { FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

interface Clinic {
  id: string
  name: string
  self_booking_enabled: boolean
}

interface Professional {
  id: string
  name: string
}

interface ProcedureType {
  id: string
  name: string
  duration_minutes: number
}

interface BusySlot {
  professional_id: string
  start_at: string
  end_at: string
}

function getClinicIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('clinic')
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

const SLOTS = generateSlots(8, 19, 30)

function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function App(): JSX.Element {
  const clinicId = useMemo(getClinicIdFromUrl, [])
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [loading, setLoading] = useState(true)
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([])
  const [busySlots, setBusySlots] = useState<BusySlot[]>([])

  const [procedureTypeId, setProcedureTypeId] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [date, setDate] = useState(() => toDateInputValue(new Date()))
  const [time, setTime] = useState('')
  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId) {
      setLoading(false)
      return
    }

    async function load(): Promise<void> {
      const [clinicRes, profRes, procRes, busyRes] = await Promise.all([
        supabase.from('clinics').select('id,name,self_booking_enabled').eq('id', clinicId).maybeSingle(),
        supabase.from('professionals').select('id,name').eq('clinic_id', clinicId).eq('active', true),
        supabase
          .from('procedure_types')
          .select('id,name,duration_minutes')
          .eq('clinic_id', clinicId)
          .eq('active', true)
          .eq('bookable_online', true),
        supabase.from('public_busy_slots').select('professional_id,start_at,end_at').eq('clinic_id', clinicId)
      ])

      setClinic((clinicRes.data as Clinic) ?? null)
      setProfessionals((profRes.data as Professional[]) ?? [])
      setProcedureTypes((procRes.data as ProcedureType[]) ?? [])
      setBusySlots((busyRes.data as BusySlot[]) ?? [])
      setLoading(false)
    }

    load()
  }, [clinicId])

  const selectedProcedure = procedureTypes.find((p) => p.id === procedureTypeId)

  const availableTimes = useMemo(() => {
    if (!selectedProcedure || !professionalId) return []
    return SLOTS.filter((slot) => {
      const [h, m] = slot.split(':').map(Number)
      const start = new Date(`${date}T00:00:00`)
      start.setHours(h, m, 0, 0)
      if (start.getTime() < Date.now()) return false

      const end = new Date(start.getTime() + selectedProcedure.duration_minutes * 60000)

      return !busySlots.some((b) => {
        if (b.professional_id !== professionalId) return false
        const busyStart = new Date(b.start_at)
        const busyEnd = new Date(b.end_at)
        return start < busyEnd && end > busyStart
      })
    })
  }, [selectedProcedure, professionalId, date, busySlots])

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)

    if (!procedureTypeId || !professionalId || !time || !patientName || !patientPhone) {
      setError('Preencha todos os campos')
      return
    }

    setSubmitting(true)
    const [h, m] = time.split(':').map(Number)
    const startAt = new Date(`${date}T00:00:00`)
    startAt.setHours(h, m, 0, 0)

    const { error: insertError } = await supabase.from('booking_requests').insert({
      id: crypto.randomUUID(),
      clinic_id: clinicId,
      patient_name: patientName,
      patient_phone: patientPhone,
      professional_id: professionalId,
      procedure_type_id: procedureTypeId,
      desired_start_at: startAt.toISOString(),
      status: 'pending_review'
    })

    setSubmitting(false)

    if (insertError) {
      setError('Não foi possível enviar seu pedido. Tente novamente em instantes.')
      return
    }

    setDone(true)
  }

  if (!clinicId) {
    return (
      <div className="page">
        <p>Link inválido.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page">
        <p>Carregando...</p>
      </div>
    )
  }

  if (!clinic || !clinic.self_booking_enabled) {
    return (
      <div className="page">
        <p>Agendamento online não disponível para esta clínica no momento.</p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="page">
        <div className="card">
          <h1>Pedido enviado!</h1>
          <p>A clínica vai confirmar seu horário em breve.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <form onSubmit={handleSubmit} className="card">
        <h1>{clinic.name}</h1>
        <p className="subtitle">Escolha o procedimento, o profissional e o horário desejado.</p>

        <label>
          Procedimento
          <select
            value={procedureTypeId}
            onChange={(e) => {
              setProcedureTypeId(e.target.value)
              setTime('')
            }}
            required
          >
            <option value="" disabled>
              Selecione...
            </option>
            {procedureTypes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Profissional
          <select
            value={professionalId}
            onChange={(e) => {
              setProfessionalId(e.target.value)
              setTime('')
            }}
            required
          >
            <option value="" disabled>
              Selecione...
            </option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Data
          <input
            type="date"
            value={date}
            min={toDateInputValue(new Date())}
            onChange={(e) => {
              setDate(e.target.value)
              setTime('')
            }}
            required
          />
        </label>

        <label>
          Horário
          <select value={time} onChange={(e) => setTime(e.target.value)} required disabled={!selectedProcedure || !professionalId}>
            <option value="" disabled>
              {availableTimes.length === 0 ? 'Sem horários livres nesse dia' : 'Selecione...'}
            </option>
            {availableTimes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label>
          Seu nome
          <input value={patientName} onChange={(e) => setPatientName(e.target.value)} required />
        </label>

        <label>
          Seu telefone (com DDD)
          <input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} required />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Enviando...' : 'Solicitar agendamento'}
        </button>
      </form>
    </div>
  )
}
