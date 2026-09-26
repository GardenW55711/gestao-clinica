import { percentOf, splitCents } from './money'
import type { CardFees, InstallmentInput, PaymentMethod, SaleStatus } from './types'

/** Percentual de taxa do cartão para uma parcela (0 para as demais formas). */
export function cardFeePercent(method: PaymentMethod, totalInstallments: number, fees: CardFees): number {
  if (method === 'cartao_debito') return fees.debitPercent
  if (method === 'cartao_credito') return totalInstallments > 1 ? fees.creditInstallmentPercent : fees.creditPercent
  return 0
}

/** Taxa em centavos cobrada sobre o valor de uma parcela. */
export function installmentFeeCents(
  amountCents: number,
  method: PaymentMethod,
  totalInstallments: number,
  fees: CardFees
): number {
  return percentOf(amountCents, cardFeePercent(method, totalInstallments, fees))
}

/** Desconto em centavos, a partir de um valor (centavos) ou de um percentual. Nunca passa do bruto. */
export function discountCentsFrom(grossCents: number, type: 'value' | 'percent', value: number): number {
  const raw = type === 'percent' ? percentOf(grossCents, Math.min(Math.max(value, 0), 100)) : Math.round(value)
  return Math.min(Math.max(raw, 0), grossCents)
}

/** AAAA-MM-DD + n meses, mantendo o dia (ou o último dia do mês, se não existir). */
export function addMonthsToDate(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1 + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  const day = Math.min(d, lastDay)
  const mm = String(target.getMonth() + 1).padStart(2, '0')
  return `${target.getFullYear()}-${mm}-${String(day).padStart(2, '0')}`
}

/** Parcelas sugeridas: valores divididos sem perder centavo e vencimentos mensais. */
export function suggestInstallments(
  totalCents: number,
  count: number,
  firstDueDate: string,
  paidFirst: boolean
): InstallmentInput[] {
  const n = Math.max(1, Math.floor(count))
  return splitCents(totalCents, n).map((amountCents, i) => ({
    amountCents,
    dueDate: addMonthsToDate(firstDueDate, i),
    paid: paidFirst && i === 0
  }))
}

/** Status da cobrança a partir das parcelas (cancelada é decidida à parte). */
export function saleStatusFrom(installments: { paid: boolean }[]): Exclude<SaleStatus, 'cancelada'> {
  if (installments.length === 0) return 'pendente'
  const paid = installments.filter((i) => i.paid).length
  if (paid === 0) return 'pendente'
  return paid === installments.length ? 'paga' : 'parcial'
}

/** Uma parcela está em atraso se não foi paga e o vencimento já passou (comparando só a data). */
export function isOverdue(dueDate: string, paidAt: string | null, today: string): boolean {
  return paidAt === null && dueDate < today
}
