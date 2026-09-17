import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { and, eq, isNull, lte } from 'drizzle-orm'
import { getDb } from '../db/client'
import { inventoryItems, inventoryBatches, inventoryMovements } from '../db/schema'
import { getCurrentClinicId, getCurrentStaffMemberId } from '../session'
import { consumeInventoryFefo } from '../inventory/fefo'
import type {
  ApiResult,
  InventoryItemInput,
  InventoryItemSummary,
  InventoryEntryInput,
  InventoryExitInput,
  InventoryBatchAlert
} from '@shared/types'

const EXPIRING_SOON_DAYS = 30

function nowIso(): string {
  return new Date().toISOString()
}

function requireClinicId(): string {
  const id = getCurrentClinicId()
  if (!id) throw new Error('Nenhuma clínica logada')
  return id
}

export function registerInventoryHandlers(): void {
  ipcMain.handle('inventory:items:list', (): ApiResult<InventoryItemSummary[]> => {
    try {
      const db = getDb()
      const items = db.select().from(inventoryItems).where(isNull(inventoryItems.deletedAt)).all()
      const batches = db.select().from(inventoryBatches).where(isNull(inventoryBatches.deletedAt)).all()

      const summaries = items.map((item): InventoryItemSummary => {
        const itemBatches = batches.filter((b) => b.itemId === item.id && b.quantity > 0)
        const currentQuantity = itemBatches.reduce((sum, b) => sum + b.quantity, 0)
        const nextExpiry = itemBatches
          .map((b) => b.expiryDate)
          .filter((d): d is string => Boolean(d))
          .sort()[0]
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          unit: item.unit,
          minQuantity: item.minQuantity,
          unitCost: item.unitCost,
          currentQuantity,
          nextExpiry: nextExpiry ?? null
        }
      })

      return { ok: true, data: summaries }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('inventory:items:create', (_e, input: InventoryItemInput): ApiResult<InventoryItemSummary> => {
    try {
      const clinicId = requireClinicId()
      const db = getDb()
      const id = randomUUID()
      const timestamp = nowIso()

      db.insert(inventoryItems)
        .values({
          id,
          clinicId,
          name: input.name,
          category: input.category ?? null,
          unit: input.unit,
          minQuantity: input.minQuantity,
          unitCost: input.unitCost,
          createdAt: timestamp,
          updatedAt: timestamp,
          syncStatus: 'pending',
          deletedAt: null
        })
        .run()

      return {
        ok: true,
        data: {
          id,
          name: input.name,
          category: input.category ?? null,
          unit: input.unit,
          minQuantity: input.minQuantity,
          unitCost: input.unitCost,
          currentQuantity: 0,
          nextExpiry: null
        }
      }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('inventory:items:remove', (_e, id: string): ApiResult<null> => {
    try {
      const db = getDb()
      db.update(inventoryItems)
        .set({ deletedAt: nowIso(), updatedAt: nowIso(), syncStatus: 'pending' })
        .where(eq(inventoryItems.id, id))
        .run()
      return { ok: true, data: null }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  // Entrada de estoque: sempre cria um lote novo (cada entrega pode ter uma
  // validade diferente da anterior, mesmo sendo o mesmo item).
  ipcMain.handle('inventory:batches:addEntry', (_e, input: InventoryEntryInput): ApiResult<null> => {
    try {
      const clinicId = requireClinicId()
      const db = getDb()
      const timestamp = nowIso()
      const batchId = randomUUID()

      db.transaction((tx) => {
        tx.insert(inventoryBatches)
          .values({
            id: batchId,
            clinicId,
            itemId: input.itemId,
            batchCode: input.batchCode ?? null,
            quantity: input.quantity,
            expiryDate: input.expiryDate ?? null,
            receivedAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
            syncStatus: 'pending',
            deletedAt: null
          })
          .run()

        tx.insert(inventoryMovements)
          .values({
            id: randomUUID(),
            clinicId,
            itemId: input.itemId,
            batchId,
            type: 'entrada',
            quantity: input.quantity,
            reason: null,
            relatedSaleId: null,
            createdBy: getCurrentStaffMemberId(),
            createdAt: timestamp,
            updatedAt: timestamp,
            syncStatus: 'pending',
            deletedAt: null
          })
          .run()
      })

      return { ok: true, data: null }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  // Saída manual: consome primeiro o lote que vence mais cedo (FEFO), pra
  // reduzir a chance de perder material por vencimento.
  ipcMain.handle('inventory:movements:addExit', (_e, input: InventoryExitInput): ApiResult<null> => {
    try {
      const clinicId = requireClinicId()
      const db = getDb()

      db.transaction((tx) => {
        consumeInventoryFefo(tx, {
          clinicId,
          itemId: input.itemId,
          quantity: input.quantity,
          reason: input.reason ?? null,
          relatedSaleId: null,
          createdBy: getCurrentStaffMemberId()
        })
      })

      return { ok: true, data: null }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('inventory:batches:expiringSoon', (): ApiResult<InventoryBatchAlert[]> => {
    try {
      const db = getDb()
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() + EXPIRING_SOON_DAYS)
      const cutoffIso = cutoff.toISOString().slice(0, 10)
      const today = new Date().toISOString().slice(0, 10)

      const rows = db
        .select()
        .from(inventoryBatches)
        .leftJoin(inventoryItems, eq(inventoryBatches.itemId, inventoryItems.id))
        .where(and(isNull(inventoryBatches.deletedAt), lte(inventoryBatches.expiryDate, cutoffIso)))
        .all()

      const alerts = rows
        .filter((r) => r.inventory_batches.quantity > 0 && r.inventory_batches.expiryDate)
        .map(
          (r): InventoryBatchAlert => ({
            itemId: r.inventory_batches.itemId,
            itemName: r.inventory_items?.name ?? '(item removido)',
            batchCode: r.inventory_batches.batchCode,
            quantity: r.inventory_batches.quantity,
            expiryDate: r.inventory_batches.expiryDate as string,
            status: (r.inventory_batches.expiryDate as string) < today ? 'expired' : 'expiring_soon'
          })
        )
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))

      return { ok: true, data: alerts }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })
}
