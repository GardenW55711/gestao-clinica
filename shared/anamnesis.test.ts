import { describe, expect, it } from 'vitest'
import { alertsFromAnswers, isAnamnesisOverdue, validateAnamnesisAnswers } from './anamnesis'
import type { AnamnesisQuestion } from './anamnesis'

const questions: AnamnesisQuestion[] = [
  { id: 'motivo', text: 'Motivo da consulta', type: 'texto', required: true },
  {
    id: 'alergia',
    text: 'Tem alguma alergia?',
    type: 'sim_nao',
    required: true,
    generatesAlert: true,
    askDetailsIfYes: true,
    alertSeverity: 'grave'
  },
  {
    id: 'anticoagulante',
    text: 'Usa anticoagulante?',
    type: 'sim_nao',
    required: true,
    generatesAlert: true,
    alertLabel: 'Uso de anticoagulante',
    alertSeverity: 'grave'
  },
  { id: 'bruxismo', text: 'Range os dentes?', type: 'sim_nao', required: false },
  {
    id: 'doencas',
    text: 'Possui alguma destas condições?',
    type: 'multipla_escolha',
    required: false,
    options: ['Diabetes', 'Hipertensão', 'Asma'],
    generatesAlert: true,
    alertOptions: ['Diabetes', 'Hipertensão'],
    alertSeverity: 'atencao'
  }
]

describe('validação da anamnese', () => {
  it('reclama da primeira obrigatória que faltou', () => {
    expect(validateAnamnesisAnswers(questions, [])).toBe('Responda: Motivo da consulta')
  })

  it('passa quando todas as obrigatórias estão respondidas (as opcionais podem ficar em branco)', () => {
    const answers = [
      { questionId: 'motivo', value: 'Dor de dente' },
      { questionId: 'alergia', value: 'nao' },
      { questionId: 'anticoagulante', value: 'nao' }
    ]
    expect(validateAnamnesisAnswers(questions, answers)).toBeNull()
  })

  it('multipla_escolha obrigatória vazia falha, mas array com opção passa', () => {
    const withRequired: AnamnesisQuestion[] = [{ ...questions[4], required: true }]
    expect(validateAnamnesisAnswers(withRequired, [{ questionId: 'doencas', value: [] }])).toBe(
      'Responda: Possui alguma destas condições?'
    )
    expect(validateAnamnesisAnswers(withRequired, [{ questionId: 'doencas', value: ['Asma'] }])).toBeNull()
  })
})

describe('alertas gerados pela anamnese', () => {
  it('sim_nao com detalhe usa o texto detalhado como alerta', () => {
    const alerts = alertsFromAnswers(questions, [
      { questionId: 'alergia', value: 'sim', details: 'Alergia a penicilina' }
    ])
    expect(alerts).toEqual([{ text: 'Alergia a penicilina', severity: 'grave' }])
  })

  it('sim_nao sem detalhe cai para o rótulo do alerta', () => {
    const alerts = alertsFromAnswers(questions, [{ questionId: 'anticoagulante', value: 'sim' }])
    expect(alerts).toEqual([{ text: 'Uso de anticoagulante', severity: 'grave' }])
  })

  it('resposta "não" não gera alerta', () => {
    expect(alertsFromAnswers(questions, [{ questionId: 'alergia', value: 'nao' }])).toEqual([])
  })

  it('multipla_escolha gera um alerta por opção marcada que está em alertOptions', () => {
    const alerts = alertsFromAnswers(questions, [{ questionId: 'doencas', value: ['Diabetes', 'Asma', 'Hipertensão'] }])
    expect(alerts).toEqual([
      { text: 'Diabetes', severity: 'atencao' },
      { text: 'Hipertensão', severity: 'atencao' }
    ])
  })

  it('pergunta sem resposta não gera alerta', () => {
    expect(alertsFromAnswers(questions, [])).toEqual([])
  })
})

describe('anamnese vencida', () => {
  it('menos de 12 meses não está vencida', () => {
    const now = new Date('2026-09-28')
    const filledAt = new Date('2026-06-01').toISOString()
    expect(isAnamnesisOverdue(filledAt, now)).toBe(false)
  })

  it('mais de 12 meses está vencida', () => {
    const now = new Date('2026-09-28')
    const filledAt = new Date('2025-01-01').toISOString()
    expect(isAnamnesisOverdue(filledAt, now)).toBe(true)
  })
})
