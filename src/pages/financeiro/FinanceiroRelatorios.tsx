import { useEffect, useState } from 'react'
import { EXPENSE_CATEGORY_LABELS } from '@shared/types'
import type { ExpenseCategory, ProductionRow, ReportsData } from '@shared/types'
import { noShowTraffic, occupancyTraffic } from '@shared/indicators'
import { CashflowChart, RankingBars } from '../../components/Charts'
import { Delta, IndicatorCard, InfoTip, formatPercent } from '../../components/finance/Indicator'
import { usePeriodFilter } from '../../components/finance/PeriodFilter'
import { Icon } from '../../components/Icons'
import { useClinic } from '../../context/ClinicContext'
import { formatCurrency } from '../../utils/masks'
import type { Granularity } from './periods'

const LOW_MARGIN_PERCENT = 30

function hours(minutes: number): string {
  const h = minutes / 60
  return `${h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
}

function ProductionTable({ rows }: { rows: ProductionRow[] }): JSX.Element {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Profissional</th>
          <th>Atendimentos</th>
          <th>Produziu</th>
          <th>Recebido</th>
          <th>Comissão</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.professionalId} className="row-enter">
            <td>
              <strong>{r.name}</strong>
            </td>
            <td>{r.appointments}</td>
            <td>{formatCurrency(r.producedCents)}</td>
            <td>{formatCurrency(r.receivedCents)}</td>
            <td>
              {formatCurrency(r.commissionCents)} <small className="muted">({r.commissionPercent.toLocaleString('pt-BR')}%)</small>
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="empty-row">
              Nenhuma produção no período.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

/** Profissional vê só a própria produção e comissão. */
function MinhaProducao(): JSX.Element {
  const { range, node } = usePeriodFilter('month')
  const [rows, setRows] = useState<ProductionRow[]>([])
  useEffect(() => {
    if (!range) return
    window.api.finance.myProduction(range).then((r) => r.ok && r.data && setRows(r.data))
  }, [range])
  return (
    <div>
      {node}
      <h2 className="section-title">Sua produção e comissão</h2>
      <p className="subtitle">Quanto você produziu no período e a comissão sobre o que já foi recebido dos seus atendimentos.</p>
      <ProductionTable rows={rows} />
    </div>
  )
}

export function FinanceiroRelatorios(): JSX.Element {
  const { staff } = useClinic()
  if (staff.role === 'professional') return <MinhaProducao />
  return <RelatoriosCompletos />
}

function RelatoriosCompletos(): JSX.Element {
  const { range, node } = usePeriodFilter('month')
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [data, setData] = useState<ReportsData | null>(null)

  useEffect(() => {
    if (!range) return
    let cancelled = false
    window.api.finance.reports(range, granularity).then((r) => {
      if (!cancelled && r.ok && r.data) setData(r.data)
    })
    return () => {
      cancelled = true
    }
  }, [range, granularity])

  return (
    <div>
      {node}
      {!data && <div className="skeleton block" />}
      {data && (
        <>
          <div className="indicator-grid four">
            <IndicatorCard
              title="Ticket médio"
              value={formatCurrency(data.ticket.ticketCents)}
              phrase="Quanto cada atendimento rende, em média."
              formula="Produzido ÷ número de atendimentos concluídos no período. Produzido = valor dos atendimentos realizados (a cobrança do atendimento ou, sem ela, o preço padrão do procedimento)."
            >
              <span className="tile-hint">{data.ticket.completedCount} atendimentos concluídos</span>
              <Delta current={data.ticket.ticketCents} previous={data.ticket.previousTicketCents} />
            </IndicatorCard>

            <IndicatorCard
              title="Taxa de ocupação"
              value={formatPercent(data.occupancy.percent)}
              phrase="Quanto do tempo disponível está sendo usado."
              formula="Horas agendadas (concluídos + confirmados + agendados, sem cancelados nem faltas) ÷ horas disponíveis (horário de trabalho − intervalos − bloqueios) × 100. Verde a partir de 75%, amarelo de 60% a 75%, vermelho abaixo de 60%. Profissional sem horário cadastrado conta segunda a sexta, 8h às 18h."
              traffic={occupancyTraffic(data.occupancy.percent)}
            >
              <span className="tile-hint">
                {hours(data.occupancy.bookedMinutes)} agendadas de {hours(data.occupancy.availableMinutes)}
              </span>
            </IndicatorCard>

            <IndicatorCard
              title="Taxa de faltas"
              value={formatPercent(data.noShow.percent)}
              phrase="Pacientes que marcaram e não vieram."
              formula="Atendimentos com status “faltou” ÷ total de agendamentos (sem cancelados) × 100. Verde abaixo de 10%, amarelo de 10% a 15%, vermelho acima de 15%."
              traffic={noShowTraffic(data.noShow.percent)}
            >
              <span className="tile-hint">
                {data.noShow.noShowCount} de {data.noShow.totalCount} agendamentos
              </span>
              <Delta current={data.noShow.percent} previous={data.noShow.previousPercent} unit="points" goodWhen="down" />
            </IndicatorCard>

            <IndicatorCard
              title="Custo da hora ociosa"
              value={formatCurrency(data.idleCost.costCents)}
              phrase="Quanto custou a cadeira parada."
              formula="Horas vagas × (custos fixos do mês ÷ horas disponíveis no mês). Horas vagas = horas disponíveis − horas agendadas no período."
            >
              <span className="tile-hint">{hours(data.idleCost.idleMinutes)} vagas no período</span>
            </IndicatorCard>
          </div>

          <div className="card chart-card">
            <h3>Ocupação por profissional</h3>
            {data.occupancy.byProfessional.length === 0 ? (
              <p className="chart-none">Nenhum profissional ativo.</p>
            ) : (
              <ul className="occupancy-list">
                {data.occupancy.byProfessional.map((p) => (
                  <li key={p.professionalId}>
                    <div className="ranking-head">
                      <span className="ranking-label">{p.name}</span>
                      <span className="ranking-value">
                        {formatPercent(p.percent)} <small>{hours(p.bookedMinutes)} de {hours(p.availableMinutes)}</small>
                      </span>
                    </div>
                    <div className="ranking-track">
                      <div
                        className={`ranking-fill traffic-${occupancyTraffic(p.percent)}`}
                        style={{ width: `${Math.min(p.percent ?? 0, 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <h2 className="section-title">Produção por profissional</h2>
          <p className="subtitle">Quanto cada profissional produziu e quanto recebe de comissão (sobre o valor já recebido).</p>
          <ProductionTable rows={data.production} />

          <div className="section-head">
            <h2 className="section-title">Margem por procedimento</h2>
            <InfoTip formula={`Preço cobrado (média do período, já com desconto) − custo dos materiais da receita do procedimento − taxa média de cartão − comissão média. Marcamos “margem baixa” abaixo de ${LOW_MARGIN_PERCENT}%. Procedimento sem vendas no período usa o preço padrão.`} />
          </div>
          <p className="subtitle">Quanto cada tipo de procedimento realmente deixa de lucro, do maior para o menor.</p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Procedimento</th>
                <th>Preço</th>
                <th>Materiais</th>
                <th>Taxa cartão</th>
                <th>Comissão</th>
                <th>Sobra</th>
                <th>Margem</th>
              </tr>
            </thead>
            <tbody>
              {data.procedureMargins.map((m) => {
                const low = m.marginPercent !== null && m.marginPercent < LOW_MARGIN_PERCENT
                return (
                  <tr key={m.procedureTypeId} className={low ? 'row-enter low-margin' : 'row-enter'}>
                    <td>
                      <strong>{m.name}</strong>
                      {m.estimated && <span className="tag">preço padrão</span>}
                      {low && <span className="tag warn">margem baixa</span>}
                    </td>
                    <td>{formatCurrency(m.priceCents)}</td>
                    <td>{formatCurrency(m.materialsCents)}</td>
                    <td>{formatCurrency(m.feeCents)}</td>
                    <td>{formatCurrency(m.commissionCents)}</td>
                    <td>
                      <strong>{formatCurrency(m.marginCents)}</strong>
                    </td>
                    <td>{formatPercent(m.marginPercent)}</td>
                  </tr>
                )
              })}
              {data.procedureMargins.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <Icon name="procedure" size={34} />
                      <strong>Nenhum procedimento cadastrado</strong>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="financial-breakdown">
            <div className="card chart-card">
              <h3>Despesas por categoria</h3>
              <RankingBars
                rows={data.expensesByCategory.map((r) => ({
                  label: EXPENSE_CATEGORY_LABELS[r.category as ExpenseCategory] ?? r.category,
                  totalCents: r.totalCents
                }))}
                emptyText="Nenhuma despesa paga no período."
              />
            </div>
          </div>

          <div className="card chart-card">
            <div className="chart-head">
              <div className="indicator-head">
                <h3>Fluxo de caixa</h3>
                <InfoTip formula="Por dia (ou mês): entradas = parcelas recebidas (líquidas da taxa do cartão), saídas = despesas pagas, e o saldo acumulado soma tudo desde o início do período." />
              </div>
              <div className="period-picker" role="group" aria-label="Agrupar por">
                <button type="button" className={granularity === 'day' ? 'period-btn active' : 'period-btn'} onClick={() => setGranularity('day')}>
                  Dia
                </button>
                <button type="button" className={granularity === 'month' ? 'period-btn active' : 'period-btn'} onClick={() => setGranularity('month')}>
                  Mês
                </button>
              </div>
            </div>
            <CashflowChart points={data.cashflow} granularity={granularity} />
          </div>
        </>
      )}
    </div>
  )
}
