import { and, eq, isNull, ne } from 'drizzle-orm'
import { getDb } from '../db/client'
import {
  appointments,
  expenses,
  installments,
  inventoryItems,
  inventoryMovements,
  procedureTypeItems,
  procedureTypes,
  professionalWorkingHours,
  professionals,
  saleItems,
  sales,
  scheduleBlocks
} from '../db/schema'
import { EVERYONE, MANAGERS, handle, todayStr } from './util'
import { getCurrentStaffRole } from '../session'
import { ownProfessionalId } from './sales'
import {
  availableMinutes,
  averageTicketCents,
  breakEven,
  cashflowSeries,
  commissionCents,
  delinquency,
  expensesPaidCents,
  idleCostCents,
  inRange,
  localDateStr,
  marginPercent,
  monthOf,
  noShowRate,
  occupancyPercent,
  previousRange,
  procedureMargin,
  receivableCents,
  receivedSummary,
  variableCostsCents,
  type ExpenseRow,
  type InstallmentRow,
  type PaidInstallmentRow,
  type Range,
  type WorkDay
} from '@shared/indicators'
import type { DashboardSummary, OccupancyRow, OverviewData, ProcedureMarginRow, ProductionRow, ReportsData } from '@shared/types'

const COUNTED_STATUSES = ['scheduled', 'confirmed', 'completed'] // ocupam a agenda (sem cancelados nem faltas)

interface FinanceData {
  paid: PaidInstallmentRow[]
  due: InstallmentRow[]
  expenses: ExpenseRow[]
  commissionByProfessional: Map<string, number>
  saleByAppointment: Map<string, typeof sales.$inferSelect>
  saleById: Map<string, typeof sales.$inferSelect>
}

function loadFinanceData(): FinanceData {
  const db = getDb()
  const saleRows = db
    .select()
    .from(sales)
    .where(and(isNull(sales.deletedAt), ne(sales.status, 'cancelada')))
    .all()
  const saleById = new Map(saleRows.map((s) => [s.id, s]))
  const saleByAppointment = new Map<string, typeof sales.$inferSelect>()
  for (const s of saleRows) if (s.appointmentId) saleByAppointment.set(s.appointmentId, s)

  const parcels = db
    .select()
    .from(installments)
    .where(isNull(installments.deletedAt))
    .all()
    .filter((p) => saleById.has(p.saleId))

  const paid: PaidInstallmentRow[] = parcels
    .filter((p) => p.paidAt !== null)
    .map((p) => ({
      saleId: p.saleId,
      professionalId: saleById.get(p.saleId)?.professionalId ?? null,
      amountCents: p.amountCents,
      feeCents: p.feeCents,
      paidAt: p.paidAt as string
    }))
  const due: InstallmentRow[] = parcels.map((p) => ({
    saleId: p.saleId,
    amountCents: p.amountCents,
    dueDate: p.dueDate,
    paidAt: p.paidAt
  }))

  const expenseRows: ExpenseRow[] = db
    .select()
    .from(expenses)
    .where(isNull(expenses.deletedAt))
    .all()
    .map((e) => ({
      amountCents: e.amountCents,
      kind: e.kind,
      category: e.category,
      dueDate: e.dueDate,
      paidAt: e.paidAt
    }))

  const commissionByProfessional = new Map(
    db
      .select({ id: professionals.id, pct: professionals.commissionPercent })
      .from(professionals)
      .where(isNull(professionals.deletedAt))
      .all()
      .map((p) => [p.id, p.pct])
  )

  return { paid, due, expenses: expenseRows, commissionByProfessional, saleByAppointment, saleById }
}

function commissionsInRange(data: FinanceData, range: Range): number {
  let total = 0
  for (const r of data.paid) {
    if (!inRange(r.paidAt, range) || !r.professionalId) continue
    total += commissionCents(r.amountCents, data.commissionByProfessional.get(r.professionalId) ?? 0)
  }
  return total
}

/** Custo dos materiais que saíram do estoque no período (quantidade × custo unitário do item). */
function materialsConsumedCents(range: Range): number {
  const db = getDb()
  const cost = new Map(db.select({ id: inventoryItems.id, c: inventoryItems.unitCostCents }).from(inventoryItems).all().map((i) => [i.id, i.c]))
  return db
    .select()
    .from(inventoryMovements)
    .where(and(isNull(inventoryMovements.deletedAt), eq(inventoryMovements.type, 'saida')))
    .all()
    .filter((m) => inRange(m.createdAt, range))
    .reduce((sum, m) => sum + Math.round(m.quantity * (cost.get(m.itemId) ?? 0)), 0)
}

function appointmentsIn(range: Range): (typeof appointments.$inferSelect)[] {
  return getDb()
    .select()
    .from(appointments)
    .where(isNull(appointments.deletedAt))
    .all()
    .filter((a) => inRange(a.startAt, range))
}

/** Produzido = valor dos atendimentos realizados (cobrança do atendimento ou, sem ela, o preço padrão). */
function producedCents(range: Range, data: FinanceData): { cents: number; completed: number; byProfessional: Map<string, { cents: number; count: number }> } {
  const priceByProcedure = new Map(
    getDb().select({ id: procedureTypes.id, price: procedureTypes.defaultPriceCents }).from(procedureTypes).all().map((p) => [p.id, p.price])
  )
  let cents = 0
  let completed = 0
  const byProfessional = new Map<string, { cents: number; count: number }>()
  for (const a of appointmentsIn(range)) {
    if (a.status !== 'completed') continue
    const sale = data.saleByAppointment.get(a.id)
    const value = sale ? sale.totalAmountCents : (priceByProcedure.get(a.procedureTypeId) ?? 0)
    cents += value
    completed++
    const row = byProfessional.get(a.professionalId) ?? { cents: 0, count: 0 }
    row.cents += value
    row.count++
    byProfessional.set(a.professionalId, row)
  }
  return { cents, completed, byProfessional }
}

function buildOverview(range: Range): OverviewData {
  const data = loadFinanceData()
  const prev = previousRange(range)
  const today = todayStr()

  const rec = receivedSummary(data.paid, range)
  const recPrev = receivedSummary(data.paid, prev)
  const exp = expensesPaidCents(data.expenses, range)
  const expPrev = expensesPaidCents(data.expenses, prev)
  const profit = rec.netCents - exp
  const profitPrev = recPrev.netCents - expPrev

  const fromDate = localDateStr(range.from)
  const toDate = localDateStr(range.to)
  const del = delinquency(data.due, fromDate, toDate, today)
  const delPrev = delinquency(data.due, localDateStr(prev.from), localDateStr(prev.to), today)

  const prod = producedCents(range, data)
  const prodPrev = producedCents(prev, data)

  // Ponto de equilíbrio: sempre do mês em que o período termina.
  const month = monthOf(toDate)
  const monthRange: Range = {
    from: new Date(`${month.first}T00:00:00`).toISOString(),
    to: new Date(`${month.last}T23:59:59.999`).toISOString()
  }
  const monthReceived = receivedSummary(data.paid, monthRange)
  const inMonth = (e: ExpenseRow): boolean => e.dueDate >= month.first && e.dueDate <= month.last
  const fixedCents = data.expenses.filter((e) => e.kind === 'fixa' && inMonth(e)).reduce((s, e) => s + e.amountCents, 0)
  const variable = {
    // As compras de material não entram aqui: o material entra pelo consumo real do estoque.
    variableExpensesCents: data.expenses
      .filter((e) => e.kind === 'variavel' && e.category !== 'materiais' && inMonth(e))
      .reduce((s, e) => s + e.amountCents, 0),
    cardFeesCents: monthReceived.feeCents,
    commissionsCents: commissionsInRange(data, monthRange),
    materialsConsumedCents: materialsConsumedCents(monthRange)
  }
  const variableCents = variableCostsCents(variable)
  const be = breakEven({ fixedCents, receivedCents: monthReceived.grossCents, variableCents })

  return {
    range,
    previous: prev,
    received: { netCents: rec.netCents, grossCents: rec.grossCents, feeCents: rec.feeCents, previousNetCents: recPrev.netCents },
    expenses: { cents: exp, previousCents: expPrev },
    profit: { cents: profit, previousCents: profitPrev },
    margin: {
      percent: marginPercent(profit, rec.netCents),
      previousPercent: marginPercent(profitPrev, recPrev.netCents)
    },
    receivable: {
      cents: receivableCents(data.due, today),
      count: data.due.filter((r) => r.paidAt === null && r.dueDate >= today).length
    },
    delinquency: {
      percent: del.percent,
      previousPercent: delPrev.percent,
      overdueCents: del.overdueCents,
      overdueCount: del.overdueCount,
      dueCount: del.dueCount
    },
    produced: { cents: prod.cents, previousCents: prodPrev.cents, completedCount: prod.completed },
    breakEven: {
      month: month.first.slice(0, 7),
      fixedCents,
      receivedCents: monthReceived.grossCents,
      variableCents,
      variable,
      contributionMarginPercent: be.contributionMarginPercent,
      breakEvenCents: be.breakEvenCents,
      missingCents: be.missingCents,
      reached: be.reached,
      progressPercent: be.progressPercent
    }
  }
}

function productionRows(range: Range, data: FinanceData, onlyProfessionalId?: string): ProductionRow[] {
  const db = getDb()
  const prod = producedCents(range, data)
  return db
    .select()
    .from(professionals)
    .where(isNull(professionals.deletedAt))
    .all()
    .filter((p) => !onlyProfessionalId || p.id === onlyProfessionalId)
    .map((p) => {
      const received = data.paid
        .filter((r) => r.professionalId === p.id && inRange(r.paidAt, range))
        .reduce((s, r) => s + r.amountCents, 0)
      const made = prod.byProfessional.get(p.id) ?? { cents: 0, count: 0 }
      return {
        professionalId: p.id,
        name: p.name,
        appointments: made.count,
        producedCents: made.cents,
        receivedCents: received,
        commissionPercent: p.commissionPercent,
        commissionCents: commissionCents(received, p.commissionPercent)
      }
    })
    .sort((a, b) => b.producedCents - a.producedCents)
}

function buildReports(range: Range, granularity: 'day' | 'month'): ReportsData {
  const db = getDb()
  const data = loadFinanceData()
  const prev = previousRange(range)
  const fromDate = localDateStr(range.from)
  const toDate = localDateStr(range.to)

  // Ticket médio
  const prod = producedCents(range, data)
  const prodPrev = producedCents(prev, data)

  // Ocupação (por profissional e geral)
  const workRows = db.select().from(professionalWorkingHours).where(isNull(professionalWorkingHours.deletedAt)).all()
  const blockRows = db.select().from(scheduleBlocks).where(isNull(scheduleBlocks.deletedAt)).all()
  const profs = db.select().from(professionals).where(and(isNull(professionals.deletedAt), eq(professionals.active, true))).all()
  const apptsInRange = appointmentsIn(range)
  const month = monthOf(toDate)

  const daysOf = (professionalId: string): WorkDay[] | null => {
    const rows = workRows.filter((w) => w.professionalId === professionalId)
    return rows.length
      ? rows.map((w) => ({ weekday: w.weekday, startTime: w.startTime, endTime: w.endTime, breakStart: w.breakStart, breakEnd: w.breakEnd }))
      : null
  }
  const blocksOf = (professionalId: string): { startAt: string; endAt: string }[] =>
    blockRows.filter((b) => b.professionalId === null || b.professionalId === professionalId)

  let bookedTotal = 0
  let availableTotal = 0
  let availableMonthTotal = 0
  const byProfessional: OccupancyRow[] = profs.map((p) => {
    const booked = apptsInRange
      .filter((a) => a.professionalId === p.id && COUNTED_STATUSES.includes(a.status))
      .reduce((s, a) => s + Math.round((new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 60000), 0)
    const available = availableMinutes({ days: daysOf(p.id), blocks: blocksOf(p.id), fromDate, toDate })
    availableMonthTotal += availableMinutes({ days: daysOf(p.id), blocks: blocksOf(p.id), fromDate: month.first, toDate: month.last })
    bookedTotal += booked
    availableTotal += available
    return { professionalId: p.id, name: p.name, bookedMinutes: booked, availableMinutes: available, percent: occupancyPercent(booked, available) }
  })

  // Faltas
  const countable = (list: (typeof appointments.$inferSelect)[]): number => list.filter((a) => a.status !== 'cancelled').length
  const noShowOf = (list: (typeof appointments.$inferSelect)[]): number => list.filter((a) => a.status === 'no_show').length
  const prevAppts = appointmentsIn(prev)

  // Hora ociosa
  const fixedMonth = data.expenses
    .filter((e) => e.kind === 'fixa' && e.dueDate >= month.first && e.dueDate <= month.last)
    .reduce((s, e) => s + e.amountCents, 0)
  const idleMinutes = Math.max(availableTotal - bookedTotal, 0)

  // Margem por procedimento
  const rec = receivedSummary(data.paid, range)
  const feePercent = rec.grossCents > 0 ? (rec.feeCents / rec.grossCents) * 100 : 0
  const commissionPercent = rec.grossCents > 0 ? (commissionsInRange(data, range) / rec.grossCents) * 100 : 0
  const costOf = new Map(db.select({ id: inventoryItems.id, c: inventoryItems.unitCostCents }).from(inventoryItems).all().map((i) => [i.id, i.c]))
  const recipe = db.select().from(procedureTypeItems).where(isNull(procedureTypeItems.deletedAt)).all()
  const materialsFor = (procedureId: string): number =>
    recipe
      .filter((r) => r.procedureTypeId === procedureId)
      .reduce((s, r) => s + Math.round(r.defaultQuantity * (costOf.get(r.inventoryItemId) ?? 0)), 0)

  const salesInRange = [...data.saleById.values()].filter((s) => inRange(s.createdAt, range))
  const saleIds = new Set(salesInRange.map((s) => s.id))
  const soldByProcedure = new Map<string, { qty: number; revenue: number }>()
  for (const item of db.select().from(saleItems).where(isNull(saleItems.deletedAt)).all()) {
    if (!saleIds.has(item.saleId) || item.kind !== 'procedimento' || !item.procedureTypeId) continue
    const sale = data.saleById.get(item.saleId)!
    // O desconto da cobrança é repartido entre os itens na mesma proporção.
    const net = sale.grossAmountCents > 0 ? Math.round((item.subtotalCents * sale.totalAmountCents) / sale.grossAmountCents) : item.subtotalCents
    const row = soldByProcedure.get(item.procedureTypeId) ?? { qty: 0, revenue: 0 }
    row.qty += item.quantity
    row.revenue += net
    soldByProcedure.set(item.procedureTypeId, row)
  }
  const procedureMargins: ProcedureMarginRow[] = db
    .select()
    .from(procedureTypes)
    .where(and(isNull(procedureTypes.deletedAt), eq(procedureTypes.active, true)))
    .all()
    .map((p) => {
      const sold = soldByProcedure.get(p.id)
      const price = sold && sold.qty > 0 ? Math.round(sold.revenue / sold.qty) : p.defaultPriceCents
      const m = procedureMargin({ priceCents: price, materialsCents: materialsFor(p.id), feePercent, commissionPercent })
      return {
        procedureTypeId: p.id,
        name: p.name,
        priceCents: price,
        materialsCents: materialsFor(p.id),
        feeCents: m.feeCents,
        commissionCents: m.commissionCents,
        marginCents: m.marginCents,
        marginPercent: m.marginPercent,
        soldCount: sold?.qty ?? 0,
        estimated: !sold
      }
    })
    .sort((a, b) => b.marginCents - a.marginCents)

  // Despesas por categoria (pagas no período)
  const byCategory = new Map<string, number>()
  for (const e of data.expenses) {
    if (e.paidAt && inRange(e.paidAt, range)) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amountCents)
  }

  return {
    range,
    ticket: {
      producedCents: prod.cents,
      completedCount: prod.completed,
      ticketCents: averageTicketCents(prod.cents, prod.completed),
      previousTicketCents: averageTicketCents(prodPrev.cents, prodPrev.completed)
    },
    occupancy: {
      percent: occupancyPercent(bookedTotal, availableTotal),
      bookedMinutes: bookedTotal,
      availableMinutes: availableTotal,
      byProfessional
    },
    noShow: {
      percent: noShowRate(noShowOf(apptsInRange), countable(apptsInRange)),
      previousPercent: noShowRate(noShowOf(prevAppts), countable(prevAppts)),
      noShowCount: noShowOf(apptsInRange),
      totalCount: countable(apptsInRange)
    },
    idleCost: {
      idleMinutes,
      costCents: idleCostCents(idleMinutes, fixedMonth, availableMonthTotal),
      fixedMonthCents: fixedMonth,
      availableMonthMinutes: availableMonthTotal
    },
    production: productionRows(range, data),
    procedureMargins,
    expensesByCategory: [...byCategory.entries()].map(([category, totalCents]) => ({ category, totalCents })).sort((a, b) => b.totalCents - a.totalCents),
    cashflow: cashflowSeries({ received: data.paid, expenses: data.expenses, range, granularity })
  }
}

/** Números do painel inicial: a receber hoje e parcelas em atraso (o profissional só vê os dele). */
function buildDashboard(): DashboardSummary {
  const data = loadFinanceData()
  const today = todayStr()
  const role = getCurrentStaffRole()
  const own = role === 'professional' ? ownProfessionalId() : null
  let rows = data.due
  if (role === 'professional') {
    rows = data.due.filter((r) => own !== null && data.saleById.get(r.saleId)?.professionalId === own)
  }
  const unpaid = rows.filter((r) => r.paidAt === null)
  const dueToday = unpaid.filter((r) => r.dueDate === today)
  const overdue = unpaid.filter((r) => r.dueDate < today)
  return {
    dueTodayCents: dueToday.reduce((s, r) => s + r.amountCents, 0),
    dueTodayCount: dueToday.length,
    overdueCents: overdue.reduce((s, r) => s + r.amountCents, 0),
    overdueCount: overdue.length
  }
}

export function registerReportHandlers(): void {
  handle('dashboard:summary', EVERYONE, (): DashboardSummary => buildDashboard())

  handle('finance:overview', MANAGERS, (range: Range): OverviewData => buildOverview(range))

  handle('finance:reports', MANAGERS, (params: { range: Range; granularity: 'day' | 'month' }): ReportsData =>
    buildReports(params.range, params.granularity)
  )

  // Profissional enxerga só a própria produção e comissão.
  handle('finance:myProduction', EVERYONE, (range: Range): ProductionRow[] => {
    const role = getCurrentStaffRole()
    const data = loadFinanceData()
    if (role === 'owner' || role === 'admin') return productionRows(range, data)
    if (role === 'professional') {
      const own = ownProfessionalId()
      return own ? productionRows(range, data, own) : []
    }
    throw new Error('Você não tem permissão para esta ação')
  })
}
