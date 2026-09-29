import { describe, expect, it } from 'vitest'
import { alertsSummaryText, hasGraveAlert, sortAlertsBySeverity } from './alerts'

const a = (text: string, severity: 'atencao' | 'grave') => ({ id: text, text, severity })

describe('alertas de saúde do paciente', () => {
  it('coloca os graves antes dos de atenção', () => {
    const sorted = sortAlertsBySeverity([a('Diabetes', 'atencao'), a('Alergia a penicilina', 'grave'), a('Fuma', 'atencao')])
    expect(sorted.map((x) => x.text)).toEqual(['Alergia a penicilina', 'Diabetes', 'Fuma'])
  })

  it('detecta se há algum alerta grave', () => {
    expect(hasGraveAlert([a('Fuma', 'atencao')])).toBe(false)
    expect(hasGraveAlert([a('Anticoagulante', 'grave')])).toBe(true)
    expect(hasGraveAlert([])).toBe(false)
  })

  it('resume em texto curto, priorizando os graves e contando o resto', () => {
    expect(alertsSummaryText([a('Diabetes', 'atencao')])).toBe('Diabetes')
    expect(
      alertsSummaryText([a('Diabetes', 'atencao'), a('Alergia a látex', 'grave'), a('Gestante', 'grave'), a('Fuma', 'atencao')], 2)
    ).toBe('Alergia a látex · Gestante (+2)')
    expect(alertsSummaryText([])).toBe('')
  })
})
