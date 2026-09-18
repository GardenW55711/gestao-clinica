import { useEffect, useMemo, useRef, useState } from 'react'
import type { FinancialSeriesPoint } from '@shared/types'
import { formatCurrency } from '../utils/masks'

const compact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1
})

function useElementWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

/** Arredonda o máximo para um número "redondo" (1, 2, 2.5, 5, 10 × potência de 10). */
function niceMax(value: number): number {
  if (value <= 0) return 100
  const exp = Math.pow(10, Math.floor(Math.log10(value)))
  const fraction = value / exp
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10
  return nice * exp
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d ?? 1)
}

function axisLabel(key: string, granularity: 'day' | 'month'): string {
  const date = parseKey(key)
  if (granularity === 'day') {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
  }
  return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
}

function tooltipTitle(key: string, granularity: 'day' | 'month'): string {
  const date = parseKey(key)
  return granularity === 'day'
    ? date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
    : date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}

const HEIGHT = 250
const PAD = { top: 14, right: 10, bottom: 30, left: 62 }

export function SeriesChart({
  points,
  granularity
}: {
  points: FinancialSeriesPoint[]
  granularity: 'day' | 'month'
}): JSX.Element {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const max = useMemo(() => niceMax(Math.max(0, ...points.map((p) => p.total))), [points])
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)

  const innerW = Math.max(width - PAD.left - PAD.right, 10)
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const slot = points.length ? innerW / points.length : innerW
  const barW = Math.max(Math.min(slot * 0.66, 34), 2)
  const labelW = granularity === 'day' ? 46 : 58
  const labelStep = Math.max(1, Math.ceil(labelW / slot))
  const empty = points.every((p) => p.total === 0)

  const hovered = hover !== null ? points[hover] : null
  const tipLeft = hover !== null ? PAD.left + slot * hover + slot / 2 : 0

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label="Gráfico de vendas por período">
          <defs>
            <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--accent)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.55 }} />
            </linearGradient>
          </defs>

          {ticks.map((t) => {
            const y = PAD.top + innerH - (t / max) * innerH
            return (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} className="chart-grid" />
                <text x={PAD.left - 10} y={y + 4} textAnchor="end" className="chart-axis">
                  {t === 0 ? 'R$ 0' : compact.format(t)}
                </text>
              </g>
            )
          })}

          {points.map((p, i) => {
            const h = (p.total / max) * innerH
            const x = PAD.left + slot * i + (slot - barW) / 2
            return (
              <g key={p.key} onMouseEnter={() => setHover(i)}>
                <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent" />
                {p.total > 0 && (
                  <rect
                    x={x}
                    y={PAD.top + innerH - h}
                    width={barW}
                    height={Math.max(h, 2)}
                    rx={Math.min(barW / 2, 7)}
                    className={hover === i ? 'chart-bar hovered' : 'chart-bar'}
                    style={{ animationDelay: `${Math.min(i * 12, 360)}ms` }}
                  />
                )}
                {i % labelStep === 0 && (
                  <text x={PAD.left + slot * i + slot / 2} y={HEIGHT - 8} textAnchor="middle" className="chart-axis">
                    {axisLabel(p.key, granularity)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {empty && width > 0 && <div className="chart-empty">Sem vendas no período</div>}

      {hovered && (
        <div className="chart-tooltip" style={{ left: Math.min(Math.max(tipLeft, 90), Math.max(width - 90, 90)) }}>
          <strong>{tooltipTitle(hovered.key, granularity)}</strong>
          <span>{formatCurrency(hovered.total)}</span>
          <small>
            {hovered.count} {hovered.count === 1 ? 'venda' : 'vendas'}
          </small>
        </div>
      )}
    </div>
  )
}

/** Ranking em barras horizontais (procedimentos, formas de pagamento...). */
export function RankingBars({
  rows,
  maxRows = 8,
  emptyText
}: {
  rows: { label: string; total: number }[]
  maxRows?: number
  emptyText: string
}): JSX.Element {
  const sorted = [...rows].sort((a, b) => b.total - a.total)
  const shown = sorted.slice(0, maxRows)
  const rest = sorted.slice(maxRows).reduce((sum, r) => sum + r.total, 0)
  if (rest > 0) shown.push({ label: 'Outros', total: rest })

  const sum = sorted.reduce((s, r) => s + r.total, 0)
  const max = Math.max(...shown.map((r) => r.total), 1)

  if (shown.length === 0) return <p className="chart-none">{emptyText}</p>

  return (
    <ul className="ranking">
      {shown.map((row, i) => (
        <li key={row.label} className="ranking-row">
          <div className="ranking-head">
            <span className="ranking-label" title={row.label}>
              {row.label}
            </span>
            <span className="ranking-value">
              {formatCurrency(row.total)} <small>{sum > 0 ? Math.round((row.total / sum) * 100) : 0}%</small>
            </span>
          </div>
          <div className="ranking-track">
            <div
              className="ranking-fill"
              style={{ width: `${(row.total / max) * 100}%`, animationDelay: `${i * 50}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
