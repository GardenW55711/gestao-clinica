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
