import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// Colunas presentes em toda tabela de dado da clínica: id (uuid), clinic_id,
// created_at/updated_at, sync_status (pending -> ainda não subiu pra nuvem;
// synced -> já confirmado no Supabase) e deleted_at (exclusão suave, pra uma
// exclusão também poder "viajar" pra nuvem em vez de simplesmente sumir).
const tenantColumns = {
  id: text('id').primaryKey(),
  clinicId: text('clinic_id').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncStatus: text('sync_status').notNull().default('pending'),
  deletedAt: text('deleted_at')
}

export const clinics = sqliteTable('clinics', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  cnpj: text('cnpj'),
  ownerEmail: text('owner_email').notNull(),
  selfBookingEnabled: integer('self_booking_enabled', { mode: 'boolean' }).notNull().default(false),
  // Taxas cobradas pela maquininha (em %), aplicadas ao receber parcelas de cartão.
  cardFeeDebitPercent: real('card_fee_debit_percent').notNull().default(0),
  cardFeeCreditPercent: real('card_fee_credit_percent').notNull().default(0),
  cardFeeCreditInstallmentPercent: real('card_fee_credit_installment_percent').notNull().default(0),
  // Para o cabeçalho dos documentos em PDF (Fase 2).
  address: text('address'),
  phone: text('phone'),
  logoPath: text('logo_path'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const staffMembers = sqliteTable('staff_members', {
  ...tenantColumns,
  name: text('name').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'professional', 'receptionist'] }).notNull(),
  pinHash: text('pin_hash').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  // Só vale para cargo "admin": o dono libera acesso a anamnese/odontograma/imagens (Fase 2).
  clinicalAccess: integer('clinical_access', { mode: 'boolean' }).notNull().default(false)
})

export const professionals = sqliteTable('professionals', {
  ...tenantColumns,
  staffMemberId: text('staff_member_id'),
  name: text('name').notNull(),
  specialty: text('specialty'),
  color: text('color'),
  commissionPercent: real('commission_percent').notNull().default(0),
  // Obrigatórios para emitir receita/atestado (Fase 2).
  croNumber: text('cro_number'),
  croUf: text('cro_uf'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true)
})

export const rooms = sqliteTable('rooms', {
  ...tenantColumns,
  name: text('name').notNull(),
  description: text('description'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true)
})

// scope define o que o dentista precisa selecionar no odontograma ao usar este
// procedimento num atendimento ou plano de tratamento (Fase 2).
export const PROCEDURE_SCOPES = ['nenhum', 'dente', 'face', 'arcada', 'boca'] as const

export const procedureTypes = sqliteTable('procedure_types', {
  ...tenantColumns,
  name: text('name').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  defaultPriceCents: integer('default_price_cents').notNull().default(0),
  requiresRoom: integer('requires_room', { mode: 'boolean' }).notNull().default(false),
  bookableOnline: integer('bookable_online', { mode: 'boolean' }).notNull().default(false),
  scope: text('scope', { enum: PROCEDURE_SCOPES }).notNull().default('nenhum'),
  // Código da condição do catálogo do odontograma (shared/odontogram.ts) marcada
  // automaticamente quando este procedimento é concluído num dente. Nulo = não marca nada.
  odontogramCondition: text('odontogram_condition'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true)
})

// Produtos que cada tipo de procedimento consome, com a quantidade padrão.
export const procedureTypeItems = sqliteTable('procedure_type_items', {
  ...tenantColumns,
  procedureTypeId: text('procedure_type_id').notNull(),
  inventoryItemId: text('inventory_item_id').notNull(),
  defaultQuantity: real('default_quantity').notNull().default(1)
})

export const patients = sqliteTable('patients', {
  ...tenantColumns,
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  birthDate: text('birth_date'),
  cpf: text('cpf'),
  notes: text('notes'),
  lgpdConsentAt: text('lgpd_consent_at')
})

// Alertas de saúde do paciente (alergias, anticoagulante, gestante...). Os de
// origem "anamnese" são recriados sempre que uma nova anamnese é salva (Fase 2 /
// Etapa B); os "manuais" são digitados por um profissional e só ele/o dono desativam.
export const patientAlerts = sqliteTable('patient_alerts', {
  ...tenantColumns,
  patientId: text('patient_id').notNull(),
  text: text('text').notNull(),
  severity: text('severity', { enum: ['atencao', 'grave'] }).notNull().default('atencao'),
  origin: text('origin', { enum: ['anamnese', 'manual'] }).notNull(),
  sourceRecordId: text('source_record_id'), // id do anamnesis_records que gerou (quando origin = anamnese)
  active: integer('active', { mode: 'boolean' }).notNull().default(true)
})

export const appointments = sqliteTable('appointments', {
  ...tenantColumns,
  patientId: text('patient_id').notNull(),
  professionalId: text('professional_id').notNull(),
  roomId: text('room_id'),
  procedureTypeId: text('procedure_type_id').notNull(),
  startAt: text('start_at').notNull(),
  endAt: text('end_at').notNull(),
  status: text('status', {
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']
  })
    .notNull()
    .default('scheduled'),
  source: text('source', { enum: ['staff', 'patient_self'] })
    .notNull()
    .default('staff'),
  notes: text('notes')
})

export const inventoryItems = sqliteTable('inventory_items', {
  ...tenantColumns,
  name: text('name').notNull(),
  category: text('category'),
  unit: text('unit').notNull(),
  minQuantity: real('min_quantity').notNull().default(0),
  unitCostCents: integer('unit_cost_cents').notNull().default(0)
})

export const inventoryBatches = sqliteTable('inventory_batches', {
  ...tenantColumns,
  itemId: text('item_id').notNull(),
  batchCode: text('batch_code'),
  quantity: real('quantity').notNull(),
  expiryDate: text('expiry_date'),
  receivedAt: text('received_at').notNull()
})

export const inventoryMovements = sqliteTable('inventory_movements', {
  ...tenantColumns,
  itemId: text('item_id').notNull(),
  batchId: text('batch_id'),
  type: text('type', { enum: ['entrada', 'saida', 'ajuste'] }).notNull(),
  quantity: real('quantity').notNull(),
  reason: text('reason'),
  relatedSaleId: text('related_sale_id'),
  relatedAppointmentId: text('related_appointment_id'),
  createdBy: text('created_by')
})

export const PAYMENT_METHODS = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'boleto', 'outro'] as const

// Cobrança: total_amount_cents = valor final (bruto - desconto). O status é
// derivado das parcelas (pendente/parcial/paga), exceto "cancelada".
export const sales = sqliteTable('sales', {
  ...tenantColumns,
  patientId: text('patient_id').notNull(),
  appointmentId: text('appointment_id'),
  professionalId: text('professional_id'),
  grossAmountCents: integer('gross_amount_cents').notNull().default(0),
  discountCents: integer('discount_cents').notNull().default(0),
  totalAmountCents: integer('total_amount_cents').notNull().default(0),
  paymentMethod: text('payment_method', { enum: PAYMENT_METHODS }).notNull(),
  status: text('status', { enum: ['pendente', 'parcial', 'paga', 'cancelada'] })
    .notNull()
    .default('pendente'),
  createdBy: text('created_by')
})

// Parcelas de uma cobrança: à vista = 1 parcela. A taxa do cartão é gravada no
// momento do recebimento (fee_cents), então mudar a taxa depois não altera o passado.
export const installments = sqliteTable('installments', {
  ...tenantColumns,
  saleId: text('sale_id').notNull(),
  number: integer('number').notNull(),
  totalInstallments: integer('total_installments').notNull().default(1),
  amountCents: integer('amount_cents').notNull(),
  dueDate: text('due_date').notNull(), // AAAA-MM-DD
  paidAt: text('paid_at'), // ISO; nulo = ainda não recebida
  paymentMethod: text('payment_method', { enum: PAYMENT_METHODS }).notNull(),
  feeCents: integer('fee_cents').notNull().default(0)
})

export const EXPENSE_CATEGORIES = [
  'aluguel',
  'salarios',
  'pro_labore',
  'contas',
  'laboratorio',
  'materiais',
  'marketing',
  'impostos',
  'manutencao',
  'outros'
] as const

export const expenses = sqliteTable('expenses', {
  ...tenantColumns,
  description: text('description').notNull(),
  category: text('category', { enum: EXPENSE_CATEGORIES }).notNull(),
  kind: text('kind', { enum: ['fixa', 'variavel'] }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  dueDate: text('due_date').notNull(), // AAAA-MM-DD
  paidAt: text('paid_at'), // ISO; nulo = ainda não paga
  recurringMonthly: integer('recurring_monthly', { mode: 'boolean' }).notNull().default(false),
  recurrenceGroupId: text('recurrence_group_id') // une as cópias mensais de uma mesma despesa
})

// Dias e horário de trabalho de cada profissional (uma linha por dia trabalhado).
export const professionalWorkingHours = sqliteTable('professional_working_hours', {
  ...tenantColumns,
  professionalId: text('professional_id').notNull(),
  weekday: integer('weekday').notNull(), // 0 = domingo ... 6 = sábado
  startTime: text('start_time').notNull(), // HH:MM
  endTime: text('end_time').notNull(),
  breakStart: text('break_start'),
  breakEnd: text('break_end')
})

// Bloqueios da agenda (férias, feriado, almoço, curso). professional_id nulo = todos.
export const scheduleBlocks = sqliteTable('schedule_blocks', {
  ...tenantColumns,
  professionalId: text('professional_id'),
  startAt: text('start_at').notNull(),
  endAt: text('end_at').notNull(),
  reason: text('reason')
})

export const saleItems = sqliteTable('sale_items', {
  ...tenantColumns,
  saleId: text('sale_id').notNull(),
  description: text('description').notNull(),
  kind: text('kind', { enum: ['procedimento', 'produto'] }).notNull(),
  procedureTypeId: text('procedure_type_id'),
  inventoryItemId: text('inventory_item_id'),
  quantity: real('quantity').notNull().default(1),
  unitPriceCents: integer('unit_price_cents').notNull().default(0),
  subtotalCents: integer('subtotal_cents').notNull().default(0)
})

export const bookingRequests = sqliteTable('booking_requests', {
  ...tenantColumns,
  patientName: text('patient_name').notNull(),
  patientPhone: text('patient_phone').notNull(),
  professionalId: text('professional_id'),
  procedureTypeId: text('procedure_type_id'),
  desiredStartAt: text('desired_start_at').notNull(),
  status: text('status', { enum: ['pending_review', 'accepted', 'rejected'] })
    .notNull()
    .default('pending_review')
})

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  clinicId: text('clinic_id').notNull(),
  staffMemberId: text('staff_member_id'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  at: text('at').notNull(),
  details: text('details')
})
