/// <reference types="vite/client" />

import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  ApiResult,
  ClinicLoginResult,
  ClinicSetupInput,
  StaffSummary,
  Patient,
  PatientInput,
  Professional,
  ProfessionalInput,
  Room,
  RoomInput,
  ProcedureType,
  ProcedureTypeInput
} from '@shared/types'

interface CrudApi<Dto, Input> {
  list: () => Promise<ApiResult<Dto[]>>
  create: (input: Input) => Promise<ApiResult<Dto>>
  update: (id: string, input: Input) => Promise<ApiResult<Dto>>
  remove: (id: string) => Promise<ApiResult<null>>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ping: () => Promise<string>
      clinicExists: () => Promise<boolean>
      clinicCreate: (input: ClinicSetupInput) => Promise<ApiResult<ClinicLoginResult>>
      clinicLogin: (masterPassword: string) => Promise<ApiResult<ClinicLoginResult>>
      staffVerifyPin: (staffMemberId: string, pin: string) => Promise<ApiResult<StaffSummary>>
      syncNow: () => Promise<ApiResult<null>>
      patients: CrudApi<Patient, PatientInput>
      professionals: CrudApi<Professional, ProfessionalInput>
      rooms: CrudApi<Room, RoomInput>
      procedureTypes: CrudApi<ProcedureType, ProcedureTypeInput>
    }
  }
}
