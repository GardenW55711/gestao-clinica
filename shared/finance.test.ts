import { describe, expect, it } from 'vitest'
import {
  addMonthsToDate,
  cardFeePercent,
  discountCentsFrom,
  installmentFeeCents,
  isOverdue,
  saleStatusFrom,
  suggestInstallments
} from './finance'

const fees = { debitPercent: 1.5, creditPercent: 3, creditInstallmentPercent: 4.5 }

describe('cobrança, parcelas e taxas', () => {
  it('escolhe a taxa certa por forma de pagamento', () => {
    expect(cardFeePercent('cartao_debito', 1, fees)).toBe(1.5)
    expect(cardFeePercent('cartao_credito', 1, fees)).toBe(3)
    expect(cardFeePercent('cartao_credito', 3, fees)).toBe(4.5)
    expect(cardFeePercent('pix', 1, fees)).toBe(0)
    expect(cardFeePercent('dinheiro', 1, fees)).toBe(0)
  })

  it('calcula a taxa em centavos', () => {
    // R$ 1.000,00 em crédito à vista com 3% = R$ 30,00
    expect(installmentFeeCents(100000, 'cartao_credito', 1, fees)).toBe(3000)
    // R$ 333,34 em 3x com 4,5% = 15,0003 -> R$ 15,00
    expect(installmentFeeCents(33334, 'cartao_credito', 3, fees)).toBe(1500)
    expect(installmentFeeCents(50000, 'pix', 1, fees)).toBe(0)
  })

  it('aplica desconto por valor ou percentual sem passar do bruto', () => {
    expect(discountCentsFrom(90000, 'percent', 10)).toBe(9000)
    expect(discountCentsFrom(90000, 'value', 5000)).toBe(5000)
    expect(discountCentsFrom(90000, 'value', 999999)).toBe(90000)
    expect(discountCentsFrom(90000, 'percent', 150)).toBe(90000)
    expect(discountCentsFrom(90000, 'value', -10)).toBe(0)
  })

  it('soma meses mantendo o dia ou o último dia do mês', () => {
    expect(addMonthsToDate('2026-01-15', 1)).toBe('2026-02-15')
    expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsToDate('2026-11-30', 3)).toBe('2027-02-28')
    expect(addMonthsToDate('2026-12-10', 1)).toBe('2027-01-10')
  })

  it('sugere parcelas que fecham o total', () => {
    const parcels = suggestInstallments(100000, 3, '2026-09-10', true)
    expect(parcels.map((p) => p.amountCents)).toEqual([33334, 33333, 33333])
    expect(parcels.reduce((s, p) => s + p.amountCents, 0)).toBe(100000)
    expect(parcels.map((p) => p.dueDate)).toEqual(['2026-09-10', '2026-10-10', '2026-11-10'])
    expect(parcels.map((p) => p.paid)).toEqual([true, false, false])
  })

  it('deriva o status da cobrança pelas parcelas', () => {
    expect(saleStatusFrom([{ paid: false }, { paid: false }])).toBe('pendente')
    expect(saleStatusFrom([{ paid: true }, { paid: false }])).toBe('parcial')
    expect(saleStatusFrom([{ paid: true }, { paid: true }])).toBe('paga')
  })

  it('marca atraso só quando vencida e não paga', () => {
    expect(isOverdue('2026-09-01', null, '2026-09-26')).toBe(true)
    expect(isOverdue('2026-09-26', null, '2026-09-26')).toBe(false)
    expect(isOverdue('2026-09-01', '2026-09-02T10:00:00.000Z', '2026-09-26')).toBe(false)
  })
})
