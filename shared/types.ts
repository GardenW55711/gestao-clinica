export type StaffRole = 'owner' | 'admin' | 'professional' | 'receptionist'

export interface StaffSummary {
  id: string
  name: string
  role: StaffRole
}

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'downloading' | 'ready' | 'uptodate' | 'error'
  version?: string
  percent?: number
  message?: string
}

export interface ClinicRecoverInput {
  ownerEmail: string
  masterPassword: string
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

export interface ProcedureItemUsage {
  inventoryItemId: string
  itemName: string
  unit: string
  defaultQuantity: number
}

export interface ProcedureType {
  id: string
  name: string
  durationMinutes: number
  defaultPrice: number
  requiresRoom: boolean
  bookableOnline: boolean
  active: boolean
  items: ProcedureItemUsage[]
}

export interface ProcedureTypeInput {
  name: string
  durationMinutes: number
  defaultPrice: number
  requiresRoom: boolean
  items: { inventoryItemId: string; defaultQuantity: number }[]
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

export interface StockUsageItem {
  itemId: string
  quantity: number
}

export interface InventoryItemInput {
  name: string
  category?: string
  unit: string
  minQuantity: number
  unitCost: number
}

export interface InventoryItemSummary {
  id: string
  name: string
  category: string | null
  unit: string
  minQuantity: number
  unitCost: number
  currentQuantity: number
  nextExpiry: string | null
}

export interface InventoryEntryInput {
  itemId: string
  quantity: number
  expiryDate?: string
  batchCode?: string
}

export interface InventoryExitInput {
  itemId: string
  quantity: number
  reason?: string
}

export interface InventoryBatchAlert {
  itemId: string
  itemName: string
  batchCode: string | null
  quantity: number
  expiryDate: string
  status: 'expired' | 'expiring_soon'
}

export type PaymentMethod = 'dinheiro' | 'cartao' | 'pix' | 'outro'

export interface SaleItemInput {
  kind: 'procedimento' | 'produto'
  description: string
  procedureTypeId?: string
  inventoryItemId?: string
  quantity: number
  unitPrice: number
}

export interface SaleInput {
  patientId: string
  paymentMethod: PaymentMethod
  items: SaleItemInput[]
}

export interface SaleItem {
  id: string
  description: string
  kind: 'procedimento' | 'produto'
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface FinancialSeriesPoint {
  key: string
  total: number
  count: number
}

export interface FinancialSummary {
  totalAmount: number
  salesCount: number
  byPaymentMethod: { paymentMethod: PaymentMethod; total: number }[]
  byProcedureType: { name: string; total: number }[]
}

export interface Sale {
  id: string
  patientId: string
  patientName: string
  totalAmount: number
  paymentMethod: PaymentMethod
  status: 'paga' | 'pendente'
  createdAt: string
  items: SaleItem[]
}

export interface ClinicSettings {
  clinicId: string
  clinicName: string
  selfBookingEnabled: boolean
}

export interface BookingRequestSummary {
  id: string
  patientName: string
  patientPhone: string
  professionalId: string | null
  professionalName: string | null
  procedureTypeId: string | null
  procedureTypeName: string | null
  desiredStartAt: string
  status: 'pending_review' | 'accepted' | 'rejected'
}
