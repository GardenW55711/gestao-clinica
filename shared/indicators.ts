// Fórmulas dos indicadores financeiros e de agenda. Tudo aqui é "puro" (recebe
// dados, devolve números), em CENTAVOS, para poder ser testado com exemplos.
import { percentOf } from './money'

/** Período com instantes ISO; `to` é inclusivo (23:59:59.999 do último dia). */
export interface Range {
  from: string
  to: string
}

export type Traffic = 'green' | 'yellow' | 'red' | 'none'

// ---------- dados de entrada ----------

export interface PaidInstallmentRow {
  saleId: string
  professionalId: string | null
  amountCents: number
  feeCents: number
  paidAt: string
}

export interface InstallmentRow {
  saleId: string
  amountCents: number
  dueDate: string // AAAA-MM-DD
  paidAt: string | null
}

export interface ExpenseRow {
  amountCents: number
  kind: 'fixa' | 'variavel'
  category: string
  dueDate: string
  paidAt: string | null
}

// ---------- datas ----------

const pad = (n: number): string => String(n).padStart(2, '0')

/** AAAA-MM-DD no fuso do computador. */
export function localDateStr(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function inRange(iso: string, range: Range): boolean {
  return iso >= range.from && iso <= range.to
}

/** Período de mesmo tamanho imediatamente antes (para comparar "com o período anterior"). */
export function previousRange(range: Range): Range {
  const from = new Date(range.from).getTime()
  const to = new Date(range.to).getTime()
  const length = to - from + 1
  return { from: new Date(from - length).toISOString(), to: new Date(from - 1).toISOString() }
}

/** Primeiro e último dia (AAAA-MM-DD) do mês que contém a data informada. */
export function monthOf(dateStr: string): { first: string; last: string } {
  const [y, m] = dateStr.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return { first: `${y}-${pad(m)}-01`, last: `${y}-${pad(m)}-${pad(lastDay)}` }
}

// ---------- caixa: recebido, despesas, lucro ----------

export function receivedSummary(
  rows: PaidInstallmentRow[],
  range: Range
): { grossCents: number; feeCents: number; netCents: number } {
  let grossCents = 0
  let feeCents = 0
  for (const r of rows) {
    if (!inRange(r.paidAt, range)) continue
    grossCents += r.amountCents
    feeCents += r.feeCents
  }
  return { grossCents, feeCents, netCents: grossCents - feeCents }
}

export function expensesPaidCents(rows: ExpenseRow[], range: Range): number {
  return rows.reduce((sum, e) => (e.paidAt && inRange(e.paidAt, range) ? sum + e.amountCents : sum), 0)
}

/** Margem de lucro em %: lucro ÷ recebido × 100. Sem recebimento não há margem (null). */
export function marginPercent(profitCents: number, receivedCents: number): number | null {
  if (receivedCents <= 0) return null
  return (profitCents / receivedCents) * 100
}

/** Variação em % de um valor em relação ao período anterior (null quando o anterior é zero). */
export function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/** A receber: parcelas ainda não pagas com vencimento de hoje em diante. */
export function receivableCents(rows: InstallmentRow[], today: string): number {
  return rows.reduce((sum, r) => (r.paidAt === null && r.dueDate >= today ? sum + r.amountCents : sum), 0)
}

/**
 * Inadimplência: parcelas vencidas e não pagas ÷ total de parcelas que
 * venciam no período × 100 (por quantidade de parcelas).
 */
export function delinquency(
  rows: InstallmentRow[],
  fromDate: string,
  toDate: string,
  today: string
): { dueCount: number; overdueCount: number; overdueCents: number; percent: number | null } {
  let dueCount = 0
  let overdueCount = 0
  let overdueCents = 0
  for (const r of rows) {
    if (r.dueDate < fromDate || r.dueDate > toDate) continue
    dueCount++
    if (r.paidAt === null && r.dueDate < today) {
      overdueCount++
      overdueCents += r.amountCents
    }
  }
  return { dueCount, overdueCount, overdueCents, percent: dueCount > 0 ? (overdueCount / dueCount) * 100 : null }
}

// ---------- ponto de equilíbrio ----------

/**
 * Custos variáveis = despesas variáveis + taxas de cartão + comissões + custo dos
 * materiais consumidos. (As compras de material NÃO entram como despesa variável aqui,
 * senão o mesmo material seria contado duas vezes: na compra e no consumo.)
 */
export function variableCostsCents(parts: {
  variableExpensesCents: number
  cardFeesCents: number
  commissionsCents: number
  materialsConsumedCents: number
}): number {
  return parts.variableExpensesCents + parts.cardFeesCents + parts.commissionsCents + parts.materialsConsumedCents
}

/**
 * Ponto de equilíbrio = custos fixos ÷ margem de contribuição (%), sendo
 * margem de contribuição % = (recebido − custos variáveis) ÷ recebido.
 * Devolve null no ponto de equilíbrio quando não dá para calcular
 * (sem recebimento no mês, ou custos variáveis que já comem toda a receita).
 */
export function breakEven(params: { fixedCents: number; receivedCents: number; variableCents: number }): {
  contributionMarginPercent: number | null
  breakEvenCents: number | null
  missingCents: number | null
  reached: boolean
  progressPercent: number
} {
  const { fixedCents, receivedCents, variableCents } = params
  if (receivedCents <= 0) {
    return { contributionMarginPercent: null, breakEvenCents: null, missingCents: null, reached: false, progressPercent: 0 }
  }
  const margin = (receivedCents - variableCents) / receivedCents
  if (margin <= 0) {
    return { contributionMarginPercent: margin * 100, breakEvenCents: null, missingCents: null, reached: false, progressPercent: 0 }
  }
  const breakEvenCents = Math.round(fixedCents / margin)
  const reached = receivedCents >= breakEvenCents
  return {
    contributionMarginPercent: margin * 100,
    breakEvenCents,
    missingCents: reached ? 0 : breakEvenCents - receivedCents,
    reached,
    progressPercent: breakEvenCents > 0 ? Math.min((receivedCents / breakEvenCents) * 100, 100) : 100
  }
}

// ---------- semáforos ----------

/** Margem: verde ≥ 35%, amarelo 20–35%, vermelho < 20%. */
export function marginTraffic(percent: number | null): Traffic {
  if (percent === null) return 'none'
  return percent >= 35 ? 'green' : percent >= 20 ? 'yellow' : 'red'
}

/** Inadimplência: verde < 5%, amarelo 5–10%, vermelho > 10%. */
export function delinquencyTraffic(percent: number | null): Traffic {
  if (percent === null) return 'none'
  return percent < 5 ? 'green' : percent <= 10 ? 'yellow' : 'red'
}

/** Ocupação: verde ≥ 75%, amarelo 60–75%, vermelho < 60%. */
export function occupancyTraffic(percent: number | null): Traffic {
  if (percent === null) return 'none'
  return percent >= 75 ? 'green' : percent >= 60 ? 'yellow' : 'red'
}

/** Faltas: verde < 10%, amarelo 10–15%, vermelho > 15%. */
export function noShowTraffic(percent: number | null): Traffic {
  if (percent === null) return 'none'
  return percent < 10 ? 'green' : percent <= 15 ? 'yellow' : 'red'
}

/** Lucro: vermelho se negativo. */
export function profitTraffic(profitCents: number): Traffic {
  return profitCents < 0 ? 'red' : 'none'
}

// ---------- relatórios ----------

/** Ticket médio = produzido ÷ atendimentos concluídos. */
export function averageTicketCents(producedCents: number, completedCount: number): number {
  return completedCount > 0 ? Math.round(producedCents / completedCount) : 0
}

/** Faltas = no-shows ÷ total de agendamentos (sem cancelados) × 100. */
export function noShowRate(noShowCount: number, nonCancelledCount: number): number | null {
  return nonCancelledCount > 0 ? (noShowCount / nonCancelledCount) * 100 : null
}

/** Ocupação = horas agendadas ÷ horas disponíveis × 100. */
export function occupancyPercent(bookedMinutes: number, availableMinutes: number): number | null {
  return availableMinutes > 0 ? (bookedMinutes / availableMinutes) * 100 : null
}

/** Custo da hora ociosa = horas vagas × (custos fixos do mês ÷ horas disponíveis no mês). */
export function idleCostCents(idleMinutes: number, fixedMonthCents: number, availableMonthMinutes: number): number {
  if (availableMonthMinutes <= 0 || idleMinutes <= 0) return 0
  return Math.round((idleMinutes / 60) * (fixedMonthCents / (availableMonthMinutes / 60)))
}

/** Comissão do profissional: percentual sobre o valor recebido no período. */
export function commissionCents(receivedCents: number, percent: number): number {
  return percentOf(receivedCents, percent)
}

/**
 * Margem de um procedimento = preço cobrado − materiais − taxa média de cartão − comissão.
 * `feePercent` e `commissionPercent` são as taxas médias efetivas do período.
 */
export function procedureMargin(params: {
  priceCents: number
  materialsCents: number
  feePercent: number
  commissionPercent: number
}): { feeCents: number; commissionCents: number; marginCents: number; marginPercent: number | null } {
  const feeCents = percentOf(params.priceCents, params.feePercent)
  const commission = percentOf(params.priceCents, params.commissionPercent)
  const marginCents = params.priceCents - params.materialsCents - feeCents - commission
  return {
    feeCents,
    commissionCents: commission,
    marginCents,
    marginPercent: params.priceCents > 0 ? (marginCents / params.priceCents) * 100 : null
  }
}

// ---------- horas disponíveis (horário de trabalho − bloqueios) ----------

export interface WorkDay {
  weekday: number
  startTime: string
  endTime: string
  breakStart: string | null
  breakEnd: string | null
}

/** Sem horário cadastrado, assume segunda a sexta, 08:00–18:00 (sem intervalo). */
export const DEFAULT_WORK_DAYS: WorkDay[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startTime: '08:00',
  endTime: '18:00',
  breakStart: null,
  breakEnd: null
}))

const toMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

type Segment = [number, number]

function subtract(segments: Segment[], [bs, be]: Segment): Segment[] {
  const out: Segment[] = []
  for (const [s, e] of segments) {
    if (be <= s || bs >= e) out.push([s, e])
    else {
      if (bs > s) out.push([s, bs])
      if (be < e) out.push([be, e])
    }
  }
  return out
}

/**
 * Minutos em que o profissional pode atender entre duas datas (AAAA-MM-DD, inclusive):
 * horário de trabalho de cada dia, menos o intervalo, menos os bloqueios.
 * `blocks` = bloqueios que valem para ele (dele ou de todos).
 */
export function availableMinutes(params: {
  days: WorkDay[] | null
  blocks: { startAt: string; endAt: string }[]
  fromDate: string
  toDate: string
}): number {
  const days = params.days && params.days.length > 0 ? params.days : DEFAULT_WORK_DAYS
  const [fy, fm, fd] = params.fromDate.split('-').map(Number)
  const [ty, tm, td] = params.toDate.split('-').map(Number)
  const end = new Date(ty, tm - 1, td)
  let total = 0
  for (let d = new Date(fy, fm - 1, fd); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const day = days.find((x) => x.weekday === d.getDay())
    if (!day) continue
    let segments: Segment[] = [[toMin(day.startTime), toMin(day.endTime)]]
    if (day.breakStart && day.breakEnd) segments = subtract(segments, [toMin(day.breakStart), toMin(day.breakEnd)])
    const dayStart = d.getTime()
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
    for (const b of params.blocks) {
      const s = new Date(b.startAt).getTime()
      const e = new Date(b.endAt).getTime()
      if (e <= dayStart || s >= dayEnd) continue
      const bs = s <= dayStart ? 0 : Math.round((s - dayStart) / 60000)
      const be = e >= dayEnd ? 24 * 60 : Math.round((e - dayStart) / 60000)
      segments = subtract(segments, [bs, be])
    }
    total += segments.reduce((sum, [s, e]) => sum + (e - s), 0)
  }
  return total
}

// ---------- fluxo de caixa ----------

export interface CashflowPoint {
  key: string
  inCents: number
  outCents: number
  balanceCents: number // saldo acumulado dentro do período
}

/** Entradas (recebido líquido), saídas (despesas pagas) e saldo acumulado, por dia ou por mês. */
export function cashflowSeries(params: {
  received: PaidInstallmentRow[]
  expenses: ExpenseRow[]
  range: Range
  granularity: 'day' | 'month'
}): CashflowPoint[] {
  const { received, expenses, range, granularity } = params
  const keyOf = (iso: string): string => {
    const d = localDateStr(iso)
    return granularity === 'day' ? d : d.slice(0, 7)
  }
  const buckets = new Map<string, { inCents: number; outCents: number }>()
  const start = new Date(range.from)
  const end = new Date(range.to)
  const cursor =
    granularity === 'day'
      ? new Date(start.getFullYear(), start.getMonth(), start.getDate())
      : new Date(start.getFullYear(), start.getMonth(), 1)
  let guard = 0
  while (cursor <= end && guard++ < 1500) {
    buckets.set(keyOf(cursor.toISOString()), { inCents: 0, outCents: 0 })
    if (granularity === 'day') cursor.setDate(cursor.getDate() + 1)
    else cursor.setMonth(cursor.getMonth() + 1)
  }
  for (const r of received) {
    if (!inRange(r.paidAt, range)) continue
    const b = buckets.get(keyOf(r.paidAt))
    if (b) b.inCents += r.amountCents - r.feeCents
  }
  for (const e of expenses) {
    if (!e.paidAt || !inRange(e.paidAt, range)) continue
    const b = buckets.get(keyOf(e.paidAt))
    if (b) b.outCents += e.amountCents
  }
  let balance = 0
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      balance += v.inCents - v.outCents
      return { key, inCents: v.inCents, outCents: v.outCents, balanceCents: balance }
    })
}
