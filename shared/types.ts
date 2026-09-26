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
  commissionPercent: number
  active: boolean
}

export interface ProfessionalInput {
  name: string
  specialty?: string
  color?: string
  commissionPercent?: number
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
  defaultPriceCents: number
  requiresRoom: boolean
  bookableOnline: boolean
  active: boolean
  items: ProcedureItemUsage[]
}

export interface ProcedureTypeInput {
  name: string
  durationMinutes: number
  defaultPriceCents: number
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
  /** Cobrança ligada a este atendimento (se já existir). */
  saleId: string | null
  saleStatus: SaleStatus | null
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
  unitCostCents: number
}

export interface InventoryItemSummary {
  id: string
  name: string
  category: string | null
  unit: string
  minQuantity: number
  unitCostCents: number
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

export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito' | 'boleto' | 'outro'
export type SaleStatus = 'pendente' | 'parcial' | 'paga' | 'cancelada'

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_debito: 'Cartão de débito',
  cartao_credito: 'Cartão de crédito',
  boleto: 'Boleto',
  outro: 'Outro'
}

export interface SaleItemInput {
  kind: 'procedimento' | 'produto'
  description: string
  procedureTypeId?: string
  inventoryItemId?: string
  quantity: number
  unitPriceCents: number
}

export interface InstallmentInput {
  amountCents: number
  dueDate: string // AAAA-MM-DD
  paid: boolean // já recebida agora?
}

export interface SaleInput {
  patientId: string
  appointmentId?: string
  professionalId?: string
  items: SaleItemInput[]
  discountCents: number
  paymentMethod: PaymentMethod
  installments: InstallmentInput[] // a soma tem de fechar com o total (bruto - desconto)
}

export interface SaleItem {
  id: string
  description: string
  kind: 'procedimento' | 'produto'
  quantity: number
  unitPriceCents: number
  subtotalCents: number
}

export interface FinancialSeriesPoint {
  key: string
  totalCents: number
  count: number
}

export interface FinancialSummary {
  totalAmountCents: number
  salesCount: number
  byPaymentMethod: { paymentMethod: PaymentMethod; totalCents: number }[]
  byProcedureType: { name: string; totalCents: number }[]
}

export interface Installment {
  id: string
  saleId: string
  number: number
  totalInstallments: number
  amountCents: number
  dueDate: string
  paidAt: string | null
  paymentMethod: PaymentMethod
  feeCents: number
  overdue: boolean
}

export interface Sale {
  id: string
  patientId: string
  patientName: string
  appointmentId: string | null
  professionalId: string | null
  professionalName: string | null
  grossAmountCents: number
  discountCents: number
  totalAmountCents: number
  paidCents: number
  status: SaleStatus
  createdAt: string
  items: SaleItem[]
  installments: Installment[]
}

export interface SaleFilter {
  status?: SaleStatus | 'atrasada'
  patientId?: string
  from?: string // ISO
  to?: string // ISO
}

export interface ReceiveInstallmentInput {
  installmentId: string
  paymentMethod: PaymentMethod
  paidAt?: string // ISO; padrão = agora
}

export type ExpenseCategory =
  | 'aluguel'
  | 'salarios'
  | 'pro_labore'
  | 'contas'
  | 'laboratorio'
  | 'materiais'
  | 'marketing'
  | 'impostos'
  | 'manutencao'
  | 'outros'

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  aluguel: 'Aluguel',
  salarios: 'Salários',
  pro_labore: 'Pró-labore',
  contas: 'Contas (luz, água, internet)',
  laboratorio: 'Laboratório de prótese',
  materiais: 'Materiais (compras)',
  marketing: 'Marketing',
  impostos: 'Impostos',
  manutencao: 'Manutenção',
  outros: 'Outros'
}

export interface Expense {
  id: string
  description: string
  category: ExpenseCategory
  kind: 'fixa' | 'variavel'
  amountCents: number
  dueDate: string
  paidAt: string | null
  recurringMonthly: boolean
  overdue: boolean
}

export interface ExpenseInput {
  description: string
  category: ExpenseCategory
  kind: 'fixa' | 'variavel'
  amountCents: number
  dueDate: string
  paid: boolean
  recurringMonthly: boolean
}

export interface WorkingHoursDay {
  weekday: number // 0 = domingo ... 6 = sábado
  startTime: string // HH:MM
  endTime: string
  breakStart: string | null
  breakEnd: string | null
}

export interface ProfessionalWorkingHours {
  professionalId: string
  days: WorkingHoursDay[] // só os dias trabalhados
}

export interface ScheduleBlock {
  id: string
  professionalId: string | null // nulo = todos
  professionalName: string | null
  startAt: string
  endAt: string
  reason: string | null
}

export interface ScheduleBlockInput {
  professionalId: string | null
  startAt: string
  endAt: string
  reason?: string
}

export interface StaffMember {
  id: string
  name: string
  role: StaffRole
  active: boolean
  professionalId: string | null
}

export interface StaffInput {
  name: string
  role: StaffRole
  pin?: string // obrigatório ao criar; opcional ao editar (só troca se informado)
  active?: boolean
  professionalId?: string | null
}

export interface CardFees {
  debitPercent: number
  creditPercent: number
  creditInstallmentPercent: number
}

export interface ClinicSettings {
  clinicId: string
  clinicName: string
  selfBookingEnabled: boolean
  cardFees: CardFees
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
