import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { and, eq, isNull } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { getDb } from '../db/client'
import * as schema from '../db/schema'
import { inventoryItems, procedureTypeItems, procedureTypes } from '../db/schema'
import { getCurrentClinicId } from '../session'
import type { ApiResult, ProcedureItemUsage, ProcedureType, ProcedureTypeInput } from '@shared/types'

type Db = BetterSQLite3Database<typeof schema>

function nowIso(): string {
  return new Date().toISOString()
}

function requireClinicId(): string {
  const id = getCurrentClinicId()
  if (!id) throw new Error('Nenhuma clínica logada')
  return id
}

function validate(input: ProcedureTypeInput): void {
  if (!input.name?.trim()) throw new Error('Informe o nome do procedimento')
  if (!(input.durationMinutes > 0)) throw new Error('A duração precisa ser maior que zero')
  if (input.defaultPrice < 0) throw new Error('O preço não pode ser negativo')
  for (const item of input.items ?? []) {
    if (!(item.defaultQuantity > 0)) throw new Error('A quantidade padrão de cada produto precisa ser maior que zero')
  }
}

function loadUsageMap(db: Db): Map<string, ProcedureItemUsage[]> {
  const rows = db
    .select()
    .from(procedureTypeItems)
    .leftJoin(inventoryItems, eq(procedureTypeItems.inventoryItemId, inventoryItems.id))
    .where(isNull(procedureTypeItems.deletedAt))
    .all()

  const map = new Map<string, ProcedureItemUsage[]>()
  for (const row of rows) {
    // produto removido do estoque não entra mais na baixa automática
    if (!row.inventory_items || row.inventory_items.deletedAt) continue
    const list = map.get(row.procedure_type_items.procedureTypeId) ?? []
    list.push({
      inventoryItemId: row.procedure_type_items.inventoryItemId,
      itemName: row.inventory_items.name,
      unit: row.inventory_items.unit,
      defaultQuantity: row.procedure_type_items.defaultQuantity
    })
    map.set(row.procedure_type_items.procedureTypeId, list)
  }
  for (const list of map.values()) list.sort((a, b) => a.itemName.localeCompare(b.itemName, 'pt-BR'))
  return map
}

function toDto(row: typeof procedureTypes.$inferSelect, usage: Map<string, ProcedureItemUsage[]>): ProcedureType {
  return {
    id: row.id,
    name: row.name,
    durationMinutes: row.durationMinutes,
    defaultPrice: row.defaultPrice,
    requiresRoom: row.requiresRoom,
    bookableOnline: row.bookableOnline,
    active: row.active,
    items: usage.get(row.id) ?? []
  }
}

/** Sincroniza os produtos do procedimento: atualiza, cria e "apaga de forma suave" os que saíram. */
function syncItems(db: Db, clinicId: string, procedureTypeId: string, items: ProcedureTypeInput['items']): void {
  const timestamp = nowIso()
  const wanted = new Map<string, number>()
  for (const item of items ?? []) wanted.set(item.inventoryItemId, item.defaultQuantity)

  const existing = db
    .select()
    .from(procedureTypeItems)
    .where(eq(procedureTypeItems.procedureTypeId, procedureTypeId))
    .all()
  const byItem = new Map(existing.map((e) => [e.inventoryItemId, e]))

  for (const [inventoryItemId, defaultQuantity] of wanted) {
    const current = byItem.get(inventoryItemId)
    if (current) {
      db.update(procedureTypeItems)
        .set({ defaultQuantity, deletedAt: null, updatedAt: timestamp, syncStatus: 'pending' })
        .where(eq(procedureTypeItems.id, current.id))
        .run()
    } else {
      db.insert(procedureTypeItems)
        .values({
          id: randomUUID(),
          clinicId,
          procedureTypeId,
          inventoryItemId,
          defaultQuantity,
          createdAt: timestamp,
          updatedAt: timestamp,
          syncStatus: 'pending',
          deletedAt: null
        })
        .run()
    }
  }

  for (const current of existing) {
    if (!wanted.has(current.inventoryItemId) && !current.deletedAt) {
      db.update(procedureTypeItems)
        .set({ deletedAt: timestamp, updatedAt: timestamp, syncStatus: 'pending' })
        .where(eq(procedureTypeItems.id, current.id))
        .run()
    }
  }
}

export function registerProcedureHandlers(): void {
  ipcMain.handle('procedureTypes:list', (): ApiResult<ProcedureType[]> => {
    try {
      const db = getDb()
      const usage = loadUsageMap(db)
      const rows = db.select().from(procedureTypes).where(isNull(procedureTypes.deletedAt)).all()
      rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      return { ok: true, data: rows.map((r) => toDto(r, usage)) }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('procedureTypes:create', (_e, input: ProcedureTypeInput): ApiResult<ProcedureType> => {
    try {
      validate(input)
      const clinicId = requireClinicId()
      const db = getDb()
      const id = randomUUID()
      const timestamp = nowIso()

      db.transaction((tx) => {
        tx.insert(procedureTypes)
          .values({
            id,
            clinicId,
            name: input.name.trim(),
            durationMinutes: input.durationMinutes,
            defaultPrice: input.defaultPrice,
            requiresRoom: input.requiresRoom,
            bookableOnline: false,
            active: true,
            createdAt: timestamp,
            updatedAt: timestamp,
            syncStatus: 'pending',
            deletedAt: null
          })
          .run()
        syncItems(tx, clinicId, id, input.items)
      })

      const row = db.select().from(procedureTypes).where(eq(procedureTypes.id, id)).get()!
      return { ok: true, data: toDto(row, loadUsageMap(db)) }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(
    'procedureTypes:update',
    (_e, params: { id: string; input: ProcedureTypeInput }): ApiResult<ProcedureType> => {
      try {
        validate(params.input)
        const clinicId = requireClinicId()
        const db = getDb()

        db.transaction((tx) => {
          tx.update(procedureTypes)
            .set({
              name: params.input.name.trim(),
              durationMinutes: params.input.durationMinutes,
              defaultPrice: params.input.defaultPrice,
              requiresRoom: params.input.requiresRoom,
              updatedAt: nowIso(),
              syncStatus: 'pending'
            })
            .where(eq(procedureTypes.id, params.id))
            .run()
          syncItems(tx, clinicId, params.id, params.input.items)
        })

        const row = db.select().from(procedureTypes).where(eq(procedureTypes.id, params.id)).get()!
        return { ok: true, data: toDto(row, loadUsageMap(db)) }
      } catch (error) {
        return { ok: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle('procedureTypes:remove', (_e, id: string): ApiResult<null> => {
    try {
      const db = getDb()
      const timestamp = nowIso()
      db.transaction((tx) => {
        tx.update(procedureTypes)
          .set({ deletedAt: timestamp, updatedAt: timestamp, syncStatus: 'pending' })
          .where(eq(procedureTypes.id, id))
          .run()
        tx.update(procedureTypeItems)
          .set({ deletedAt: timestamp, updatedAt: timestamp, syncStatus: 'pending' })
          .where(and(eq(procedureTypeItems.procedureTypeId, id), isNull(procedureTypeItems.deletedAt)))
          .run()
      })
      return { ok: true, data: null }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })
}
