import type { ReactNode } from 'react'
import type { Traffic } from '@shared/indicators'
import { changePercent } from '@shared/indicators'

/** Ícone (i) que mostra a fórmula ao passar o mouse ou focar com o teclado. */
export function InfoTip({ formula }: { formula: string }): JSX.Element {
  return (
    <span className="info-tip" tabIndex={0} role="note" aria-label={`Como é calculado: ${formula}`}>
      <span aria-hidden="true">i</span>
      <span className="info-tip-bubble" role="tooltip">
        <strong>Como é calculado</strong>
        {formula}
      </span>
    </span>
  )
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null) return '—'
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`
}

/** Seta ↑ ↓ com a variação em relação ao período anterior. `goodWhen` diz se subir é bom ou ruim. */
export function Delta({
  current,
  previous,
  goodWhen = 'up',
  unit = 'percent'
}: {
  current: number | null
  previous: number | null
  goodWhen?: 'up' | 'down'
  /** 'percent' compara em %, 'points' mostra a diferença em pontos percentuais (para taxas). */
  unit?: 'percent' | 'points'
}): JSX.Element | null {
  if (current === null || previous === null) return null
  const change = unit === 'points' ? current - previous : changePercent(current, previous)
  if (change === null) return <span className="delta muted">sem período anterior para comparar</span>
  if (Math.abs(change) < 0.05) return <span className="delta muted">= igual ao período anterior</span>
  const up = change > 0
  const good = up === (goodWhen === 'up')
  const text = unit === 'points' ? `${Math.abs(change).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.` : formatPercent(Math.abs(change), 0)
  return (
    <span className={`delta ${good ? 'good' : 'bad'}`}>
      {up ? '↑' : '↓'} {text} <span className="muted">vs. período anterior</span>
    </span>
  )
}

export function IndicatorCard({
  title,
  value,
  phrase,
  formula,
  traffic = 'none',
  children,
  wide
}: {
  title: string
  value: ReactNode
  phrase: string
  formula: string
  traffic?: Traffic
  children?: ReactNode
  wide?: boolean
}): JSX.Element {
  return (
    <div className={`tile static indicator${traffic !== 'none' ? ` traffic-${traffic}` : ''}${wide ? ' wide' : ''}`}>
      <span className="indicator-head">
        <span className="tile-label">{title}</span>
        <InfoTip formula={formula} />
      </span>
      <span className="tile-value">{value}</span>
      <span className="tile-hint">{phrase}</span>
      {children}
    </div>
  )
}
