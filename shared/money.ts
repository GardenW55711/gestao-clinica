// Dinheiro sempre em CENTAVOS INTEIROS (R$ 12,34 = 1234). Número com vírgula
// (float) acumula erros de centavo em somas, taxas e comissões; inteiro não.

/** Converte reais digitados/decimais ("12,34", "12.34", 12.34) em centavos inteiros. */
export function toCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(n)) return 0
  // Number.EPSILON evita que 1.005 * 100 = 100.49999 vire 100.
  return Math.round(n * 100 + Math.sign(n) * Number.EPSILON * 100)
}

/** Converte a digitação de um campo de valor ("1.234,56" ou "1234.56") em centavos. */
export function parseMoneyInput(text: string): number {
  const clean = text.trim()
  if (!clean) return 0
  // Com vírgula, é formato brasileiro (pontos = milhar). Sem vírgula, o ponto é decimal.
  if (clean.includes(',')) return toCents(clean)
  return toCents(Number(clean))
}

/** Centavos -> texto para preencher um campo de valor: 90000 -> "900.00". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2)
}

/** Valor por percentual, arredondado para o centavo: percentOf(10000, 2.5) = 250. */
export function percentOf(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100)
}

/** Divide um total em N parcelas sem perder centavo; a sobra vai para a primeira. */
export function splitCents(total: number, parts: number): number[] {
  if (parts <= 1) return [total]
  const base = Math.floor(total / parts)
  const remainder = total - base * parts
  return Array.from({ length: parts }, (_, i) => base + (i === 0 ? remainder : 0))
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
