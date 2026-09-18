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
  AppointmentStatus,
  InventoryItemInput,
  InventoryItemSummary,
  InventoryEntryInput,
  InventoryExitInput,
  InventoryBatchAlert,
  Sale,
  SaleInput,
  FinancialSummary,
  ClinicSettings,
  BookingRequestSummary,
  StockUsageItem
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
      ipcRenderer.invoke('appointments:setStatus', { id, status }),
    complete: (id: string, usedItems: StockUsageItem[]): Promise<ApiResult<null>> =>
      ipcRenderer.invoke('appointments:complete', { id, usedItems })
  },
  inventory: {
    listItems: (): Promise<ApiResult<InventoryItemSummary[]>> => ipcRenderer.invoke('inventory:items:list'),
    createItem: (input: InventoryItemInput): Promise<ApiResult<InventoryItemSummary>> =>
      ipcRenderer.invoke('inventory:items:create', input),
    removeItem: (id: string): Promise<ApiResult<null>> => ipcRenderer.invoke('inventory:items:remove', id),
    addEntry: (input: InventoryEntryInput): Promise<ApiResult<null>> =>
      ipcRenderer.invoke('inventory:batches:addEntry', input),
    addExit: (input: InventoryExitInput): Promise<ApiResult<null>> =>
      ipcRenderer.invoke('inventory:movements:addExit', input),
    expiringSoon: (): Promise<ApiResult<InventoryBatchAlert[]>> => ipcRenderer.invoke('inventory:batches:expiringSoon')
  },
  sales: {
    list: (): Promise<ApiResult<Sale[]>> => ipcRenderer.invoke('sales:list'),
    create: (input: SaleInput): Promise<ApiResult<null>> => ipcRenderer.invoke('sales:create', input),
    financialSummary: (from: string, to: string): Promise<ApiResult<FinancialSummary>> =>
      ipcRenderer.invoke('sales:financialSummary', { from, to })
  },
  clinicSettings: {
    get: (): Promise<ApiResult<ClinicSettings>> => ipcRenderer.invoke('clinic:getSettings'),
    setSelfBooking: (enabled: boolean): Promise<ApiResult<null>> =>
      ipcRenderer.invoke('clinic:setSelfBooking', enabled)
  },
  procedureTypeBookable: (id: string, enabled: boolean): Promise<ApiResult<null>> =>
    ipcRenderer.invoke('procedureTypes:setBookableOnline', { id, enabled }),
  bookingRequests: {
    listPending: (): Promise<ApiResult<BookingRequestSummary[]>> => ipcRenderer.invoke('bookingRequests:listPending'),
    approve: (id: string): Promise<ApiResult<null>> => ipcRenderer.invoke('bookingRequests:approve', id),
    reject: (id: string): Promise<ApiResult<null>> => ipcRenderer.invoke('bookingRequests:reject', id)
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
