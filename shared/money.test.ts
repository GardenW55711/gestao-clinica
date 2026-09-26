import { describe, expect, it } from 'vitest'
import { centsToInput, parseMoneyInput, percentOf, splitCents, toCents } from './money'

describe('dinheiro em centavos', () => {
  it('converte reais em centavos sem erro de ponto flutuante', () => {
    expect(toCents(12.34)).toBe(1234)
    expect(toCents(1.005)).toBe(101)
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(toCents('')).toBe(0)
    expect(toCents(null)).toBe(0)
  })

  it('lê a digitação em formato brasileiro e simples', () => {
    expect(parseMoneyInput('1.234,56')).toBe(123456)
    expect(parseMoneyInput('900')).toBe(90000)
    expect(parseMoneyInput('12.5')).toBe(1250)
    expect(parseMoneyInput('  ')).toBe(0)
    expect(centsToInput(90000)).toBe('900.00')
  })

  it('calcula percentual arredondando para o centavo', () => {
    expect(percentOf(10000, 2.5)).toBe(250)
    expect(percentOf(333, 3.49)).toBe(12)
  })

  it('divide em parcelas sem perder centavo', () => {
    expect(splitCents(10000, 3)).toEqual([3334, 3333, 3333])
    expect(splitCents(10000, 3).reduce((a, b) => a + b, 0)).toBe(10000)
    expect(splitCents(5000, 1)).toEqual([5000])
  })
})
