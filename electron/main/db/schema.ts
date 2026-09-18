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
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const staffMembers = sqliteTable('staff_members', {
  ...tenantColumns,
  name: text('name').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'professional', 'receptionist'] }).notNull(),
  pinHash: text('pin_hash').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true)
})

export const professionals = sqliteTable('professionals', {
  ...tenantColumns,
  staffMemberId: text('staff_member_id'),
  name: text('name').notNull(),
  specialty: text('specialty'),
  color: text('color'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true)
})

export const rooms = sqliteTable('rooms', {
  ...tenantColumns,
  name: text('name').notNull(),
  description: text('description'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true)
})

export const procedureTypes = sqliteTable('procedure_types', {
  ...tenantColumns,
  name: text('name').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  defaultPrice: real('default_price').notNull().default(0),
  requiresRoom: integer('requires_room', { mode: 'boolean' }).notNull().default(false),
  bookableOnline: integer('bookable_online', { mode: 'boolean' }).notNull().default(false),
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
  unitCost: real('unit_cost').notNull().default(0)
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

export const sales = sqliteTable('sales', {
  ...tenantColumns,
  patientId: text('patient_id').notNull(),
  appointmentId: text('appointment_id'),
  professionalId: text('professional_id'),
  totalAmount: real('total_amount').notNull().default(0),
  paymentMethod: text('payment_method', { enum: ['dinheiro', 'cartao', 'pix', 'outro'] }).notNull(),
  status: text('status', { enum: ['paga', 'pendente'] }).notNull().default('paga'),
  createdBy: text('created_by')
})

export const saleItems = sqliteTable('sale_items', {
  ...tenantColumns,
  saleId: text('sale_id').notNull(),
  description: text('description').notNull(),
  kind: text('kind', { enum: ['procedimento', 'produto'] }).notNull(),
  procedureTypeId: text('procedure_type_id'),
  inventoryItemId: text('inventory_item_id'),
  quantity: real('quantity').notNull().default(1),
  unitPrice: real('unit_price').notNull().default(0),
  subtotal: real('subtotal').notNull().default(0)
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
