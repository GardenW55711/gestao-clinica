import { useEffect, useState } from 'react'
import { PAYMENT_LABELS } from '@shared/types'
import type { FinancialSeriesPoint, FinancialSummary, OverviewData } from '@shared/types'
import { delinquencyTraffic, marginTraffic, profitTraffic } from '@shared/indicators'
import { RankingBars, SeriesChart } from '../../components/Charts'
import { Delta, IndicatorCard, InfoTip, formatPercent } from '../../components/finance/Indicator'
import { usePeriodFilter } from '../../components/finance/PeriodFilter'
import { formatCurrency } from '../../utils/masks'
import type { Granularity } from './periods'

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function FinanceiroOverview(): JSX.Element {
  const { range, node } = usePeriodFilter('month')
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [data, setData] = useState<OverviewData | null>(null)
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [series, setSeries] = useState<FinancialSeriesPoint[]>([])

  const rangeKey = range ? `${range.from}|${range.to}` : null

  useEffect(() => {
    if (!range) return
    let cancelled = false
    Promise.all([
      window.api.finance.overview(range),
      window.api.sales.financialSummary(range.from, range.to),
      window.api.sales.financialSeries(range.from, range.to, granularity)
    ]).then(([ov, sum, ser]) => {
      if (cancelled) return
      if (ov.ok && ov.data) setData(ov.data)
      if (sum.ok && sum.data) setSummary(sum.data)
      if (ser.ok && ser.data) setSeries(ser.data)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, granularity])

  const be = data?.breakEven

  return (
    <div>
      {node}

      <div className="explainer card">
        <p>
          <strong>Produzido</strong> é o valor dos atendimentos realizados no período — mesmo que o paciente ainda não
          tenha pago. <strong>Recebido</strong> é o dinheiro que de fato entrou, pela data em que cada parcela foi paga.
          {data && (
            <>
              {' '}
              No período: produzido <strong>{formatCurrency(data.produced.cents)}</strong> ({data.produced.completedCount}{' '}
              atendimentos) · recebido <strong>{formatCurrency(data.received.netCents)}</strong>.
            </>
          )}
        </p>
      </div>

      {!data && <div className="skeleton block" />}

      {data && (
        <>
          <div className="indicator-grid">
            <IndicatorCard
              title="Recebido"
              value={formatCurrency(data.received.netCents)}
              phrase="Dinheiro que entrou no caixa."
              formula="Soma das parcelas recebidas no período, já descontada a taxa do cartão (valor líquido)."
            >
              <span className="tile-hint">
                bruto {formatCurrency(data.received.grossCents)} · taxas {formatCurrency(data.received.feeCents)}
              </span>
              <Delta current={data.received.netCents} previous={data.received.previousNetCents} />
            </IndicatorCard>

            <IndicatorCard
              title="Despesas"
              value={formatCurrency(data.expenses.cents)}
              phrase="Tudo que saiu do caixa."
              formula="Soma das despesas marcadas como pagas no período."
            >
              <Delta current={data.expenses.cents} previous={data.expenses.previousCents} goodWhen="down" />
            </IndicatorCard>

            <IndicatorCard
              title="Lucro"
              value={formatCurrency(data.profit.cents)}
              phrase="O que sobrou de verdade."
              formula="Recebido − Despesas. Fica vermelho quando é negativo."
              traffic={profitTraffic(data.profit.cents)}
            >
              <Delta current={data.profit.cents} previous={data.profit.previousCents} />
            </IndicatorCard>

            <IndicatorCard
              title="Margem de lucro"
              value={formatPercent(data.margin.percent)}
              phrase="De cada R$ 100 que entram, quanto sobra."
              formula="Lucro ÷ Recebido × 100. Verde a partir de 35%, amarelo de 20% a 35%, vermelho abaixo de 20%."
              traffic={marginTraffic(data.margin.percent)}
            >
              <Delta current={data.margin.percent} previous={data.margin.previousPercent} unit="points" />
            </IndicatorCard>

            <IndicatorCard
              title="A receber"
              value={formatCurrency(data.receivable.cents)}
              phrase="O que ainda vai entrar."
              formula="Soma das parcelas pendentes com vencimento de hoje em diante."
            >
              <span className="tile-hint">
                {data.receivable.count} {data.receivable.count === 1 ? 'parcela' : 'parcelas'} a vencer
              </span>
            </IndicatorCard>

            <IndicatorCard
              title="Em atraso (inadimplência)"
              value={formatPercent(data.delinquency.percent)}
              phrase="Quanto está atrasado."
              formula="Parcelas vencidas e não pagas ÷ total de parcelas que venciam no período × 100. Verde abaixo de 5%, amarelo de 5% a 10%, vermelho acima de 10%."
              traffic={delinquencyTraffic(data.delinquency.percent)}
            >
              <span className="tile-hint">
                {data.delinquency.overdueCount > 0
                  ? `${formatCurrency(data.delinquency.overdueCents)} em ${data.delinquency.overdueCount} ${data.delinquency.overdueCount === 1 ? 'parcela' : 'parcelas'}`
                  : data.delinquency.dueCount > 0
                    ? 'nada atrasado'
                    : 'nenhuma parcela venceu no período'}
              </span>
              <Delta current={data.delinquency.percent} previous={data.delinquency.previousPercent} unit="points" goodWhen="down" />
            </IndicatorCard>
          </div>

          {be && (
            <div className="card break-even">
              <div className="indicator-head">
                <h3>Ponto de equilíbrio — {monthLabel(be.month)}</h3>
                <InfoTip formula="Custos fixos do mês ÷ margem de contribuição (%). A margem de contribuição é (recebido − custos variáveis) ÷ recebido. Custos variáveis = despesas variáveis + taxas de cartão + comissões + custo dos materiais consumidos (a compra de material não entra aqui, para não contar duas vezes). O recebido é o valor bruto do mês." />
              </div>
              <p className="tile-hint">Quanto a clínica precisa faturar no mês para não ter prejuízo.</p>

              {be.breakEvenCents === null ? (
                <p className="be-message">
                  {be.receivedCents <= 0
                    ? 'Ainda não há recebimentos neste mês — não dá para calcular.'
                    : 'Os custos variáveis já consomem toda a receita deste mês — não há ponto de equilíbrio.'}
                </p>
              ) : (
                <>
                  <div className="be-numbers">
                    <div>
                      <span className="tile-label">Precisa faturar</span>
                      <strong className="be-value">{formatCurrency(be.breakEvenCents)}</strong>
                    </div>
                    <div>
                      <span className="tile-label">Já recebeu no mês</span>
                      <strong className="be-value">{formatCurrency(be.receivedCents)}</strong>
                    </div>
                  </div>
                  <div className="progress" role="progressbar" aria-valuenow={Math.round(be.progressPercent)} aria-valuemin={0} aria-valuemax={100}>
                    <div className={be.reached ? 'progress-bar reached' : 'progress-bar'} style={{ width: `${be.progressPercent}%` }} />
                  </div>
                  <p className={be.reached ? 'be-message good' : 'be-message'}>
                    {be.reached
                      ? 'Meta batida — tudo acima disso é lucro.'
                      : `Faltam ${formatCurrency(be.missingCents ?? 0)} para cobrir os custos do mês.`}
                  </p>
                </>
              )}

              <dl className="be-breakdown">
                <div>
                  <dt>Custos fixos do mês</dt>
                  <dd>{formatCurrency(be.fixedCents)}</dd>
                </div>
                <div>
                  <dt>Custos variáveis</dt>
                  <dd>{formatCurrency(be.variableCents)}</dd>
                </div>
                <div className="sub">
                  <dt>Despesas variáveis</dt>
                  <dd>{formatCurrency(be.variable.variableExpensesCents)}</dd>
                </div>
                <div className="sub">
                  <dt>Taxas de cartão</dt>
                  <dd>{formatCurrency(be.variable.cardFeesCents)}</dd>
                </div>
                <div className="sub">
                  <dt>Comissões</dt>
                  <dd>{formatCurrency(be.variable.commissionsCents)}</dd>
                </div>
                <div className="sub">
                  <dt>Materiais consumidos</dt>
                  <dd>{formatCurrency(be.variable.materialsConsumedCents)}</dd>
                </div>
                <div>
                  <dt>Margem de contribuição</dt>
                  <dd>{formatPercent(be.contributionMarginPercent)}</dd>
                </div>
              </dl>
            </div>
          )}
        </>
      )}

      <div className="card chart-card">
        <div className="chart-head">
          <h3>Vendas por período</h3>
          <div className="period-picker" role="group" aria-label="Agrupar por">
            <button type="button" className={granularity === 'day' ? 'period-btn active' : 'period-btn'} onClick={() => setGranularity('day')}>
              Dia
            </button>
            <button type="button" className={granularity === 'month' ? 'period-btn active' : 'period-btn'} onClick={() => setGranularity('month')}>
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
