import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase, signInClinic } from '../supabase/client'
import { getDb, createClinicDatabase, closeClinicDatabase } from '../db/client'
import {
  clinics,
  staffMembers,
  patients,
  professionals,
  rooms,
  procedureTypes,
  appointments,
  inventoryItems,
  inventoryBatches,
  inventoryMovements,
  sales,
  saleItems,
  bookingRequests
} from '../db/schema'

/**
 * Baixa da nuvem TODAS as linhas de uma tabela pra dentro do banco local —
 * o caminho inverso do motor de sincronização normal (que só empurra). Só é
 * usado nesse fluxo de recuperação, quando o computador perdeu o banco local
 * mas a clínica já existe na nuvem.
 */
async function pullAllRows(
  supabase: SupabaseClient,
  clinicId: string,
  table: SQLiteTable,
  supabaseTableName: string,
  fromRemote: (row: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  const db = getDb()
  const { data, error } = await supabase.from(supabaseTableName).select('*').eq('clinic_id', clinicId)
  if (error) throw new Error(`${supabaseTableName}: ${error.message}`)

  for (const row of data ?? []) {
    db.insert(table as never)
      .values(fromRemote(row) as never)
      .run()
  }
}

export async function recoverClinicFromCloud(params: {
  ownerEmail: string
  masterPassword: string
}): Promise<{ clinicId: string }> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Nuvem não configurada neste programa')

  const signedIn = await signInClinic(params.ownerEmail, params.masterPassword)
  if (!signedIn) throw new Error('Não foi possível entrar com esse e-mail e senha — confira se estão certos')

  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) throw new Error('Sessão da nuvem não pôde ser confirmada')

  const { data: cloudClinic, error: clinicError } = await supabase
    .from('clinics')
    .select('*')
    .eq('auth_user_id', sessionData.session.user.id)
    .maybeSingle()

  if (clinicError) throw new Error(`Erro ao buscar a clínica: ${clinicError.message}`)
  if (!cloudClinic) throw new Error('Nenhuma clínica encontrada na nuvem para esse e-mail')

  createClinicDatabase({
    clinicId: cloudClinic.id,
    ownerEmail: params.ownerEmail,
    masterPassword: params.masterPassword
  })

  try {
    const db = getDb()

    db.insert(clinics)
      .values({
        id: cloudClinic.id,
        name: cloudClinic.name,
        cnpj: cloudClinic.cnpj,
        ownerEmail: cloudClinic.owner_email,
        selfBookingEnabled: cloudClinic.self_booking_enabled,
        createdAt: cloudClinic.created_at,
        updatedAt: cloudClinic.updated_at
      })
      .run()

    await pullAllRows(supabase, cloudClinic.id, staffMembers, 'staff_members', (r) => ({
      id: r.id,
      clinicId: r.clinic_id,
      name: r.name,
      role: r.role,
      pinHash: r.pin_hash,
      active: r.active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      syncStatus: 'synced',
      deletedAt: r.deleted_at
    }))

    await pullAllRows(supabase, cloudClinic.id, patients, 'patients', (r) => ({
      id: r.id,
      clinicId: r.clinic_id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      birthDate: r.birth_date,
      cpf: r.cpf,
      notes: r.notes,
      lgpdConsentAt: r.lgpd_consent_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      syncStatus: 'synced',
      deletedAt: r.deleted_at
    }))

    await pullAllRows(supabase, cloudClinic.id, professionals, 'professionals', (r) => ({
      id: r.id,
      clinicId: r.clinic_id,
      staffMemberId: r.staff_member_id,
      name: r.name,
      specialty: r.specialty,
      color: r.color,
      active: r.active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      syncStatus: 'synced',
      deletedAt: r.deleted_at
    }))

    await pullAllRows(supabase, cloudClinic.id, rooms, 'rooms', (r) => ({
      id: r.id,
      clinicId: r.clinic_id,
      name: r.name,
      description: r.description,
      active: r.active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      syncStatus: 'synced',
      deletedAt: r.deleted_at
    }))

    await pullAllRows(supabase, cloudClinic.id, procedureTypes, 'procedure_types', (r) => ({
      id: r.id,
      clinicId: r.clinic_id,
      name: r.name,
      durationMinutes: r.duration_minutes,
      defaultPrice: r.default_price,
      requiresRoom: r.requires_room,
      bookableOnline: r.bookable_online,
      active: r.active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      syncStatus: 'synced',
      deletedAt: r.deleted_at
    }))

    await pullAllRows(supabase, cloudClinic.id, appointments, 'appointments', (r) => ({
      id: r.id,
      clinicId: r.clinic_id,
      patientId: r.patient_id,
      professionalId: r.professional_id,
      roomId: r.room_id,
      procedureTypeId: r.procedure_type_id,
      startAt: r.start_at,
      endAt: r.end_at,
      status: r.status,
      source: r.source,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      syncStatus: 'synced',
      deletedAt: r.deleted_at
    }))

    await pullAllRows(supabase, cloudClinic.id, inventoryItems, 'inventory_items', (r) => ({
      id: r.id,
      clinicId: r.clinic_id,
      name: r.name,
      category: r.category,
      unit: r.unit,
      minQuantity: r.min_quantity,
      unitCost: r.unit_cost,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      syncStatus: 'synced',
      deletedAt: r.deleted_at
    }))

    await pullAllRows(supabase, cloudClinic.id, inventoryBatches, 'inventory_batches', (r) => ({
      id: r.id,
      clinicId: r.clinic_id,
      itemId: r.item_id,
      batchCode: r.batch_code,
      quantity: r.quantity,
      expiryDate: r.expiry_date,
      receivedAt: r.received_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      syncStatus: 'synced',
      deletedAt: r.deleted_at
    }))

    await pullAllRows(supabase, cloudClinic.id, inventoryMovements, 'inventory_movements', (r) => ({
      id: r.id,
      clinicId: r.clinic_id,
      itemId: r.item_id,
      batchId: r.batch_id,
      type: r.type,
      quantity: r.quantity,
      reason: r.reason,
      relatedSaleId: r.related_sale_id,
      relatedAppointmentId: r.related_appointment_id,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      syncStatus: 'synced',
      deletedAt: r.deleted_at
    }))

    await pullAllRows(supabase, cloudClinic.id, sales, 'sales', (r) => ({
      id: r.id,
      clinicId: r.clinic_id,
      patientId: r.patient_id,
      appointmentId: r.appointment_id,
      professionalId: r.professional_id,
      totalAmount: r.total_amount,
      paymentMethod: r.payment_method,
      status: r.status,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      syncStatus: 'synced',
      deletedAt: r.deleted_at
    }))

    await pullAllRows(supabase, cloudClinic.id, saleItems, 'sale_items', (r) => ({
      id: r.id,
      clinicId: r.clinic_id,
      saleId: r.sale_id,
      description: r.description,
      kind: r.kind,
      procedureTypeId: r.procedure_type_id,
      inventoryItemId: r.inventory_item_id,
      quantity: r.quantity,
      unitPrice: r.unit_price,
      subtotal: r.subtotal,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      syncStatus: 'synced',
      deletedAt: r.deleted_at
    }))

    await pullAllRows(supabase, cloudClinic.id, bookingRequests, 'booking_requests', (r) => ({
      id: r.id,
      clinicId: r.clinic_id,
      patientName: r.patient_name,
      patientPhone: r.patient_phone,
      professionalId: r.professional_id,
      procedureTypeId: r.procedure_type_id,
      desiredStartAt: r.desired_start_at,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      syncStatus: 'synced',
      deletedAt: r.deleted_at
    }))

    return { clinicId: cloudClinic.id }
  } catch (error) {
    closeClinicDatabase()
    throw error
  }
}
