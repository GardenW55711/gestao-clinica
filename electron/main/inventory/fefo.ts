import { randomUUID } from 'crypto'
import { and, eq, isNull } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { inventoryBatches, inventoryMovements } from '../db/schema'
import * as schema from '../db/schema'

/**
 * Dá baixa num item de estoque consumindo primeiro o lote que vence mais
 * cedo (FEFO — "first expired, first out"). Usada tanto na saída manual de
 * estoque quanto na baixa automática quando um produto é usado numa venda.
 * Recebe a conexão (ou uma transação em andamento) pra poder ser chamada
 * dentro de uma transação maior sem aninhar transações.
 */
export function consumeInventoryFefo(
  db: BetterSQLite3Database<typeof schema>,
  params: {
    clinicId: string
    itemId: string
    quantity: number
    reason: string | null
    relatedSaleId?: string | null
    relatedAppointmentId?: string | null
    createdBy: string | null
  }
): void {
  const batches = db
    .select()
    .from(inventoryBatches)
    .where(and(eq(inventoryBatches.itemId, params.itemId), isNull(inventoryBatches.deletedAt)))
    .all()
    .filter((b) => b.quantity > 0)
    .sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0
      if (!a.expiryDate) return 1
      if (!b.expiryDate) return -1
      return a.expiryDate.localeCompare(b.expiryDate)
    })

  const available = batches.reduce((sum, b) => sum + b.quantity, 0)
  if (available < params.quantity) {
    throw new Error(`Estoque insuficiente para o item (disponível: ${available}, pedido: ${params.quantity})`)
  }

  let remaining = params.quantity
  const timestamp = new Date().toISOString()

  for (const batch of batches) {
    if (remaining <= 0) break
    const take = Math.min(batch.quantity, remaining)
    remaining -= take

    db.update(inventoryBatches)
      .set({ quantity: batch.quantity - take, updatedAt: timestamp, syncStatus: 'pending' })
      .where(eq(inventoryBatches.id, batch.id))
      .run()

    db.insert(inventoryMovements)
      .values({
        id: randomUUID(),
        clinicId: params.clinicId,
        itemId: params.itemId,
        batchId: batch.id,
        type: 'saida',
        quantity: take,
        reason: params.reason,
        relatedSaleId: params.relatedSaleId ?? null,
        relatedAppointmentId: params.relatedAppointmentId ?? null,
        createdBy: params.createdBy,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
        deletedAt: null
      })
      .run()
  }
}
