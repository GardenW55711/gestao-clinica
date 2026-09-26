import { randomUUID } from 'crypto'
import { and, desc, eq, gte, inArray, isNull, lt, lte, ne } from 'drizzle-orm'
import { getDb } from '../db/client'
import { appointments, clinics, installments, patients, professionals, saleItems, sales } from '../db/schema'
import { getCurrentStaffMemberId, getCurrentStaffRole } from '../session'
import { consumeInventoryFefo } from '../inventory/fefo'
import { EVERYONE, MANAGERS, handle, nowIso, requireClinicId, todayStr } from './util'
import { installmentFeeCents, isOverdue, saleStatusFrom } from '@shared/finance'
import type {
  CardFees,
  FinancialSeriesPoint,
  FinancialSummary,
  Installment,
  PaymentMethod,
  ReceiveInstallmentInput,
  Sale,
  SaleFilter,
  SaleInput
} from '@shared/types'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function bucketKey(d: Date, granularity: 'day' | 'month'): string {
  const month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  return granularity === 'day' ? `${month}-${pad(d.getDate())}` : month
}

export function loadCardFees(): CardFees {
  const clinic = getDb().select().from(clinics).get()
  return {
    debitPercent: clinic?.cardFeeDebitPercent ?? 0,
    creditPercent: clinic?.cardFeeCreditPercent ?? 0,
    creditInstallmentPercent: clinic?.cardFeeCreditInstallmentPercent ?? 0
  }
}

/** Profissional vinculado ao funcionário que está usando o programa (se for do cargo "profissional"). */
export function ownProfessionalId(): string | null {
  const staffId = getCurrentStaffMemberId()
  if (!staffId) return null
  const row = getDb()
    .select({ id: professionals.id })
    .from(professionals)
    .where(and(eq(professionals.staffMemberId, staffId), isNull(professionals.deletedAt)))
    .get()
  return row?.id ?? null
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0]

/** Recalcula o status da cobrança a partir das parcelas (cancelada não muda). */
function recomputeSaleStatus(tx: Tx, saleId: string): void {
  const sale = tx.select().from(sales).where(eq(sales.id, saleId)).get()
  if (!sale || sale.status === 'cancelada') return
  const parcels = tx
    .select()
    .from(installments)
    .where(and(eq(installments.saleId, saleId), isNull(installments.deletedAt)))
    .all()
  const status = saleStatusFrom(parcels.map((p) => ({ paid: p.paidAt !== null })))
  tx.update(sales).set({ status, updatedAt: nowIso(), syncStatus: 'pending' }).where(eq(sales.id, saleId)).run()
}

export function registerSalesHandlers(): void {
  handle('sales:list', EVERYONE, (filter: SaleFilter | undefined): Sale[] => {
    const db = getDb()
    const today = todayStr()
    const f = filter ?? {}
    const role = getCurrentStaffRole()

    const conditions = [isNull(sales.deletedAt)]
    if (f.patientId) conditions.push(eq(sales.patientId, f.patientId))
    if (f.from) conditions.push(gte(sales.createdAt, f.from))
    if (f.to) conditions.push(lte(sales.createdAt, f.to))
    if (f.status && f.status !== 'atrasada') conditions.push(eq(sales.status, f.status))
    // Profissional só enxerga as cobranças dos próprios atendimentos.
    if (role === 'professional') {
      const own = ownProfessionalId()
      if (!own) return []
      conditions.push(eq(sales.professionalId, own))
    }

    const saleRows = db
      .select()
      .from(sales)
      .leftJoin(patients, eq(sales.patientId, patients.id))
      .leftJoin(professionals, eq(sales.professionalId, professionals.id))
      .where(and(...conditions))
      .orderBy(desc(sales.createdAt))
      .limit(500)
      .all()

    const ids = saleRows.map((r) => r.sales.id)
    const itemRows = ids.length
      ? db.select().from(saleItems).where(and(isNull(saleItems.deletedAt), inArray(saleItems.saleId, ids))).all()
      : []
    const parcelRows = ids.length
      ? db
          .select()
          .from(installments)
          .where(and(isNull(installments.deletedAt), inArray(installments.saleId, ids)))
          .all()
      : []

    let data: Sale[] = saleRows.map((row) => {
      const parcels: Installment[] = parcelRows
        .filter((p) => p.saleId === row.sales.id)
        .sort((a, b) => a.number - b.number)
        .map((p) => ({
          id: p.id,
          saleId: p.saleId,
          number: p.number,
          totalInstallments: p.totalInstallments,
          amountCents: p.amountCents,
          dueDate: p.dueDate,
          paidAt: p.paidAt,
          paymentMethod: p.paymentMethod,
          feeCents: p.feeCents,
          overdue: row.sales.status !== 'cancelada' && isOverdue(p.dueDate, p.paidAt, today)
        }))
      return {
        id: row.sales.id,
        patientId: row.sales.patientId,
        patientName: row.patients?.name ?? '(paciente removido)',
        appointmentId: row.sales.appointmentId,
        professionalId: row.sales.professionalId,
        professionalName: row.professionals?.name ?? null,
        grossAmountCents: row.sales.grossAmountCents,
        discountCents: row.sales.discountCents,
        totalAmountCents: row.sales.totalAmountCents,
        paidCents: parcels.filter((p) => p.paidAt !== null).reduce((s, p) => s + p.amountCents, 0),
        status: row.sales.status,
        createdAt: row.sales.createdAt,
        items: itemRows
          .filter((item) => item.saleId === row.sales.id)
          .map((item) => ({
            id: item.id,
            description: item.description,
            kind: item.kind,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            subtotalCents: item.subtotalCents
          })),
        installments: parcels
      }
    })

    if (f.status === 'atrasada') data = data.filter((s) => s.installments.some((p) => p.overdue))
    return data
  })

  handle('sales:create', EVERYONE, (input: SaleInput): string => {
    const clinicId = requireClinicId()
    const db = getDb()
    const role = getCurrentStaffRole()

    if (!input.patientId) throw new Error('Selecione o paciente')
    if (input.items.length === 0) throw new Error('Adicione ao menos um item à cobrança')
    for (const item of input.items) {
      if (!(item.quantity > 0)) throw new Error('A quantidade de cada item deve ser maior que zero')
      if (item.unitPriceCents < 0) throw new Error('O preço não pode ser negativo')
    }

    const grossCents = input.items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0)
    const discountCents = Math.round(input.discountCents || 0)
    if (discountCents < 0 || discountCents > grossCents) throw new Error('Desconto inválido')
    const totalCents = grossCents - discountCents
    if (totalCents <= 0) throw new Error('O valor a cobrar precisa ser maior que zero')

    if (input.installments.length === 0) throw new Error('Informe ao menos uma parcela')
    const installmentsSum = input.installments.reduce((s, p) => s + Math.round(p.amountCents), 0)
    if (installmentsSum !== totalCents) {
      throw new Error('A soma das parcelas precisa ser igual ao valor total da cobrança')
    }
    if (input.installments.some((p) => !/^\d{4}-\d{2}-\d{2}$/.test(p.dueDate))) {
      throw new Error('Data de vencimento inválida')
    }

    // Profissional só cobra os próprios atendimentos.
    let professionalId = input.professionalId ?? null
    if (role === 'professional') {
      const own = ownProfessionalId()
      if (!own) throw new Error('Seu usuário não está vinculado a um profissional')
      if (professionalId && professionalId !== own) throw new Error('Você só pode cobrar os seus atendimentos')
      professionalId = own
    }

    if (input.appointmentId) {
      const existing = db
        .select({ id: sales.id })
        .from(sales)
        .where(and(eq(sales.appointmentId, input.appointmentId), ne(sales.status, 'cancelada'), isNull(sales.deletedAt)))
        .get()
      if (existing) throw new Error('Este atendimento já tem uma cobrança')
      if (!professionalId) {
        const appt = db.select().from(appointments).where(eq(appointments.id, input.appointmentId)).get()
        professionalId = appt?.professionalId ?? null
      }
    }

    const fees = loadCardFees()
    const saleId = randomUUID()
    const timestamp = nowIso()
    const staffMemberId = getCurrentStaffMemberId()
    const count = input.installments.length

    db.transaction((tx) => {
      tx.insert(sales)
        .values({
          id: saleId,
          clinicId,
          patientId: input.patientId,
          appointmentId: input.appointmentId ?? null,
          professionalId,
          grossAmountCents: grossCents,
          discountCents,
          totalAmountCents: totalCents,
          paymentMethod: input.paymentMethod,
          status: saleStatusFrom(input.installments.map((p) => ({ paid: p.paid }))),
          createdBy: staffMemberId,
          createdAt: timestamp,
          updatedAt: timestamp,
          syncStatus: 'pending',
          deletedAt: null
        })
        .run()

      for (const item of input.items) {
        tx.insert(saleItems)
          .values({
            id: randomUUID(),
            clinicId,
            saleId,
            description: item.description,
            kind: item.kind,
            procedureTypeId: item.procedureTypeId ?? null,
            inventoryItemId: item.inventoryItemId ?? null,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            subtotalCents: Math.round(item.quantity * item.unitPriceCents),
            createdAt: timestamp,
            updatedAt: timestamp,
            syncStatus: 'pending',
            deletedAt: null
          })
          .run()

        if (item.kind === 'produto' && item.inventoryItemId) {
          consumeInventoryFefo(tx, {
            clinicId,
            itemId: item.inventoryItemId,
            quantity: item.quantity,
            reason: 'Venda',
            relatedSaleId: saleId,
            createdBy: staffMemberId
          })
        }
      }

      input.installments.forEach((parcel, index) => {
        const amountCents = Math.round(parcel.amountCents)
        tx.insert(installments)
          .values({
            id: randomUUID(),
            clinicId,
            saleId,
            number: index + 1,
            totalInstallments: count,
            amountCents,
            dueDate: parcel.dueDate,
            paidAt: parcel.paid ? timestamp : null,
            paymentMethod: input.paymentMethod,
            feeCents: parcel.paid ? installmentFeeCents(amountCents, input.paymentMethod, count, fees) : 0,
            createdAt: timestamp,
            updatedAt: timestamp,
            syncStatus: 'pending',
            deletedAt: null
          })
          .run()
      })
    })

    return saleId
  })

  // Registra o recebimento de uma parcela (calcula a taxa do cartão na hora).
  handle('sales:receive', EVERYONE, (input: ReceiveInstallmentInput): null => {
    const db = getDb()
    const parcel = db.select().from(installments).where(eq(installments.id, input.installmentId)).get()
    if (!parcel || parcel.deletedAt) throw new Error('Parcela não encontrada')
    if (parcel.paidAt) throw new Error('Esta parcela já foi recebida')
    const sale = db.select().from(sales).where(eq(sales.id, parcel.saleId)).get()
    if (!sale || sale.status === 'cancelada') throw new Error('Esta cobrança está cancelada')
    if (getCurrentStaffRole() === 'professional' && sale.professionalId !== ownProfessionalId()) {
      throw new Error('Você só pode receber os seus atendimentos')
    }

    const fees = loadCardFees()
    const method: PaymentMethod = input.paymentMethod
    const timestamp = nowIso()
    db.transaction((tx) => {
      tx.update(installments)
        .set({
          paidAt: input.paidAt ?? timestamp,
          paymentMethod: method,
          feeCents: installmentFeeCents(parcel.amountCents, method, parcel.totalInstallments, fees),
          updatedAt: timestamp,
          syncStatus: 'pending'
        })
        .where(eq(installments.id, parcel.id))
        .run()
      recomputeSaleStatus(tx, parcel.saleId)
    })
    return null
  })

  // Desfaz um recebimento lançado por engano.
  handle('sales:undoReceive', MANAGERS, (installmentId: string): null => {
    const db = getDb()
    const parcel = db.select().from(installments).where(eq(installments.id, installmentId)).get()
    if (!parcel || !parcel.paidAt) throw new Error('Parcela não encontrada ou ainda não recebida')
    db.transaction((tx) => {
      tx.update(installments)
        .set({ paidAt: null, feeCents: 0, updatedAt: nowIso(), syncStatus: 'pending' })
        .where(eq(installments.id, installmentId))
        .run()
      recomputeSaleStatus(tx, parcel.saleId)
    })
    return null
  })

  handle('sales:cancel', MANAGERS, (saleId: string): null => {
    getDb()
      .update(sales)
      .set({ status: 'cancelada', updatedAt: nowIso(), syncStatus: 'pending' })
      .where(eq(sales.id, saleId))
      .run()
    return null
  })

  // Painel financeiro (visão simples): total, e quebra por forma de pagamento e
  // por tipo de procedimento, num intervalo de datas. Ignora cobranças canceladas.
  handle(
    'sales:financialSummary',
    MANAGERS,
    (params: { from: string; to: string }): FinancialSummary => {
      const db = getDb()
      const salesInRange = db
        .select()
        .from(sales)
        .where(
          and(
            gte(sales.createdAt, params.from),
            lt(sales.createdAt, params.to),
            isNull(sales.deletedAt),
            ne(sales.status, 'cancelada')
          )
        )
        .all()

      const totalAmountCents = salesInRange.reduce((sum, s) => sum + s.totalAmountCents, 0)

      const byPaymentMethodMap = new Map<PaymentMethod, number>()
      for (const sale of salesInRange) {
        byPaymentMethodMap.set(
          sale.paymentMethod,
          (byPaymentMethodMap.get(sale.paymentMethod) ?? 0) + sale.totalAmountCents
        )
      }

      const saleIds = new Set(salesInRange.map((s) => s.id))
      const itemsInRange = db
        .select()
        .from(saleItems)
        .where(isNull(saleItems.deletedAt))
        .all()
        .filter((item) => saleIds.has(item.saleId))

      const byProcedureTypeMap = new Map<string, number>()
      for (const item of itemsInRange) {
        if (item.kind !== 'procedimento') continue
        byProcedureTypeMap.set(item.description, (byProcedureTypeMap.get(item.description) ?? 0) + item.subtotalCents)
      }

      return {
        totalAmountCents,
        salesCount: salesInRange.length,
        byPaymentMethod: [...byPaymentMethodMap.entries()].map(([paymentMethod, totalCents]) => ({
          paymentMethod,
          totalCents
        })),
        byProcedureType: [...byProcedureTypeMap.entries()]
          .map(([name, totalCents]) => ({ name, totalCents }))
          .sort((a, b) => b.totalCents - a.totalCents)
      }
    }
  )

  // Série para o gráfico de vendas: um ponto por dia (ou por mês), incluindo os
  // períodos sem venda (valor zero), agrupados pelo fuso horário do computador.
  handle(
    'sales:financialSeries',
    MANAGERS,
    (params: { from: string; to: string; granularity: 'day' | 'month' }): FinancialSeriesPoint[] => {
      const db = getDb()
      const salesInRange = db
        .select()
        .from(sales)
        .where(
          and(
            gte(sales.createdAt, params.from),
            lt(sales.createdAt, params.to),
            isNull(sales.deletedAt),
            ne(sales.status, 'cancelada')
          )
        )
        .all()

      const buckets = new Map<string, FinancialSeriesPoint>()
      const start = new Date(params.from)
      const end = new Date(params.to)
      const cursor =
        params.granularity === 'day'
          ? new Date(start.getFullYear(), start.getMonth(), start.getDate())
          : new Date(start.getFullYear(), start.getMonth(), 1)

      let guard = 0
      while (cursor <= end && guard++ < 1500) {
        const key = bucketKey(cursor, params.granularity)
        buckets.set(key, { key, totalCents: 0, count: 0 })
        if (params.granularity === 'day') cursor.setDate(cursor.getDate() + 1)
        else cursor.setMonth(cursor.getMonth() + 1)
      }

      for (const sale of salesInRange) {
        const key = bucketKey(new Date(sale.createdAt), params.granularity)
        const point = buckets.get(key) ?? { key, totalCents: 0, count: 0 }
        point.totalCents += sale.totalAmountCents
        point.count += 1
        buckets.set(key, point)
      }

      return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key))
    }
  )
}
