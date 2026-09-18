import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm'
import { getDb } from '../db/client'
import { sales, saleItems, patients } from '../db/schema'
import { getCurrentClinicId, getCurrentStaffMemberId } from '../session'
import { consumeInventoryFefo } from '../inventory/fefo'
import type { ApiResult, FinancialSummary, PaymentMethod, Sale, SaleInput } from '@shared/types'

function nowIso(): string {
  return new Date().toISOString()
}

function requireClinicId(): string {
  const id = getCurrentClinicId()
  if (!id) throw new Error('Nenhuma clínica logada')
  return id
}

export function registerSalesHandlers(): void {
  ipcMain.handle('sales:list', (): ApiResult<Sale[]> => {
    try {
      const db = getDb()
      const saleRows = db
        .select()
        .from(sales)
        .leftJoin(patients, eq(sales.patientId, patients.id))
        .where(isNull(sales.deletedAt))
        .orderBy(desc(sales.createdAt))
        .limit(50)
        .all()

      const itemRows = db.select().from(saleItems).where(isNull(saleItems.deletedAt)).all()

      const data: Sale[] = saleRows.map((row) => ({
        id: row.sales.id,
        patientId: row.sales.patientId,
        patientName: row.patients?.name ?? '(paciente removido)',
        totalAmount: row.sales.totalAmount,
        paymentMethod: row.sales.paymentMethod,
        status: row.sales.status,
        createdAt: row.sales.createdAt,
        items: itemRows
          .filter((item) => item.saleId === row.sales.id)
          .map((item) => ({
            id: item.id,
            description: item.description,
            kind: item.kind,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal
          }))
      }))

      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sales:create', (_e, input: SaleInput): ApiResult<null> => {
    try {
      const clinicId = requireClinicId()
      const db = getDb()

      if (input.items.length === 0) throw new Error('Adicione ao menos um item à venda')

      const totalAmount = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      const saleId = randomUUID()
      const timestamp = nowIso()
      const staffMemberId = getCurrentStaffMemberId()

      db.transaction((tx) => {
        tx.insert(sales)
          .values({
            id: saleId,
            clinicId,
            patientId: input.patientId,
            appointmentId: null,
            professionalId: null,
            totalAmount,
            paymentMethod: input.paymentMethod,
            status: 'paga',
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
              unitPrice: item.unitPrice,
              subtotal: item.quantity * item.unitPrice,
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
      })

      return { ok: true, data: null }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  // Painel financeiro: total, e quebra por forma de pagamento e por tipo de
  // procedimento, num intervalo de datas (usado pelos botões Hoje/7 dias/Mês).
  ipcMain.handle(
    'sales:financialSummary',
    (_e, params: { from: string; to: string }): ApiResult<FinancialSummary> => {
      try {
        const db = getDb()

        const salesInRange = db
          .select()
          .from(sales)
          .where(and(gte(sales.createdAt, params.from), lt(sales.createdAt, params.to), isNull(sales.deletedAt)))
          .all()

        const totalAmount = salesInRange.reduce((sum, s) => sum + s.totalAmount, 0)

        const byPaymentMethodMap = new Map<PaymentMethod, number>()
        for (const sale of salesInRange) {
          byPaymentMethodMap.set(
            sale.paymentMethod,
            (byPaymentMethodMap.get(sale.paymentMethod) ?? 0) + sale.totalAmount
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
          byProcedureTypeMap.set(item.description, (byProcedureTypeMap.get(item.description) ?? 0) + item.subtotal)
        }

        return {
          ok: true,
          data: {
            totalAmount,
            byPaymentMethod: [...byPaymentMethodMap.entries()].map(([paymentMethod, total]) => ({
              paymentMethod,
              total
            })),
            byProcedureType: [...byProcedureTypeMap.entries()]
              .map(([name, total]) => ({ name, total }))
              .sort((a, b) => b.total - a.total)
          }
        }
      } catch (error) {
        return { ok: false, error: (error as Error).message }
      }
    }
  )
}
