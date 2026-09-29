// Tipos e regras puras da anamnese (Fase 2 / Etapa B). O registro preenchido
// guarda uma CÓPIA do modelo (perguntas) no momento do preenchimento — se o
// modelo mudar depois, o registro antigo não muda (é documento legal).
import type { PatientAlertSeverity } from './types'

export type AnamnesisAnswerType = 'sim_nao' | 'texto' | 'multipla_escolha'

export interface AnamnesisQuestion {
  id: string
  text: string
  type: AnamnesisAnswerType
  required: boolean
  /** Só para multipla_escolha: as opções que a pessoa pode marcar (mais de uma). */
  options?: string[]
  /** sim_nao: gera alerta quando a resposta é "sim". multipla_escolha: gera quando alguma opção de alertOptions é marcada. */
  generatesAlert?: boolean
  /** Rótulo do alerta; se vazio, usa o texto da pergunta (sim_nao) ou da opção marcada (multipla_escolha). */
  alertLabel?: string
  alertSeverity?: PatientAlertSeverity
  /** Só para multipla_escolha: quais opções, se marcadas, geram alerta (uma cada). */
  alertOptions?: string[]
  /** Só para sim_nao: mostra um campo de texto para detalhar quando a resposta é "sim". */
  askDetailsIfYes?: boolean
}

export interface AnamnesisTemplate {
  id: string
  name: string
  questions: AnamnesisQuestion[]
}

export interface AnamnesisTemplateInput {
  name: string
  questions: AnamnesisQuestion[]
}

/** Resposta de uma pergunta: sim/não ou texto ("sim"/"não"), texto livre, ou as opções marcadas. */
export type AnamnesisAnswerValue = string | string[]

export interface AnamnesisAnswer {
  questionId: string
  value: AnamnesisAnswerValue
  /** Só para sim_nao com askDetailsIfYes e resposta "sim". */
  details?: string
}

export interface AnamnesisRecord {
  id: string
  patientId: string
  templateName: string // nome do modelo no momento do preenchimento (o modelo pode ter sido renomeado/apagado depois)
  questions: AnamnesisQuestion[] // cópia do modelo no momento do preenchimento
  answers: AnamnesisAnswer[]
  filledByName: string
  filledAt: string
  signedOnPaperAt: string | null
  overdue: boolean // mais de 12 meses
  /** true = quem pediu não tem acesso clínico; questions/answers vêm vazios de propósito. */
  redacted?: boolean
}

export interface AnamnesisRecordInput {
  patientId: string
  templateId: string
  answers: AnamnesisAnswer[]
}

export interface GeneratedAlert {
  text: string
  severity: PatientAlertSeverity
}

function answerOf(answers: AnamnesisAnswer[], questionId: string): AnamnesisAnswer | undefined {
  return answers.find((a) => a.questionId === questionId)
}

/** Confere se todas as perguntas obrigatórias foram respondidas (sim_nao/multipla_escolha sempre valem; texto não pode ficar em branco). */
export function validateAnamnesisAnswers(questions: AnamnesisQuestion[], answers: AnamnesisAnswer[]): string | null {
  for (const q of questions) {
    if (!q.required) continue
    const a = answerOf(answers, q.id)
    const empty =
      !a ||
      a.value === '' ||
      a.value === undefined ||
      (Array.isArray(a.value) && a.value.length === 0)
    if (empty) return `Responda: ${q.text}`
  }
  return null
}

/** Extrai os alertas de saúde a partir das respostas, seguindo as regras de cada pergunta. */
export function alertsFromAnswers(questions: AnamnesisQuestion[], answers: AnamnesisAnswer[]): GeneratedAlert[] {
  const alerts: GeneratedAlert[] = []
  for (const q of questions) {
    const a = answerOf(answers, q.id)
    if (!a) continue

    if (q.type === 'sim_nao' && q.generatesAlert && a.value === 'sim') {
      const text = (q.askDetailsIfYes && a.details?.trim()) || q.alertLabel?.trim() || q.text
      alerts.push({ text, severity: q.alertSeverity ?? 'atencao' })
    }

    if (q.type === 'multipla_escolha' && q.alertOptions?.length && Array.isArray(a.value)) {
      for (const option of a.value) {
        if (q.alertOptions.includes(option)) {
          alerts.push({ text: q.alertLabel?.trim() || option, severity: q.alertSeverity ?? 'atencao' })
        }
      }
    }
  }
  return alerts
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

/** Anamnese "vencida": foi preenchida há mais de 12 meses. */
export function isAnamnesisOverdue(filledAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(filledAt).getTime() > ONE_YEAR_MS
}
