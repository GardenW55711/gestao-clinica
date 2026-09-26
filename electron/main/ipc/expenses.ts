import { randomUUID } from 'crypto'
import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm'
import { getDb } from '../db/client'
import { expenses } from '../db/schema'
import { MANAGERS, handle, nowIso, requireClinicId, todayStr } from './util'
import { addMonthsToDate, isOverdue } from '@shared/finance'
import type { Expense, ExpenseInput } from '@shared/types'

type Row = typeof expenses.$inferSelect

function toDto(row: Row, today: string): Expense {
  return {
    id: row.id,
    description: row.description,
    category: row.category,
    kind: row.kind,
    amountCents: row.amountCents,
    dueDate: row.dueDate,
    paidAt: row.paidAt,
    recurringMonthly: row.recurringMonthly,
    overdue: isOverdue(row.dueDate, row.paidAt, today)
  }
}

function validate(input: ExpenseInput): void {
  if (!input.description.trim()) throw new Error('Informe a descrição da despesa')
  if (!(input.amountCents > 0)) throw new Error('O valor da despesa precisa ser maior que zero')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new Error('Informe a data de vencimento')
}

/**
 * Despesa recorrente gera sozinha a do mês seguinte: garante que existam
 * lançamentos até o mês que vem para cada grupo recorrente. Conta também as
 * excluídas, para não recriar um mês que a pessoa apagou de propósito.
 */
export function ensureRecurringExpenses(): void {
  const db = getDb()
  const clinicId = requireClinicId()
  const today = todayStr()
  const horizon = addMonthsToDate(`${today.slice(0, 7)}-01`, 1).slice(0, 7) // AAAA-MM do mês que vem

  const all = db.select().from(expenses).all()
  const latestByGroup = new Map<string, Row>()
  for (const row of all) {
    if (!row.recurrenceGroupId) continue
    const current = latestByGroup.get(row.recurrenceGroupId)
    if (!current || row.dueDate > current.dueDate) latestByGroup.set(row.recurrenceGroupId, row)
  }

  for (const latest of latestByGroup.values()) {
    if (!latest.recurringMonthly) continue
    let last = latest
    let guard = 0
    while (last.dueDate.slice(0, 7) < horizon && guard++ < 36) {
      const timestamp = nowIso()
      const next: Row = {
        ...last,
        id: randomUUID(),
        dueDate: addMonthsToDate(last.dueDate, 1),
        paidAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
        deletedAt: null,
        clinicId
      }
      db.insert(expenses).values(next).run()
      last = next
    }
  }
}

export function registerExpenseHandlers(): void {
  // Lista por vencimento no período (datas AAAA-MM-DD, ambas incluídas).
  handle('expenses:list', MANAGERS, (params: { from: string; to: string }): Expense[] => {
    ensureRecurringExpenses()
    const today = todayStr()
    return getDb()
      .select()
      .from(expenses)
      .where(and(isNull(expenses.deletedAt), gte(expenses.dueDate, params.from), lte(expenses.dueDate, params.to)))
      .orderBy(asc(expenses.dueDate))
      .all()
      .map((row) => toDto(row, today))
  })

  handle('expenses:create', MANAGERS, (input: ExpenseInput): Expense => {
    validate(input)
    const clinicId = requireClinicId()
    const timestamp = nowIso()
    const id = randomUUID()
    getDb()
      .insert(expenses)
      .values({
        id,
        clinicId,
        description: input.description.trim(),
        category: input.category,
        kind: input.kind,
        amountCents: Math.round(input.amountCents),
        dueDate: input.dueDate,
        paidAt: input.paid ? timestamp : null,
        recurringMonthly: input.recurringMonthly,
        recurrenceGroupId: input.recurringMonthly ? randomUUID() : null,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
        deletedAt: null
      })
      .run()
    ensureRecurringExpenses()
    return toDto(getDb().select().from(expenses).where(eq(expenses.id, id)).get()!, todayStr())
  })

  handle('expenses:update', MANAGERS, (params: { id: string; input: ExpenseInput }): Expense => {
    validate(params.input)
    const db = getDb()
    const current = db.select().from(expenses).where(eq(expenses.id, params.id)).get()
    if (!current) throw new Error('Despesa não encontrada')
    const timestamp = nowIso()
    const input = params.input
    // Começar a repetir cria o grupo; parar de repetir vale para o grupo todo.
    const groupId = input.recurringMonthly ? (current.recurrenceGroupId ?? randomUUID()) : current.recurrenceGroupId
    db.update(expenses)
      .set({
        description: input.description.trim(),
        category: input.category,
        kind: input.kind,
        amountCents: Math.round(input.amountCents),
        dueDate: input.dueDate,
        paidAt: input.paid ? (current.paidAt ?? timestamp) : null,
        recurringMonthly: input.recurringMonthly,
        recurrenceGroupId: groupId,
        updatedAt: timestamp,
        syncStatus: 'pending'
      })
      .where(eq(expenses.id, params.id))
      .run()
    if (!input.recurringMonthly && current.recurrenceGroupId) {
      db.update(expenses)
        .set({ recurringMonthly: false, updatedAt: timestamp, syncStatus: 'pending' })
        .where(eq(expenses.recurrenceGroupId, current.recurrenceGroupId))
        .run()
    }
    ensureRecurringExpenses()
    return toDto(db.select().from(expenses).where(eq(expenses.id, params.id)).get()!, todayStr())
  })

  handle('expenses:setPaid', MANAGERS, (params: { id: string; paid: boolean }): null => {
    getDb()
      .update(expenses)
      .set({ paidAt: params.paid ? nowIso() : null, updatedAt: nowIso(), syncStatus: 'pending' })
      .where(eq(expenses.id, params.id))
      .run()
    return null
  })

  handle('expenses:remove', MANAGERS, (params: { id: string; stopRecurrence: boolean }): null => {
    const db = getDb()
    const current = db.select().from(expenses).where(eq(expenses.id, params.id)).get()
    if (!current) return null
    const timestamp = nowIso()
    db.update(expenses)
      .set({ deletedAt: timestamp, updatedAt: timestamp, syncStatus: 'pending' })
      .where(eq(expenses.id, params.id))
      .run()
    if (params.stopRecurrence && current.recurrenceGroupId) {
      db.update(expenses)
        .set({ recurringMonthly: false, updatedAt: timestamp, syncStatus: 'pending' })
        .where(eq(expenses.recurrenceGroupId, current.recurrenceGroupId))
        .run()
    }
    return null
  })
}
