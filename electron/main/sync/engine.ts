import { eq } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from '../supabase/client'
import { getDb } from '../db/client'
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
  inventoryMovements
} from '../db/schema'

/**
 * Motor de sincronização v1: empurra tudo que está "pending" pra nuvem,
 * tabela por tabela. Chamado depois de criar a clínica, depois do login, por
 * um botão manual e automaticamente a cada 1 minuto. Se não houver internet
 * ou sessão na nuvem, falha em silêncio e tudo continua "pending" pra
 * tentar de novo depois — o app nunca trava esperando a nuvem.
 */
async function pushPendingTable(
  supabase: SupabaseClient,
  table: SQLiteTable,
  supabaseTableName: string,
  toRemote: (row: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  const db = getDb()
  const t = table as unknown as { id: never; syncStatus: never }
  const pending = db.select().from(table as never).where(eq(t.syncStatus, 'pending')).all() as Array<
    Record<string, unknown>
  >

  for (const row of pending) {
    const { error } = await supabase.from(supabaseTableName).upsert(toRemote(row))
    if (error) throw new Error(`${supabaseTableName}: ${error.message}`)
    db.update(table as never)
      .set({ syncStatus: 'synced' } as never)
      .where(eq(t.id, row.id as string))
      .run()
  }
}

export async function syncClinicAndStaff(clinicId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'Nuvem não configurada' }

  const db = getDb()

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) console.error('[sync] getSession error:', sessionError.message)
    if (!sessionData.session) return { ok: false, error: 'Sem internet ou sem sessão na nuvem' }

    const clinic = db.select().from(clinics).where(eq(clinics.id, clinicId)).get()
    if (!clinic) throw new Error('Clínica local não encontrada')

    const { error: clinicError } = await supabase.from('clinics').upsert({
      id: clinic.id,
      auth_user_id: sessionData.session.user.id,
      name: clinic.name,
      cnpj: clinic.cnpj,
      owner_email: clinic.ownerEmail,
      self_booking_enabled: clinic.selfBookingEnabled,
      created_at: clinic.createdAt,
      updated_at: clinic.updatedAt
    })
    if (clinicError) throw new Error(`clinics: ${clinicError.message}`)

    await pushPendingTable(supabase, staffMembers, 'staff_members', (row) => ({
      id: row.id,
      clinic_id: row.clinicId,
      name: row.name,
      role: row.role,
      pin_hash: row.pinHash,
      active: row.active,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt
    }))

    await pushPendingTable(supabase, patients, 'patients', (row) => ({
      id: row.id,
      clinic_id: row.clinicId,
      name: row.name,
      phone: row.phone,
      email: row.email,
      birth_date: row.birthDate,
      cpf: row.cpf,
      notes: row.notes,
      lgpd_consent_at: row.lgpdConsentAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt
    }))

    await pushPendingTable(supabase, professionals, 'professionals', (row) => ({
      id: row.id,
      clinic_id: row.clinicId,
      staff_member_id: row.staffMemberId,
      name: row.name,
      specialty: row.specialty,
      color: row.color,
      active: row.active,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt
    }))

    await pushPendingTable(supabase, rooms, 'rooms', (row) => ({
      id: row.id,
      clinic_id: row.clinicId,
      name: row.name,
      description: row.description,
      active: row.active,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt
    }))

    await pushPendingTable(supabase, procedureTypes, 'procedure_types', (row) => ({
      id: row.id,
      clinic_id: row.clinicId,
      name: row.name,
      duration_minutes: row.durationMinutes,
      default_price: row.defaultPrice,
      requires_room: row.requiresRoom,
      bookable_online: row.bookableOnline,
      active: row.active,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt
    }))

    await pushPendingTable(supabase, appointments, 'appointments', (row) => ({
      id: row.id,
      clinic_id: row.clinicId,
      patient_id: row.patientId,
      professional_id: row.professionalId,
      room_id: row.roomId,
      procedure_type_id: row.procedureTypeId,
      start_at: row.startAt,
      end_at: row.endAt,
      status: row.status,
      source: row.source,
      notes: row.notes,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt
    }))

    await pushPendingTable(supabase, inventoryItems, 'inventory_items', (row) => ({
      id: row.id,
      clinic_id: row.clinicId,
      name: row.name,
      category: row.category,
      unit: row.unit,
      min_quantity: row.minQuantity,
      unit_cost: row.unitCost,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt
    }))

    await pushPendingTable(supabase, inventoryBatches, 'inventory_batches', (row) => ({
      id: row.id,
      clinic_id: row.clinicId,
      item_id: row.itemId,
      batch_code: row.batchCode,
      quantity: row.quantity,
      expiry_date: row.expiryDate,
      received_at: row.receivedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt
    }))

    await pushPendingTable(supabase, inventoryMovements, 'inventory_movements', (row) => ({
      id: row.id,
      clinic_id: row.clinicId,
      item_id: row.itemId,
      batch_id: row.batchId,
      type: row.type,
      quantity: row.quantity,
      reason: row.reason,
      related_sale_id: row.relatedSaleId,
      created_by: row.createdBy,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt
    }))

    return { ok: true }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}
