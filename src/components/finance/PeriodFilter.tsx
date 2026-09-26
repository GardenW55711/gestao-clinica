import { useMemo, useState } from 'react'
import type { Range } from '@shared/indicators'
import { PERIOD_LABELS, PeriodMode, parseInputDate, presetRange } from '../../pages/financeiro/periods'

/**
 * Filtro de período (Hoje / 7 dias / Mês / datas personalizadas), igual em todas as
 * abas do Financeiro. Devolve o período pronto (ou null se as datas estiverem
 * incompletas/invertidas) e o pedaço de tela do filtro.
 */
export function usePeriodFilter(initial: PeriodMode = 'month'): { range: Range | null; node: JSX.Element } {
  const [mode, setMode] = useState<PeriodMode>(initial)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const invalid = mode === 'custom' && customFrom !== '' && customTo !== '' && customFrom > customTo
  const incomplete = mode === 'custom' && (customFrom === '' || customTo === '')

  const range = useMemo<Range | null>(() => {
    if (mode !== 'custom') {
      const r = presetRange(mode)
      return { from: r.from.toISOString(), to: r.to.toISOString() }
    }
    if (customFrom === '' || customTo === '' || customFrom > customTo) return null
    return { from: parseInputDate(customFrom, false).toISOString(), to: parseInputDate(customTo, true).toISOString() }
  }, [mode, customFrom, customTo])

  const node = (
    <div className="filter-bar card">
      <div className="period-picker" role="group" aria-label="Período">
        {(Object.keys(PERIOD_LABELS) as Exclude<PeriodMode, 'custom'>[]).map((p) => (
          <button
            key={p}
            type="button"
            className={p === mode ? 'period-btn active' : 'period-btn'}
            onClick={() => {
              setMode(p)
              setCustomFrom('')
              setCustomTo('')
            }}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className={mode === 'custom' ? 'date-range active' : 'date-range'}>
        <label>
          De
          <input
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(e) => {
              setCustomFrom(e.target.value)
              setMode('custom')
            }}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => {
              setCustomTo(e.target.value)
              setMode('custom')
            }}
          />
        </label>
      </div>

      {invalid && <span className="error">A data inicial não pode ser depois da final.</span>}
      {incomplete && !invalid && <span className="filter-hint">Informe as duas datas.</span>}
    </div>
  )

  return { range, node }
}
