import type { Appointment, AppointmentStatus, Professional, ProfessionalWorkingHours, ScheduleBlock } from '@shared/types'

export type CalendarView = 'day' | 'week' | 'month'

export const HOUR_PX = 76
export const PX_PER_MIN = HOUR_PX / 60
export const SNAP_MIN = 15
export const DEFAULT_START_HOUR = 8
export const DEFAULT_END_HOUR = 19

export const STATUS_META: Record<AppointmentStatus, { label: string }> = {
  scheduled: { label: 'Agendado' },
  confirmed: { label: 'Confirmado' },
  completed: { label: 'Realizado' },
  no_show: { label: 'Faltou' },
  cancelled: { label: 'Cancelado' }
}

export const STATUS_ORDER: AppointmentStatus[] = ['scheduled', 'confirmed', 'completed', 'no_show', 'cancelled']

const PALETTE = ['#2f9e6e', '#3b82c4', '#a855c7', '#e0803a', '#d6567a', '#2aa5a0', '#8b7be0', '#b58a1b']

export function professionalColor(professional: Professional, index: number): string {
  if (professional.color && /^#[0-9a-f]{6}$/i.test(professional.color)) return professional.color
  return PALETTE[index % PALETTE.length]
}

const pad = (n: number): string => String(n).padStart(2, '0')

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

/** Semana começando no domingo, como o calendário do celular no Brasil. */
export function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay())
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** Início da grade do mês (domingo da primeira semana) e quantas semanas ela tem. */
export function monthGrid(month: Date): { start: Date; weeks: number } {
  const first = startOfMonth(month)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  return { start: startOfWeek(first), weeks: Math.ceil((last.getDate() + first.getDay()) / 7) }
}

export function minutesOfDay(iso: string | Date): number {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.getHours() * 60 + d.getMinutes()
}

export function formatClock(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function minutesToClock(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

export interface Placed {
  appt: Appointment
  col: number
  cols: number
}

/**
 * Coloca agendamentos que se sobrepõem lado a lado (como Google/Apple Agenda):
 * cada grupo de eventos que se tocam divide a largura da coluna igualmente.
 */
export function layoutOverlaps(appts: Appointment[]): Placed[] {
  const sorted = [...appts].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime() || new Date(b.endAt).getTime() - new Date(a.endAt).getTime()
  )
  const result: Placed[] = []

  let cluster: Placed[] = []
  let clusterEnd = 0
  let columnEnds: number[] = []

  const flush = (): void => {
    for (const p of cluster) p.cols = columnEnds.length
    result.push(...cluster)
    cluster = []
    columnEnds = []
  }

  for (const appt of sorted) {
    const start = new Date(appt.startAt).getTime()
    const end = new Date(appt.endAt).getTime()
    if (cluster.length > 0 && start >= clusterEnd) flush()

    let col = columnEnds.findIndex((e) => e <= start)
    if (col === -1) {
      col = columnEnds.length
      columnEnds.push(end)
    } else {
      columnEnds[col] = end
    }
    cluster.push({ appt, col, cols: 1 })
    clusterEnd = Math.max(clusterEnd, end)
  }
  flush()
  return result
}

export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function savePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // preferência só vale nesta sessão
  }
}

// ---------- horário de trabalho e bloqueios ----------

/** Faixa do dia (em minutos) em que não dá para agendar: fora do expediente ou bloqueada. */
export interface Unavailable {
  startMin: number
  endMin: number
  kind: 'off' | 'block'
  label?: string
}

/**
 * Faixas indisponíveis de uma coluna da agenda. `professionalIds` são os
 * profissionais que a coluna representa: com um só, valem o horário de trabalho
 * e os bloqueios dele; com vários, só bloqueios que valem para todos.
 */
export function unavailableRanges(params: {
  dateStr: string
  professionalIds: string[]
  hours: ProfessionalWorkingHours[]
  blocks: ScheduleBlock[]
}): Unavailable[] {
  const { dateStr, professionalIds, hours, blocks } = params
  const date = fromDateStr(dateStr)
  const dayStart = date.getTime()
  const dayEnd = addDays(date, 1).getTime()
  const single = professionalIds.length === 1 ? professionalIds[0] : null
  const result: Unavailable[] = []

  const toMin = (t: string): number => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  const mine = single ? hours.find((h) => h.professionalId === single) : undefined
  if (mine && mine.days.length > 0) {
    const day = mine.days.find((d) => d.weekday === date.getDay())
    if (!day) {
      result.push({ startMin: 0, endMin: 24 * 60, kind: 'off', label: 'Não atende' })
    } else {
      result.push({ startMin: 0, endMin: toMin(day.startTime), kind: 'off' })
      result.push({ startMin: toMin(day.endTime), endMin: 24 * 60, kind: 'off' })
      if (day.breakStart && day.breakEnd) {
        result.push({ startMin: toMin(day.breakStart), endMin: toMin(day.breakEnd), kind: 'off', label: 'Intervalo' })
      }
    }
  }

  for (const b of blocks) {
    const applies = b.professionalId === null || (single !== null && b.professionalId === single)
    if (!applies) continue
    const s = new Date(b.startAt).getTime()
    const e = new Date(b.endAt).getTime()
    if (e <= dayStart || s >= dayEnd) continue
    const startMin = s <= dayStart ? 0 : minutesOfDay(new Date(s))
    const endMin = e >= dayEnd ? 24 * 60 : minutesOfDay(new Date(e))
    result.push({ startMin, endMin, kind: 'block', label: b.reason ?? 'Bloqueado' })
  }
  return result
}
