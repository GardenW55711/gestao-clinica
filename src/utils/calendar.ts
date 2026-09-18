import type { Appointment, AppointmentStatus, Professional } from '@shared/types'

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
