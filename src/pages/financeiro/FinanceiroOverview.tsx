import { useEffect, useMemo, useState } from 'react'
import { RankingBars, SeriesChart } from '../../components/Charts'
import { formatCurrency } from '../../utils/masks'
import type { FinancialSeriesPoint, FinancialSummary } from '@shared/types'
import { PAYMENT_LABELS } from '@shared/types'
import { Granularity, PERIOD_LABELS, PeriodMode, parseInputDate, presetRange } from './periods'

export function FinanceiroOverview(): JSX.Element {
  const [mode, setMode] = useState<PeriodMode>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [series, setSeries] = useState<FinancialSeriesPoint[]>([])

  const customInvalid = mode === 'custom' && customFrom !== '' && customTo !== '' && customFrom > customTo
  const customIncomplete = mode === 'custom' && (customFrom === '' || customTo === '')

  const range = useMemo(() => {
    if (mode !== 'custom') return presetRange(mode)
    if (customFrom === '' || customTo === '' || customFrom > customTo) return null
    return { from: parseInputDate(customFrom, false), to: parseInputDate(customTo, true) }
  }, [mode, customFrom, customTo])

  const rangeKey = range ? `${range.from.toISOString()}|${range.to.toISOString()}` : null


  async function loadFinancial(): Promise<void> {
    if (!range) return
    const from = range.from.toISOString()
    const to = range.to.toISOString()
    const [sum, ser] = await Promise.all([
      window.api.sales.financialSummary(from, to),
      window.api.sales.financialSeries(from, to, granularity)
    ])
    if (sum.ok && sum.data) setSummary(sum.data)
    if (ser.ok && ser.data) setSeries(ser.data)
  }

  useEffect(() => {
    loadFinancial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, granularity])

  function choosePreset(preset: Exclude<PeriodMode, 'custom'>): void {
    setMode(preset)
    setCustomFrom('')
    setCustomTo('')
  }

  const totalAmount = summary?.totalAmountCents ?? 0
  const salesCount = summary?.salesCount ?? 0
  const ticket = salesCount > 0 ? Math.round(totalAmount / salesCount) : 0

  return (
    <div>
      <p className="subtitle">Controle de faturamento da clínica — cobranças por procedimento e produto.</p>

      <div className="filter-bar card">
        <div className="period-picker" role="group" aria-label="Período">
          {(Object.keys(PERIOD_LABELS) as Exclude<PeriodMode, 'custom'>[]).map((p) => (
            <button
              key={p}
              type="button"
              className={p === mode ? 'period-btn active' : 'period-btn'}
              onClick={() => choosePreset(p)}
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

        {customInvalid && <span className="error">A data inicial não pode ser depois da final.</span>}
        {customIncomplete && !customInvalid && <span className="filter-hint">Informe as duas datas.</span>}
      </div>

      <div className="tiles kpis">
        <div className="tile static">
          <span className="tile-label">Faturamento</span>
          <span className="tile-value">{formatCurrency(totalAmount)}</span>
          <span className="tile-hint">no período selecionado</span>
        </div>
        <div className="tile static">
          <span className="tile-label">Vendas</span>
          <span className="tile-value">{salesCount}</span>
          <span className="tile-hint">cobranças registradas</span>
        </div>
        <div className="tile static">
          <span className="tile-label">Ticket médio</span>
          <span className="tile-value">{formatCurrency(ticket)}</span>
          <span className="tile-hint">por venda</span>
        </div>
      </div>

      <div className="card chart-card">
        <div className="chart-head">
          <h3>Vendas por período</h3>
          <div className="period-picker" role="group" aria-label="Agrupar por">
            <button
              type="button"
              className={granularity === 'day' ? 'period-btn active' : 'period-btn'}
              onClick={() => setGranularity('day')}
            >
              Dia
            </button>
            <button
              type="button"
              className={granularity === 'month' ? 'period-btn active' : 'period-btn'}
              onClick={() => setGranularity('month')}
            >
              Mês
            </button>
          </div>
        </div>
        <SeriesChart points={series} granularity={granularity} />
      </div>

      <div className="financial-breakdown">
        <div className="card chart-card">
          <h3>Vendas por procedimento</h3>
          <RankingBars
            rows={(summary?.byProcedureType ?? []).map((r) => ({ label: r.name, totalCents: r.totalCents }))}
            emptyText="Sem procedimentos cobrados no período."
          />
        </div>
        <div className="card chart-card">
          <h3>Formas de pagamento</h3>
          <RankingBars
            rows={(summary?.byPaymentMethod ?? []).map((r) => ({ label: PAYMENT_LABELS[r.paymentMethod], totalCents: r.totalCents }))}
            emptyText="Sem vendas no período."
          />
        </div>
      </div>
    </div>
  )
}
