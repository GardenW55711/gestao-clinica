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
  bookingRequests,
  procedureTypeItems,
  installments,
  expenses,
  professionalWorkingHours,
  scheduleBlocks,
  patientAlerts,
  anamnesisTemplates,
  anamnesisRecords
} from '../db/schema'
import { eq, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'

/**
 * Baixa da nuvem TODAS as linhas de uma tabela pra dentro do banco local —
 * o caminho inverso do motor de sincronização normal (que só empurra). Só é
 * usado nesse fluxo de recuperação, quando o computador perdeu o banco local
 * mas a clínica já existe na nuvem.
 */
// Nuvem antiga guardava reais em colunas sem sufixo; a nova guarda centavos em colunas _cents.
function centsFrom(cents: unknown, legacyReais: unknown): number {
  if (typeof cents === 'number') return cents
  return Math.round(Number(legacyReais ?? 0) * 100)
}

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
        cardFeeDebitPercent: Number(cloudClinic.card_fee_debit_percent ?? 0),
        cardFeeCreditPercent: Number(cloudClinic.card_fee_credit_percent ?? 0),
        cardFeeCreditInstallmentPercent: Number(cloudClinic.card_fee_credit_installment_percent ?? 0),
        address: cloudClinic.address ?? null,
        phone: cloudClinic.phone ?? null,
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
      clinicalAccess: r.clinical_access ?? false,
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
      commissionPercent: Number(r.commission_percent ?? 0),
      croNumber: r.cro_number ?? null,
      croUf: r.cro_uf ?? null,
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
      defaultPriceCents: centsFrom(r.default_price_cents, r.default_price),
      requiresRoom: r.requires_room,
      bookableOnline: r.bookable_online,
      scope: r.scope ?? 'nenhum',
      odontogramCondition: r.odontogram_condition ?? null,
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
      unitCostCents: centsFrom(r.unit_cost_cents, r.unit_cost),
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
      grossAmountCents: centsFrom(r.gross_amount_cents ?? r.total_amount_cents, r.total_amount),
      discountCents: typeof r.discount_cents === 'number' ? r.discount_cents : 0,
      totalAmountCents: centsFrom(r.total_amount_cents, r.total_amount),
      paymentMethod: r.payment_method === 'cartao' ? 'cartao_credito' : r.payment_method,
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
      unitPriceCents: centsFrom(r.unit_price_cents, r.unit_price),
      subtotalCents: centsFrom(r.subtotal_cents, r.subtotal),
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

    // Produtos de cada procedimento (tabela mais nova: se a nuvem ainda não a
    // tem, a recuperação segue sem ela).
    try {
      await pullAllRows(supabase, cloudClinic.id, procedureTypeItems, 'procedure_type_items', (r) => ({
        id: r.id,
        clinicId: r.clinic_id,
        procedureTypeId: r.procedure_type_id,
        inventoryItemId: r.inventory_item_id,
        defaultQuantity: r.default_quantity,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        syncStatus: 'synced',
        deletedAt: r.deleted_at
      }))
    } catch (error) {
      console.warn('[recover] produtos do procedimento não recuperados:', (error as Error).message)
    }

    // Tabelas da Fase 1 (parcelas, despesas, horários e bloqueios): se a nuvem ainda
    // não as tem, a recuperação segue sem elas.
    const optional: [string, SQLiteTable, string, (r: Record<string, unknown>) => Record<string, unknown>][] = [
      [
        'installments',
        installments,
        'installments',
        (r) => ({
          id: r.id,
          clinicId: r.clinic_id,
          saleId: r.sale_id,
          number: r.number,
          totalInstallments: r.total_installments,
          amountCents: r.amount_cents,
          dueDate: r.due_date,
          paidAt: r.paid_at,
          paymentMethod: r.payment_method,
          feeCents: r.fee_cents ?? 0,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          syncStatus: 'synced',
          deletedAt: r.deleted_at
        })
      ],
      [
        'expenses',
        expenses,
        'expenses',
        (r) => ({
          id: r.id,
          clinicId: r.clinic_id,
          description: r.description,
          category: r.category,
          kind: r.kind,
          amountCents: r.amount_cents,
          dueDate: r.due_date,
          paidAt: r.paid_at,
          recurringMonthly: r.recurring_monthly,
          recurrenceGroupId: r.recurrence_group_id,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          syncStatus: 'synced',
          deletedAt: r.deleted_at
        })
      ],
      [
        'professional_working_hours',
        professionalWorkingHours,
        'professional_working_hours',
        (r) => ({
          id: r.id,
          clinicId: r.clinic_id,
          professionalId: r.professional_id,
          weekday: r.weekday,
          startTime: r.start_time,
          endTime: r.end_time,
          breakStart: r.break_start,
          breakEnd: r.break_end,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          syncStatus: 'synced',
          deletedAt: r.deleted_at
        })
      ],
      [
        'schedule_blocks',
        scheduleBlocks,
        'schedule_blocks',
        (r) => ({
          id: r.id,
          clinicId: r.clinic_id,
          professionalId: r.professional_id,
          startAt: r.start_at,
          endAt: r.end_at,
          reason: r.reason,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          syncStatus: 'synced',
          deletedAt: r.deleted_at
        })
      ],
      [
        'patient_alerts',
        patientAlerts,
        'patient_alerts',
        (r) => ({
          id: r.id,
          clinicId: r.clinic_id,
          patientId: r.patient_id,
          text: r.text,
          severity: r.severity,
          origin: r.origin,
          sourceRecordId: r.source_record_id,
          active: r.active,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          syncStatus: 'synced',
          deletedAt: r.deleted_at
        })
      ],
      [
        'anamnesis_templates',
        anamnesisTemplates,
        'anamnesis_templates',
        (r) => ({
          id: r.id,
          clinicId: r.clinic_id,
          name: r.name,
          questionsJson: JSON.stringify(r.questions_json),
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          syncStatus: 'synced',
          deletedAt: r.deleted_at
        })
      ],
      [
        'anamnesis_records',
        anamnesisRecords,
        'anamnesis_records',
        (r) => ({
          id: r.id,
          clinicId: r.clinic_id,
          patientId: r.patient_id,
          templateName: r.template_name,
          questionsJson: JSON.stringify(r.questions_json),
          answersJson: JSON.stringify(r.answers_json),
          filledByName: r.filled_by_name,
          filledAt: r.filled_at,
          signedOnPaperAt: r.signed_on_paper_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          syncStatus: 'synced',
          deletedAt: r.deleted_at
        })
      ]
    ]
    for (const [label, table, remoteName, mapRow] of optional) {
      try {
        await pullAllRows(supabase, cloudClinic.id, table, remoteName, mapRow)
      } catch (error) {
        console.warn('[recover] ' + label + ' não recuperada:', (error as Error).message)
      }
    }

    // Cobranças vindas de uma nuvem antiga não têm parcelas: cria 1 parcela para cada.
    const orphanSales = db.select().from(sales).where(isNull(sales.deletedAt)).all()
    for (const sale of orphanSales) {
      const has = db.select({ id: installments.id }).from(installments).where(eq(installments.saleId, sale.id)).get()
      if (has) continue
      db.insert(installments)
        .values({
          id: randomUUID(),
          clinicId: sale.clinicId,
          saleId: sale.id,
          number: 1,
          totalInstallments: 1,
          amountCents: sale.totalAmountCents,
          dueDate: sale.createdAt.slice(0, 10),
          paidAt: sale.status === 'paga' ? sale.createdAt : null,
          paymentMethod: sale.paymentMethod,
          feeCents: 0,
          createdAt: sale.createdAt,
          updatedAt: sale.updatedAt,
          syncStatus: 'pending',
          deletedAt: null
        })
        .run()
    }

    return { clinicId: cloudClinic.id }
  } catch (error) {
    closeClinicDatabase()
    throw error
  }
}
