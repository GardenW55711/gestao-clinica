export const PAYMENT_LABELS = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'Pix',
  outro: 'Outro'
} as const

export type PeriodMode = 'today' | '7d' | 'month' | 'custom'
export type Granularity = 'day' | 'month'

export const PERIOD_LABELS: Record<Exclude<PeriodMode, 'custom'>, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  month: 'Este mês'
}

export function presetRange(preset: Exclude<PeriodMode, 'custom'>): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const from =
    preset === 'today'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : preset === '7d'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
        : new Date(now.getFullYear(), now.getMonth(), 1)
  return { from, to }
}

export function parseInputDate(value: string, endOfDay: boolean): Date {
  const [y, m, d] = value.split('-').map(Number)
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d)
}
