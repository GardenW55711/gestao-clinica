import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
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
  ProcedureTypeInput,
  Appointment,
  AppointmentInput,
  AppointmentStatus
} from '@shared/types'

function crudApi<Dto, Input>(prefix: string): {
  list: () => Promise<ApiResult<Dto[]>>
  create: (input: Input) => Promise<ApiResult<Dto>>
  update: (id: string, input: Input) => Promise<ApiResult<Dto>>
  remove: (id: string) => Promise<ApiResult<null>>
} {
  return {
    list: () => ipcRenderer.invoke(`${prefix}:list`),
    create: (input: Input) => ipcRenderer.invoke(`${prefix}:create`, input),
    update: (id: string, input: Input) => ipcRenderer.invoke(`${prefix}:update`, { id, input }),
    remove: (id: string) => ipcRenderer.invoke(`${prefix}:remove`, id)
  }
}

const api = {
  ping: (): Promise<string> => ipcRenderer.invoke('app:ping'),
  clinicExists: (): Promise<boolean> => ipcRenderer.invoke('clinic:exists'),
  clinicCreate: (input: ClinicSetupInput): Promise<ApiResult<ClinicLoginResult>> =>
    ipcRenderer.invoke('clinic:create', input),
  clinicLogin: (masterPassword: string): Promise<ApiResult<ClinicLoginResult>> =>
    ipcRenderer.invoke('clinic:login', masterPassword),
  staffVerifyPin: (staffMemberId: string, pin: string): Promise<ApiResult<StaffSummary>> =>
    ipcRenderer.invoke('staff:verifyPin', { staffMemberId, pin }),
  syncNow: (): Promise<ApiResult<null>> => ipcRenderer.invoke('sync:now'),
  patients: crudApi<Patient, PatientInput>('patients'),
  professionals: crudApi<Professional, ProfessionalInput>('professionals'),
  rooms: crudApi<Room, RoomInput>('rooms'),
  procedureTypes: crudApi<ProcedureType, ProcedureTypeInput>('procedureTypes'),
  appointments: {
    listByDate: (dateIso: string): Promise<ApiResult<Appointment[]>> =>
      ipcRenderer.invoke('appointments:listByDate', dateIso),
    create: (input: AppointmentInput): Promise<ApiResult<Appointment>> =>
      ipcRenderer.invoke('appointments:create', input),
    setStatus: (id: string, status: AppointmentStatus): Promise<ApiResult<null>> =>
      ipcRenderer.invoke('appointments:setStatus', { id, status })
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (fallback quando contextIsolation está desligado, não é o nosso caso)
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}

export type Api = typeof api
