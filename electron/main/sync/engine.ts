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
  inventoryMovements,
  sales,
  saleItems,
  bookingRequests,
  procedureTypeItems,
  installments,
  expenses,
  professionalWorkingHours,
  scheduleBlocks,
  patientAlerts
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

/**
 * Tabelas com valores em centavos dependem das colunas *_cents na nuvem
 * (criadas ao rodar o supabase/schema.sql atualizado). Se ainda não existirem,
 * não trava o resto da sincronização: os dados ficam "pending" e sobem depois.
 */
async function pushMoneyTable(label: string, push: () => Promise<void>): Promise<void> {
  try {
    await push()
  } catch (error) {
    console.warn('[sync] ' + label + ' aguardando atualização da nuvem:', (error as Error).message)
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

    const clinicRow = {
      id: clinic.id,
      auth_user_id: sessionData.session.user.id,
      name: clinic.name,
      cnpj: clinic.cnpj,
      owner_email: clinic.ownerEmail,
      self_booking_enabled: clinic.selfBookingEnabled,
      created_at: clinic.createdAt,
      updated_at: clinic.updatedAt
    }
    let { error: clinicError } = await supabase.from('clinics').upsert({
      ...clinicRow,
      card_fee_debit_percent: clinic.cardFeeDebitPercent,
      card_fee_credit_percent: clinic.cardFeeCreditPercent,
      card_fee_credit_installment_percent: clinic.cardFeeCreditInstallmentPercent,
      address: clinic.address,
      phone: clinic.phone
    })
    // Nuvem ainda sem as colunas novas (schema.sql não atualizado): envia o básico.
    if (clinicError && /(card_fee|address|phone)/.test(clinicError.message)) {
      console.warn('[sync] endereço/telefone/taxas aguardando atualização da nuvem')
      ;({ error: clinicError } = await supabase.from('clinics').upsert(clinicRow))
    }
    if (clinicError) throw new Error(`clinics: ${clinicError.message}`)

    {
      const staffRow = (row: Record<string, unknown>): Record<string, unknown> => ({
        id: row.id,
        clinic_id: row.clinicId,
        name: row.name,
        role: row.role,
        pin_hash: row.pinHash,
        active: row.active,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        deleted_at: row.deletedAt
      })
      try {
        await pushPendingTable(supabase, staffMembers, 'staff_members', (row) => ({
          ...staffRow(row),
          clinical_access: row.clinicalAccess
        }))
      } catch (error) {
        if (!/clinical_access/.test((error as Error).message)) throw error
        console.warn('[sync] acesso clínico do funcionário aguardando atualização da nuvem')
        await pushPendingTable(supabase, staffMembers, 'staff_members', staffRow)
      }
    }

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

    {
      const professionalRow = (row: Record<string, unknown>): Record<string, unknown> => ({
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
      })
      try {
        await pushPendingTable(supabase, professionals, 'professionals', (row) => ({
          ...professionalRow(row),
          commission_percent: row.commissionPercent,
          cro_number: row.croNumber,
          cro_uf: row.croUf
        }))
      } catch (error) {
        if (!/(commission_percent|cro_number|cro_uf)/.test((error as Error).message)) throw error
        // Nuvem sem essas colunas: envia sem elas (sobem depois de rodar o schema.sql).
        console.warn('[sync] comissão/CRO aguardando atualização da nuvem')
        await pushPendingTable(supabase, professionals, 'professionals', professionalRow)
      }
    }

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

    {
      const procedureTypeRow = (row: Record<string, unknown>): Record<string, unknown> => ({
        id: row.id,
        clinic_id: row.clinicId,
        name: row.name,
        duration_minutes: row.durationMinutes,
        default_price_cents: row.defaultPriceCents,
        requires_room: row.requiresRoom,
        bookable_online: row.bookableOnline,
        active: row.active,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        deleted_at: row.deletedAt
      })
      try {
        await pushPendingTable(supabase, procedureTypes, 'procedure_types', (row) => ({
          ...procedureTypeRow(row),
          scope: row.scope,
          odontogram_condition: row.odontogramCondition
        }))
      } catch (error) {
        if (!/(scope|odontogram_condition|default_price_cents)/.test((error as Error).message)) throw error
        console.warn('[sync] procedure_types aguardando atualização da nuvem (tenta sem os campos novos)')
        try {
          await pushPendingTable(supabase, procedureTypes, 'procedure_types', procedureTypeRow)
        } catch (inner) {
          console.warn('[sync] procedure_types ainda aguardando atualização da nuvem:', (inner as Error).message)
        }
      }
    }

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

    await pushMoneyTable('inventory_items', () => pushPendingTable(supabase, inventoryItems, 'inventory_items', (row) => ({
      id: row.id,
      clinic_id: row.clinicId,
      name: row.name,
      category: row.category,
      unit: row.unit,
      min_quantity: row.minQuantity,
      unit_cost_cents: row.unitCostCents,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt
    })))

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
      related_appointment_id: row.relatedAppointmentId,
      created_by: row.createdBy,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt
    }))

    await pushMoneyTable('sales', () => pushPendingTable(supabase, sales, 'sales', (row) => ({
      id: row.id,
      clinic_id: row.clinicId,
      patient_id: row.patientId,
      appointment_id: row.appointmentId,
      professional_id: row.professionalId,
      gross_amount_cents: row.grossAmountCents,
      discount_cents: row.discountCents,
      total_amount_cents: row.totalAmountCents,
      payment_method: row.paymentMethod,
      status: row.status,
      created_by: row.createdBy,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt
    })))

    await pushMoneyTable('installments', () =>
      pushPendingTable(supabase, installments, 'installments', (row) => ({
        id: row.id,
        clinic_id: row.clinicId,
        sale_id: row.saleId,
        number: row.number,
        total_installments: row.totalInstallments,
        amount_cents: row.amountCents,
        due_date: row.dueDate,
        paid_at: row.paidAt,
        payment_method: row.paymentMethod,
        fee_cents: row.feeCents,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        deleted_at: row.deletedAt
      }))
    )

    await pushMoneyTable('expenses', () =>
      pushPendingTable(supabase, expenses, 'expenses', (row) => ({
        id: row.id,
        clinic_id: row.clinicId,
        description: row.description,
        category: row.category,
        kind: row.kind,
        amount_cents: row.amountCents,
        due_date: row.dueDate,
        paid_at: row.paidAt,
        recurring_monthly: row.recurringMonthly,
        recurrence_group_id: row.recurrenceGroupId,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        deleted_at: row.deletedAt
      }))
    )

    await pushMoneyTable('professional_working_hours', () =>
      pushPendingTable(supabase, professionalWorkingHours, 'professional_working_hours', (row) => ({
        id: row.id,
        clinic_id: row.clinicId,
        professional_id: row.professionalId,
        weekday: row.weekday,
        start_time: row.startTime,
        end_time: row.endTime,
        break_start: row.breakStart,
        break_end: row.breakEnd,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        deleted_at: row.deletedAt
      }))
    )

    await pushMoneyTable('schedule_blocks', () =>
      pushPendingTable(supabase, scheduleBlocks, 'schedule_blocks', (row) => ({
        id: row.id,
        clinic_id: row.clinicId,
        professional_id: row.professionalId,
        start_at: row.startAt,
        end_at: row.endAt,
        reason: row.reason,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        deleted_at: row.deletedAt
      }))
    )

    await pushMoneyTable('sale_items', () => pushPendingTable(supabase, saleItems, 'sale_items', (row) => ({
      id: row.id,
      clinic_id: row.clinicId,
      sale_id: row.saleId,
      description: row.description,
      kind: row.kind,
      procedure_type_id: row.procedureTypeId,
      inventory_item_id: row.inventoryItemId,
      quantity: row.quantity,
      unit_price_cents: row.unitPriceCents,
      subtotal_cents: row.subtotalCents,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt
    })))

    await pushPendingTable(supabase, bookingRequests, 'booking_requests', (row) => ({
      id: row.id,
      clinic_id: row.clinicId,
      patient_name: row.patientName,
      patient_phone: row.patientPhone,
      professional_id: row.professionalId,
      procedure_type_id: row.procedureTypeId,
      desired_start_at: row.desiredStartAt,
      status: row.status,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt
    }))

    // Tabela nova: se a nuvem ainda não tem (schema.sql não foi rodado depois da
    // atualização), não deixa isso travar o resto da sincronização.
    try {
      await pushPendingTable(supabase, procedureTypeItems, 'procedure_type_items', (row) => ({
        id: row.id,
        clinic_id: row.clinicId,
        procedure_type_id: row.procedureTypeId,
        inventory_item_id: row.inventoryItemId,
        default_quantity: row.defaultQuantity,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        deleted_at: row.deletedAt
      }))
    } catch (error) {
      console.warn('[sync] produtos do procedimento ainda não sincronizados:', (error as Error).message)
    }

    await pushMoneyTable('patient_alerts', () =>
      pushPendingTable(supabase, patientAlerts, 'patient_alerts', (row) => ({
        id: row.id,
        clinic_id: row.clinicId,
        patient_id: row.patientId,
        text: row.text,
        severity: row.severity,
        origin: row.origin,
        source_record_id: row.sourceRecordId,
        active: row.active,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        deleted_at: row.deletedAt
      }))
    )

    await pullNewBookingRequests(supabase, clinicId)

    return { ok: true }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

/**
 * Baixa da nuvem os pedidos de agendamento novos, enviados pela página
 * pública de autoagendamento (que não existe no banco local até alguém de
 * fora mandar um pedido). É o primeiro lugar onde este app puxa dado da
 * nuvem em vez de só empurrar — o resto continua só enviando.
 */
async function pullNewBookingRequests(supabase: SupabaseClient, clinicId: string): Promise<void> {
  const db = getDb()

  const localIds = db
    .select({ id: bookingRequests.id })
    .from(bookingRequests)
    .all()
    .map((r) => r.id)

  const { data: remoteRows, error } = await supabase
    .from('booking_requests')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('status', 'pending_review')

  if (error) throw new Error(`booking_requests (baixar): ${error.message}`)
  if (!remoteRows) return

  const newRows = localIds.length
    ? remoteRows.filter((r) => !localIds.includes(r.id))
    : remoteRows

  for (const row of newRows) {
    db.insert(bookingRequests)
      .values({
        id: row.id,
        clinicId: row.clinic_id,
        patientName: row.patient_name,
        patientPhone: row.patient_phone,
        professionalId: row.professional_id,
        procedureTypeId: row.procedure_type_id,
        desiredStartAt: row.desired_start_at,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        syncStatus: 'synced',
        deletedAt: row.deleted_at
      })
      .run()
  }
}
