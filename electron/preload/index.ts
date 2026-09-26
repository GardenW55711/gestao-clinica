import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  ApiResult,
  ClinicLoginResult,
  ClinicSetupInput,
  ClinicRecoverInput,
  UpdateStatus,
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
  FinancialSeriesPoint,
  ClinicSettings,
  CardFees,
  BookingRequestSummary,
  StockUsageItem,
  SaleFilter,
  ReceiveInstallmentInput,
  Expense,
  ExpenseInput,
  ProfessionalWorkingHours,
  ScheduleBlock,
  ScheduleBlockInput,
  StaffMember,
  StaffInput,
  OverviewData,
  ReportsData,
  ProductionRow,
  DashboardSummary
} from '@shared/types'
import type { Range } from '@shared/indicators'

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
  clinicRecover: (input: ClinicRecoverInput): Promise<ApiResult<ClinicLoginResult>> =>
    ipcRenderer.invoke('clinic:recover', input),
  clinicLogin: (masterPassword: string): Promise<ApiResult<ClinicLoginResult>> =>
    ipcRenderer.invoke('clinic:login', masterPassword),
  staffVerifyPin: (staffMemberId: string, pin: string): Promise<ApiResult<StaffSummary>> =>
    ipcRenderer.invoke('staff:verifyPin', { staffMemberId, pin }),
  syncNow: (): Promise<ApiResult<null>> => ipcRenderer.invoke('sync:now'),
  appVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  update: {
    getStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke('update:getStatus'),
    check: (): Promise<void> => ipcRenderer.invoke('update:check'),
    installNow: (): Promise<void> => ipcRenderer.invoke('update:installNow'),
    onStatus: (cb: (s: UpdateStatus) => void): (() => void) => {
      const handler = (_e: unknown, s: UpdateStatus): void => cb(s)
      ipcRenderer.on('update:status', handler)
      return () => ipcRenderer.removeListener('update:status', handler)
    }
  },
  patients: crudApi<Patient, PatientInput>('patients'),
  professionals: crudApi<Professional, ProfessionalInput>('professionals'),
  rooms: crudApi<Room, RoomInput>('rooms'),
  procedureTypes: crudApi<ProcedureType, ProcedureTypeInput>('procedureTypes'),
  appointments: {
    listByDate: (dateIso: string): Promise<ApiResult<Appointment[]>> =>
      ipcRenderer.invoke('appointments:listByDate', dateIso),
    listRange: (from: string, to: string): Promise<ApiResult<Appointment[]>> =>
      ipcRenderer.invoke('appointments:listRange', { from, to }),
    listByPatient: (patientId: string): Promise<ApiResult<Appointment[]>> =>
      ipcRenderer.invoke('appointments:listByPatient', patientId),
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
    list: (filter?: SaleFilter): Promise<ApiResult<Sale[]>> => ipcRenderer.invoke('sales:list', filter),
    create: (input: SaleInput): Promise<ApiResult<string>> => ipcRenderer.invoke('sales:create', input),
    receive: (input: ReceiveInstallmentInput): Promise<ApiResult<null>> => ipcRenderer.invoke('sales:receive', input),
    undoReceive: (installmentId: string): Promise<ApiResult<null>> =>
      ipcRenderer.invoke('sales:undoReceive', installmentId),
    cancel: (saleId: string): Promise<ApiResult<null>> => ipcRenderer.invoke('sales:cancel', saleId),
    financialSummary: (from: string, to: string): Promise<ApiResult<FinancialSummary>> =>
      ipcRenderer.invoke('sales:financialSummary', { from, to }),
    financialSeries: (from: string, to: string, granularity: 'day' | 'month'): Promise<ApiResult<FinancialSeriesPoint[]>> =>
      ipcRenderer.invoke('sales:financialSeries', { from, to, granularity })
  },
  finance: {
    dashboard: (): Promise<ApiResult<DashboardSummary>> => ipcRenderer.invoke('dashboard:summary'),
    overview: (range: Range): Promise<ApiResult<OverviewData>> => ipcRenderer.invoke('finance:overview', range),
    reports: (range: Range, granularity: 'day' | 'month'): Promise<ApiResult<ReportsData>> =>
      ipcRenderer.invoke('finance:reports', { range, granularity }),
    myProduction: (range: Range): Promise<ApiResult<ProductionRow[]>> => ipcRenderer.invoke('finance:myProduction', range)
  },
  expenses: {
    list: (from: string, to: string): Promise<ApiResult<Expense[]>> => ipcRenderer.invoke('expenses:list', { from, to }),
    create: (input: ExpenseInput): Promise<ApiResult<Expense>> => ipcRenderer.invoke('expenses:create', input),
    update: (id: string, input: ExpenseInput): Promise<ApiResult<Expense>> =>
      ipcRenderer.invoke('expenses:update', { id, input }),
    setPaid: (id: string, paid: boolean): Promise<ApiResult<null>> =>
      ipcRenderer.invoke('expenses:setPaid', { id, paid }),
    remove: (id: string, stopRecurrence: boolean): Promise<ApiResult<null>> =>
      ipcRenderer.invoke('expenses:remove', { id, stopRecurrence })
  },
  workingHours: {
    listAll: (): Promise<ApiResult<ProfessionalWorkingHours[]>> => ipcRenderer.invoke('workingHours:listAll'),
    set: (input: ProfessionalWorkingHours): Promise<ApiResult<null>> => ipcRenderer.invoke('workingHours:set', input)
  },
  scheduleBlocks: {
    list: (from?: string, to?: string): Promise<ApiResult<ScheduleBlock[]>> =>
      ipcRenderer.invoke('scheduleBlocks:list', from && to ? { from, to } : undefined),
    create: (input: ScheduleBlockInput): Promise<ApiResult<string>> => ipcRenderer.invoke('scheduleBlocks:create', input),
    remove: (id: string): Promise<ApiResult<null>> => ipcRenderer.invoke('scheduleBlocks:remove', id)
  },
  staff: {
    myProfessionalId: (): Promise<ApiResult<string | null>> => ipcRenderer.invoke('staff:myProfessionalId'),
    list: (): Promise<ApiResult<StaffMember[]>> => ipcRenderer.invoke('staff:list'),
    create: (input: StaffInput): Promise<ApiResult<StaffMember>> => ipcRenderer.invoke('staff:create', input),
    update: (id: string, input: StaffInput): Promise<ApiResult<StaffMember>> =>
      ipcRenderer.invoke('staff:update', { id, input })
  },
  clinicSettings: {
    get: (): Promise<ApiResult<ClinicSettings>> => ipcRenderer.invoke('clinic:getSettings'),
    setCardFees: (fees: CardFees): Promise<ApiResult<null>> => ipcRenderer.invoke('clinic:setCardFees', fees),
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
