import { randomUUID } from 'crypto'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { anamnesisRecords, anamnesisTemplates, patientAlerts, patients, staffMembers } from '../db/schema'
import { getCurrentStaffMemberId } from '../session'
import { EVERYONE, MANAGERS, handle, hasClinicalAccess, nowIso, requireClinicId, writeAudit } from './util'
import { loadClinicHeaderInfo } from './booking'
import { saveHtmlAsPdf, wrapDocumentHtml } from '../pdf/print'
import { alertsFromAnswers, isAnamnesisOverdue, validateAnamnesisAnswers } from '@shared/anamnesis'
import { DEFAULT_ANAMNESIS_TEMPLATES } from '@shared/anamnesisSeeds'
import type { AnamnesisAnswer, AnamnesisQuestion, AnamnesisRecord, AnamnesisRecordInput, AnamnesisTemplate, AnamnesisTemplateInput } from '@shared/anamnesis'

function validateQuestions(questions: AnamnesisQuestion[]): void {
  if (questions.length === 0) throw new Error('Adicione ao menos uma pergunta')
  for (const q of questions) {
    if (!q.text?.trim()) throw new Error('Toda pergunta precisa de um texto')
    if (q.type === 'multipla_escolha' && (!q.options || q.options.length < 2)) {
      throw new Error(`"${q.text}": informe ao menos 2 opções`)
    }
  }
}

function templateToDto(row: typeof anamnesisTemplates.$inferSelect): AnamnesisTemplate {
  return { id: row.id, name: row.name, questions: JSON.parse(row.questionsJson) as AnamnesisQuestion[] }
}

/** Cria os 4 modelos prontos (Padrão, Infantil, Ortodontia, Cirurgia/Implante) para uma clínica nova. */
export function seedAnamnesisTemplates(clinicId: string): void {
  const timestamp = nowIso()
  for (const template of DEFAULT_ANAMNESIS_TEMPLATES) {
    getDb()
      .insert(anamnesisTemplates)
      .values({
        id: randomUUID(),
        clinicId,
        name: template.name,
        questionsJson: JSON.stringify(template.questions),
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
        deletedAt: null
      })
      .run()
  }
}

function recordToDto(row: typeof anamnesisRecords.$inferSelect, redact: boolean): AnamnesisRecord {
  return {
    id: row.id,
    patientId: row.patientId,
    templateName: row.templateName,
    questions: redact ? [] : (JSON.parse(row.questionsJson) as AnamnesisQuestion[]),
    answers: redact ? [] : (JSON.parse(row.answersJson) as AnamnesisAnswer[]),
    filledByName: row.filledByName,
    filledAt: row.filledAt,
    signedOnPaperAt: row.signedOnPaperAt,
    overdue: isAnamnesisOverdue(row.filledAt),
    ...(redact ? { redacted: true } : {})
  }
}

export function registerAnamnesisHandlers(): void {
  // "Padrão" vem primeiro (é o mais usado no dia a dia); os demais, em ordem alfabética.
  handle('anamnesisTemplates:list', EVERYONE, (): AnamnesisTemplate[] =>
    getDb()
      .select()
      .from(anamnesisTemplates)
      .where(isNull(anamnesisTemplates.deletedAt))
      .all()
      .sort((a, b) => (a.name === 'Padrão' ? -1 : b.name === 'Padrão' ? 1 : a.name.localeCompare(b.name, 'pt-BR')))
      .map(templateToDto)
  )

  handle('anamnesisTemplates:create', MANAGERS, (input: AnamnesisTemplateInput): AnamnesisTemplate => {
    if (!input.name.trim()) throw new Error('Informe o nome do modelo')
    validateQuestions(input.questions)
    const clinicId = requireClinicId()
    const id = randomUUID()
    const timestamp = nowIso()
    getDb()
      .insert(anamnesisTemplates)
      .values({
        id,
        clinicId,
        name: input.name.trim(),
        questionsJson: JSON.stringify(input.questions),
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
        deletedAt: null
      })
      .run()
    return templateToDto(getDb().select().from(anamnesisTemplates).where(eq(anamnesisTemplates.id, id)).get()!)
  })

  handle('anamnesisTemplates:update', MANAGERS, (params: { id: string; input: AnamnesisTemplateInput }): AnamnesisTemplate => {
    if (!params.input.name.trim()) throw new Error('Informe o nome do modelo')
    validateQuestions(params.input.questions)
    const db = getDb()
    db.update(anamnesisTemplates)
      .set({
        name: params.input.name.trim(),
        questionsJson: JSON.stringify(params.input.questions),
        updatedAt: nowIso(),
        syncStatus: 'pending'
      })
      .where(eq(anamnesisTemplates.id, params.id))
      .run()
    return templateToDto(db.select().from(anamnesisTemplates).where(eq(anamnesisTemplates.id, params.id)).get()!)
  })

  // Não afeta anamneses já preenchidas: elas guardam sua própria cópia do modelo.
  handle('anamnesisTemplates:remove', MANAGERS, (id: string): null => {
    getDb()
      .update(anamnesisTemplates)
      .set({ deletedAt: nowIso(), updatedAt: nowIso(), syncStatus: 'pending' })
      .where(eq(anamnesisTemplates.id, id))
      .run()
    return null
  })

  // Ver o conteúdo completo (perguntas/respostas) exige acesso clínico; sem ele, vem só a data/quem preencheu.
  handle('anamnesisRecords:listByPatient', EVERYONE, (patientId: string): AnamnesisRecord[] => {
    const redact = !hasClinicalAccess()
    const rows = getDb()
      .select()
      .from(anamnesisRecords)
      .where(and(eq(anamnesisRecords.patientId, patientId), isNull(anamnesisRecords.deletedAt)))
      .all()
      .sort((a, b) => b.filledAt.localeCompare(a.filledAt))
    return rows.map((r) => recordToDto(r, redact))
  })

  // Preencher (transcrever a ficha em papel) vale para todo cargo — ver o histórico depois é que exige acesso clínico.
  handle('anamnesisRecords:create', EVERYONE, (input: AnamnesisRecordInput): AnamnesisRecord => {
    const clinicId = requireClinicId()
    const db = getDb()
    const template = db.select().from(anamnesisTemplates).where(eq(anamnesisTemplates.id, input.templateId)).get()
    if (!template) throw new Error('Modelo de anamnese não encontrado')
    const questions = JSON.parse(template.questionsJson) as AnamnesisQuestion[]

    const invalid = validateAnamnesisAnswers(questions, input.answers)
    if (invalid) throw new Error(invalid)

    const staffId = getCurrentStaffMemberId()
    const staff = staffId ? db.select({ name: staffMembers.name }).from(staffMembers).where(eq(staffMembers.id, staffId)).get() : null

    const id = randomUUID()
    const timestamp = nowIso()
    const alerts = alertsFromAnswers(questions, input.answers)

    db.transaction((tx) => {
      tx.insert(anamnesisRecords)
        .values({
          id,
          clinicId,
          patientId: input.patientId,
          templateName: template.name,
          questionsJson: JSON.stringify(questions),
          answersJson: JSON.stringify(input.answers),
          filledByName: staff?.name ?? 'Paciente (autoagendamento)',
          filledAt: timestamp,
          signedOnPaperAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          syncStatus: 'pending',
          deletedAt: null
        })
        .run()

      // A anamnese nova substitui os alertas que vieram de anamneses anteriores
      // (os manuais não são tocados). O registro antigo em si nunca é alterado.
      const previous = tx
        .select({ id: patientAlerts.id })
        .from(patientAlerts)
        .where(
          and(eq(patientAlerts.patientId, input.patientId), eq(patientAlerts.origin, 'anamnese'), eq(patientAlerts.active, true))
        )
        .all()
      if (previous.length > 0) {
        tx.update(patientAlerts)
          .set({ active: false, updatedAt: timestamp, syncStatus: 'pending' })
          .where(inArray(patientAlerts.id, previous.map((p) => p.id)))
          .run()
      }

      for (const alert of alerts) {
        tx.insert(patientAlerts)
          .values({
            id: randomUUID(),
            clinicId,
            patientId: input.patientId,
            text: alert.text,
            severity: alert.severity,
            origin: 'anamnese',
            sourceRecordId: id,
            active: true,
            createdAt: timestamp,
            updatedAt: timestamp,
            syncStatus: 'pending',
            deletedAt: null
          })
          .run()
      }
    })

    writeAudit('anamnesis_created', 'anamnesis_records', id)

    return recordToDto(db.select().from(anamnesisRecords).where(eq(anamnesisRecords.id, id)).get()!, false)
  })

  // Só controle de papelada (a pessoa assinou a folha impressa) — não exige acesso clínico.
  handle('anamnesisRecords:markSignedOnPaper', EVERYONE, (params: { id: string; date: string }): null => {
    getDb()
      .update(anamnesisRecords)
      .set({ signedOnPaperAt: new Date(`${params.date}T00:00:00`).toISOString(), updatedAt: nowIso(), syncStatus: 'pending' })
      .where(eq(anamnesisRecords.id, params.id))
      .run()
    return null
  })

  // Gera o PDF pra imprimir e o paciente assinar em papel (sem assinatura digital nesta fase).
  handle('anamnesisRecords:print', EVERYONE, async (id: string): Promise<string> => {
    const db = getDb()
    const record = db.select().from(anamnesisRecords).where(eq(anamnesisRecords.id, id)).get()
    if (!record) throw new Error('Anamnese não encontrada')
    const patient = db.select({ name: patients.name }).from(patients).where(eq(patients.id, record.patientId)).get()

    const questions = JSON.parse(record.questionsJson) as AnamnesisQuestion[]
    const answers = JSON.parse(record.answersJson) as AnamnesisAnswer[]
    const answerText = (q: AnamnesisQuestion): string => {
      const a = answers.find((x) => x.questionId === q.id)
      if (!a || a.value === '' || (Array.isArray(a.value) && a.value.length === 0)) return '<span class="muted">—</span>'
      const base =
        q.type === 'sim_nao' ? (a.value === 'sim' ? 'Sim' : 'Não') : Array.isArray(a.value) ? a.value.join(', ') : a.value
      const detail = a.details?.trim() ? ` — ${a.details.trim()}` : ''
      return escapeForPdf(base + detail)
    }

    const rows = questions
      .map((q) => `<tr><td style="width:55%">${escapeForPdf(q.text)}</td><td>${answerText(q)}</td></tr>`)
      .join('')

    const body = `
      <p><strong>Paciente:</strong> ${escapeForPdf(patient?.name ?? '(paciente removido)')}</p>
      <p><strong>Modelo:</strong> ${escapeForPdf(record.templateName)} · <strong>Preenchida em:</strong> ${new Date(record.filledAt).toLocaleDateString('pt-BR')} por ${escapeForPdf(record.filledByName)}</p>
      <table>${rows}</table>
      <div class="doc-signature">
        <div class="line"></div>
        <span>Assinatura do paciente (ou responsável)</span>
      </div>
    `

    const html = wrapDocumentHtml(loadClinicHeaderInfo(), 'Ficha de Anamnese', body)
    const result = await saveHtmlAsPdf(html, `Anamnese - ${patient?.name ?? 'paciente'}.pdf`)
    if (!result.ok) throw new Error(result.error ?? 'Não foi possível gerar o PDF')
    writeAudit('anamnesis_printed', 'anamnesis_records', id)
    return result.path ?? ''
  })
}

function escapeForPdf(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
