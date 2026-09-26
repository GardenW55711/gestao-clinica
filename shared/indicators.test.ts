import { describe, expect, it } from 'vitest'
import {
  availableMinutes,
  averageTicketCents,
  breakEven,
  cashflowSeries,
  changePercent,
  commissionCents,
  delinquency,
  delinquencyTraffic,
  expensesPaidCents,
  idleCostCents,
  marginPercent,
  marginTraffic,
  noShowRate,
  noShowTraffic,
  occupancyPercent,
  occupancyTraffic,
  previousRange,
  procedureMargin,
  receivableCents,
  receivedSummary,
  variableCostsCents,
  type ExpenseRow,
  type InstallmentRow,
  type PaidInstallmentRow,
  type Range
} from './indicators'

// Setembro de 2026 (horário local do computador, como o programa usa).
const SEPT: Range = {
  from: new Date(2026, 8, 1, 0, 0, 0, 0).toISOString(),
  to: new Date(2026, 8, 30, 23, 59, 59, 999).toISOString()
}
const at = (day: number, hour = 12): string => new Date(2026, 8, day, hour, 0, 0).toISOString()

const received: PaidInstallmentRow[] = [
  { saleId: 's1', professionalId: 'p1', amountCents: 1_000_000, feeCents: 20_000, paidAt: at(5) },
  { saleId: 's2', professionalId: 'p1', amountCents: 500_000, feeCents: 0, paidAt: at(12) },
  // fora do período: não conta
  { saleId: 's3', professionalId: 'p1', amountCents: 999_999, feeCents: 0, paidAt: new Date(2026, 7, 20).toISOString() }
]

const expenses: ExpenseRow[] = [
  { amountCents: 300_000, kind: 'fixa', category: 'aluguel', dueDate: '2026-09-05', paidAt: at(5) },
  { amountCents: 400_000, kind: 'fixa', category: 'salarios', dueDate: '2026-09-05', paidAt: at(5) },
  { amountCents: 150_000, kind: 'variavel', category: 'materiais', dueDate: '2026-09-10', paidAt: at(10) },
  { amountCents: 50_000, kind: 'variavel', category: 'marketing', dueDate: '2026-09-15', paidAt: at(15) },
  // ainda não paga: não sai do caixa
  { amountCents: 80_000, kind: 'fixa', category: 'contas', dueDate: '2026-09-28', paidAt: null }
]

describe('caixa: recebido, despesas, lucro e margem', () => {
  it('recebido líquido = parcelas pagas no período menos a taxa do cartão', () => {
    const r = receivedSummary(received, SEPT)
    expect(r.grossCents).toBe(1_500_000) // R$ 15.000,00
    expect(r.feeCents).toBe(20_000) // R$ 200,00
    expect(r.netCents).toBe(1_480_000) // R$ 14.800,00
  })

  it('despesas = só as pagas no período', () => {
    expect(expensesPaidCents(expenses, SEPT)).toBe(900_000) // R$ 9.000,00
  })

  it('lucro e margem de lucro', () => {
    const profit = 1_480_000 - 900_000
    expect(profit).toBe(580_000) // R$ 5.800,00
    expect(marginPercent(profit, 1_480_000)).toBeCloseTo(39.19, 2)
    expect(marginTraffic(39.19)).toBe('green')
    expect(marginTraffic(35)).toBe('green')
    expect(marginTraffic(34.99)).toBe('yellow')
    expect(marginTraffic(20)).toBe('yellow')
    expect(marginTraffic(19.99)).toBe('red')
    expect(marginTraffic(-5)).toBe('red')
    expect(marginPercent(100, 0)).toBeNull()
    expect(marginTraffic(null)).toBe('none')
  })

  it('variação em relação ao período anterior', () => {
    expect(changePercent(150, 100)).toBe(50)
    expect(changePercent(50, 100)).toBe(-50)
    expect(changePercent(10, 0)).toBeNull()
    expect(changePercent(-50, -100)).toBe(50)
  })

  it('o período anterior tem o mesmo tamanho e termina onde o atual começa', () => {
    const prev = previousRange(SEPT)
    const length = new Date(SEPT.to).getTime() - new Date(SEPT.from).getTime()
    expect(new Date(prev.to).getTime() - new Date(prev.from).getTime()).toBe(length)
    expect(new Date(prev.to).getTime()).toBe(new Date(SEPT.from).getTime() - 1)
  })
})

describe('a receber e inadimplência', () => {
  const rows: InstallmentRow[] = [
    ...Array.from({ length: 6 }, (_, i) => ({
      saleId: `p${i}`,
      amountCents: 10_000,
      dueDate: `2026-09-${String(i + 1).padStart(2, '0')}`,
      paidAt: at(i + 1)
    })),
    // vencidas e não pagas (hoje = 20/09)
    { saleId: 'a', amountCents: 20_000, dueDate: '2026-09-10', paidAt: null },
    { saleId: 'b', amountCents: 30_000, dueDate: '2026-09-15', paidAt: null },
    // ainda vão vencer (não são atraso)
    { saleId: 'c', amountCents: 40_000, dueDate: '2026-09-25', paidAt: null },
    { saleId: 'd', amountCents: 50_000, dueDate: '2026-09-30', paidAt: null }
  ]

  it('a receber = pendentes com vencimento de hoje em diante', () => {
    expect(receivableCents(rows, '2026-09-20')).toBe(90_000)
  })

  it('inadimplência = vencidas não pagas ÷ parcelas que venciam no período', () => {
    const d = delinquency(rows, '2026-09-01', '2026-09-30', '2026-09-20')
    expect(d.dueCount).toBe(10)
    expect(d.overdueCount).toBe(2)
    expect(d.overdueCents).toBe(50_000)
    expect(d.percent).toBe(20)
    expect(delinquencyTraffic(20)).toBe('red')
    expect(delinquencyTraffic(10)).toBe('yellow')
    expect(delinquencyTraffic(10.1)).toBe('red')
    expect(delinquencyTraffic(5)).toBe('yellow')
    expect(delinquencyTraffic(4.9)).toBe('green')
  })

  it('sem parcelas no período não há taxa de inadimplência', () => {
    expect(delinquency([], '2026-09-01', '2026-09-30', '2026-09-20').percent).toBeNull()
  })
})

describe('ponto de equilíbrio', () => {
  it('custos variáveis somam despesas variáveis, taxas, comissões e materiais consumidos', () => {
    // Só a despesa "marketing" (R$ 500); a compra de materiais fica de fora para não contar em dobro.
    const commission = commissionCents(1_500_000, 10) // 10% de R$ 15.000 = R$ 1.500
    expect(commission).toBe(150_000)
    const variable = variableCostsCents({
      variableExpensesCents: 50_000,
      cardFeesCents: 20_000,
      commissionsCents: commission,
      materialsConsumedCents: 100_000
    })
    expect(variable).toBe(320_000) // R$ 3.200,00
  })

  it('ponto de equilíbrio = custos fixos ÷ margem de contribuição (%)', () => {
    const r = breakEven({ fixedCents: 700_000, receivedCents: 1_500_000, variableCents: 320_000 })
    // margem de contribuição = (15.000 - 3.200) / 15.000 = 78,67%
    expect(r.contributionMarginPercent).toBeCloseTo(78.667, 2)
    // 7.000 / 0,78667 = R$ 8.898,31
    expect(r.breakEvenCents).toBe(889_831)
    expect(r.reached).toBe(true)
    expect(r.missingCents).toBe(0)
    expect(r.progressPercent).toBe(100)
  })

  it('mostra quanto falta quando ainda não bateu a meta', () => {
    const r = breakEven({ fixedCents: 700_000, receivedCents: 600_000, variableCents: 120_000 })
    // margem = 80%; equilíbrio = 7.000 / 0,8 = R$ 8.750,00; recebido R$ 6.000,00 -> faltam R$ 2.750,00
    expect(r.breakEvenCents).toBe(875_000)
    expect(r.reached).toBe(false)
    expect(r.missingCents).toBe(275_000)
    expect(r.progressPercent).toBeCloseTo(68.57, 2)
  })

  it('não calcula sem recebimento ou quando os custos variáveis passam da receita', () => {
    expect(breakEven({ fixedCents: 700_000, receivedCents: 0, variableCents: 0 }).breakEvenCents).toBeNull()
    expect(breakEven({ fixedCents: 700_000, receivedCents: 100_000, variableCents: 120_000 }).breakEvenCents).toBeNull()
  })
})

describe('relatórios', () => {
  it('ticket médio = produzido ÷ atendimentos concluídos', () => {
    expect(averageTicketCents(2_700_000, 30)).toBe(90_000)
    expect(averageTicketCents(0, 0)).toBe(0)
  })

  it('taxa de faltas', () => {
    expect(noShowRate(3, 40)).toBe(7.5)
    expect(noShowTraffic(7.5)).toBe('green')
    expect(noShowTraffic(10)).toBe('yellow')
    expect(noShowTraffic(15.1)).toBe('red')
    expect(noShowRate(0, 0)).toBeNull()
  })

  it('horas disponíveis: horário de trabalho menos intervalo e bloqueios', () => {
    const week = { fromDate: '2026-09-14', toDate: '2026-09-18' } // segunda a sexta
    const days = [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      startTime: '08:00',
      endTime: '18:00',
      breakStart: '12:00',
      breakEnd: '13:00'
    }))
    // 9h por dia x 5 dias = 45h = 2.700 min
    expect(availableMinutes({ days, blocks: [], ...week })).toBe(2700)
    // Quarta-feira (16/09) bloqueada o dia todo: menos 9h
    const wednesday = { startAt: new Date(2026, 8, 16).toISOString(), endAt: new Date(2026, 8, 17).toISOString() }
    expect(availableMinutes({ days, blocks: [wednesday], ...week })).toBe(2160)
    // Bloqueio só de manhã na segunda (08:00–12:00): menos 4h
    const morning = { startAt: new Date(2026, 8, 14, 8).toISOString(), endAt: new Date(2026, 8, 14, 12).toISOString() }
    expect(availableMinutes({ days, blocks: [morning], ...week })).toBe(2460)
  })

  it('sem horário cadastrado assume segunda a sexta, 8h às 18h', () => {
    expect(availableMinutes({ days: null, blocks: [], fromDate: '2026-09-14', toDate: '2026-09-20' })).toBe(3000)
  })

  it('taxa de ocupação', () => {
    expect(occupancyPercent(2250, 3000)).toBe(75)
    expect(occupancyTraffic(75)).toBe('green')
    expect(occupancyTraffic(74.9)).toBe('yellow')
    expect(occupancyTraffic(60)).toBe('yellow')
    expect(occupancyTraffic(59.9)).toBe('red')
    expect(occupancyPercent(10, 0)).toBeNull()
  })

  it('custo da hora ociosa = horas vagas × (custos fixos do mês ÷ horas disponíveis no mês)', () => {
    // 20 h vagas; custos fixos R$ 7.000,00; 176 h disponíveis no mês -> 20 x 39,7727 = R$ 795,45
    expect(idleCostCents(20 * 60, 700_000, 176 * 60)).toBe(79_545)
    expect(idleCostCents(0, 700_000, 176 * 60)).toBe(0)
    expect(idleCostCents(60, 700_000, 0)).toBe(0)
  })

  it('comissão calculada sobre o valor recebido', () => {
    expect(commissionCents(1_000_000, 12.5)).toBe(125_000)
  })

  it('margem por procedimento = preço − materiais − taxa de cartão − comissão', () => {
    // preço R$ 900; materiais R$ 200; taxa 3% = R$ 27; comissão 10% = R$ 90 -> sobra R$ 583 (64,78%)
    const m = procedureMargin({ priceCents: 90_000, materialsCents: 20_000, feePercent: 3, commissionPercent: 10 })
    expect(m.feeCents).toBe(2_700)
    expect(m.commissionCents).toBe(9_000)
    expect(m.marginCents).toBe(58_300)
    expect(m.marginPercent).toBeCloseTo(64.78, 2)
    expect(procedureMargin({ priceCents: 0, materialsCents: 0, feePercent: 0, commissionPercent: 0 }).marginPercent).toBeNull()
  })

  it('fluxo de caixa: entradas líquidas, saídas e saldo acumulado por dia', () => {
    const range: Range = {
      from: new Date(2026, 8, 5, 0, 0).toISOString(),
      to: new Date(2026, 8, 7, 23, 59, 59, 999).toISOString()
    }
    const inflow: PaidInstallmentRow[] = [
      { saleId: 'a', professionalId: null, amountCents: 100_000, feeCents: 3_000, paidAt: at(5) },
      { saleId: 'b', professionalId: null, amountCents: 50_000, feeCents: 0, paidAt: at(7) }
    ]
    const outflow: ExpenseRow[] = [{ amountCents: 40_000, kind: 'fixa', category: 'aluguel', dueDate: '2026-09-06', paidAt: at(6) }]
    const series = cashflowSeries({ received: inflow, expenses: outflow, range, granularity: 'day' })
    expect(series.map((p) => p.key)).toEqual(['2026-09-05', '2026-09-06', '2026-09-07'])
    expect(series.map((p) => p.inCents)).toEqual([97_000, 0, 50_000])
    expect(series.map((p) => p.outCents)).toEqual([0, 40_000, 0])
    expect(series.map((p) => p.balanceCents)).toEqual([97_000, 57_000, 107_000])
  })
})
