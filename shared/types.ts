export type StaffRole = 'owner' | 'admin' | 'professional' | 'receptionist'

export interface StaffSummary {
  id: string
  name: string
  role: StaffRole
}

export interface ClinicSetupInput {
  clinicName: string
  cnpj?: string
  ownerEmail: string
  masterPassword: string
  ownerName: string
  ownerPin: string
}

export interface ClinicLoginResult {
  clinicName: string
  staff: StaffSummary[]
}

export interface ApiResult<T> {
  ok: boolean
  error?: string
  data?: T
}

export interface Patient {
  id: string
  name: string
  phone: string | null
  email: string | null
  birthDate: string | null
  cpf: string | null
  notes: string | null
  lgpdConsentAt: string | null
}

export interface PatientInput {
  name: string
  phone?: string
  email?: string
  birthDate?: string
  cpf?: string
  notes?: string
  lgpdConsent: boolean
}

export interface Professional {
  id: string
  name: string
  specialty: string | null
  color: string | null
  active: boolean
}

export interface ProfessionalInput {
  name: string
  specialty?: string
  color?: string
}

export interface Room {
  id: string
  name: string
  description: string | null
  active: boolean
}

export interface RoomInput {
  name: string
  description?: string
}

export interface ProcedureType {
  id: string
  name: string
  durationMinutes: number
  defaultPrice: number
  requiresRoom: boolean
  bookableOnline: boolean
  active: boolean
}

export interface ProcedureTypeInput {
  name: string
  durationMinutes: number
  defaultPrice: number
  requiresRoom: boolean
}

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export interface Appointment {
  id: string
  patientId: string
  patientName: string
  professionalId: string
  professionalName: string
  roomId: string | null
  roomName: string | null
  procedureTypeId: string
  procedureTypeName: string
  startAt: string
  endAt: string
  status: AppointmentStatus
  notes: string | null
}

export interface AppointmentInput {
  patientId: string
  professionalId: string
  roomId?: string
  procedureTypeId: string
  startAt: string
  notes?: string
}
