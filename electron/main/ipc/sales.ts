import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { desc, eq, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { sales, saleItems, patients } from '../db/schema'
import { getCurrentClinicId, getCurrentStaffMemberId } from '../session'
import { consumeInventoryFefo } from '../inventory/fefo'
import type { ApiResult, Sale, SaleInput } from '@shared/types'

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
}
