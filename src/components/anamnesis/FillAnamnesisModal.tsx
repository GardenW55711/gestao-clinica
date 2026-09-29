import { FormEvent, useEffect, useState } from 'react'
import type { AnamnesisAnswer, AnamnesisQuestion, AnamnesisTemplate } from '@shared/anamnesis'
import { validateAnamnesisAnswers } from '@shared/anamnesis'
import { useEscapeKey } from '../../utils/useEscapeKey'
import { Icon } from '../Icons'

function QuestionField({
  question,
  answer,
  onChange
}: {
  question: AnamnesisQuestion
  answer: AnamnesisAnswer
  onChange: (answer: AnamnesisAnswer) => void
}): JSX.Element {
  if (question.type === 'sim_nao') {
    return (
      <div className="anamnesis-field">
        <span className="field-label">
          {question.text} {question.required && <span className="req">*</span>}
        </span>
        <div className="period-picker" role="group" aria-label={question.text}>
          <button type="button" className={answer.value === 'nao' ? 'period-btn active' : 'period-btn'} onClick={() => onChange({ ...answer, value: 'nao' })}>
            Não
          </button>
          <button type="button" className={answer.value === 'sim' ? 'period-btn active' : 'period-btn'} onClick={() => onChange({ ...answer, value: 'sim' })}>
            Sim
          </button>
        </div>
        {question.askDetailsIfYes && answer.value === 'sim' && (
          <input
            className="anamnesis-detail"
            placeholder="Detalhe (ex.: nome do medicamento)"
            value={answer.details ?? ''}
            onChange={(e) => onChange({ ...answer, details: e.target.value })}
            autoComplete="off"
          />
        )}
      </div>
    )
  }

  if (question.type === 'multipla_escolha') {
    const selected = Array.isArray(answer.value) ? answer.value : []
    function toggle(option: string, checked: boolean): void {
      onChange({ ...answer, value: checked ? [...selected, option] : selected.filter((o) => o !== option) })
    }
    return (
      <div className="anamnesis-field">
        <span className="field-label">
          {question.text} {question.required && <span className="req">*</span>}
        </span>
        <div className="chips-row">
          {(question.options ?? []).map((o) => (
            <label key={o} className="check-chip">
              <input type="checkbox" checked={selected.includes(o)} onChange={(e) => toggle(o, e.target.checked)} />
              {o}
            </label>
          ))}
        </div>
      </div>
    )
  }

  return (
    <label className="anamnesis-field">
      {question.text} {question.required && <span className="req">*</span>}
      <textarea
        rows={2}
        value={typeof answer.value === 'string' ? answer.value : ''}
        onChange={(e) => onChange({ ...answer, value: e.target.value })}
      />
    </label>
  )
}

export function FillAnamnesisModal({
  patientId,
  onClose,
  onSaved
}: {
  patientId: string
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  useEscapeKey(onClose)
  const [templates, setTemplates] = useState<AnamnesisTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [answers, setAnswers] = useState<AnamnesisAnswer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.anamnesisTemplates.list().then((r) => {
      if (r.ok && r.data) {
        setTemplates(r.data)
        if (r.data[0]) chooseTemplate(r.data[0].id, r.data)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function chooseTemplate(id: string, list = templates): void {
    setTemplateId(id)
    const template = list.find((t) => t.id === id)
    setAnswers((template?.questions ?? []).map((q) => ({ questionId: q.id, value: q.type === 'multipla_escolha' ? [] : '' })))
  }

  const template = templates.find((t) => t.id === templateId)

  function updateAnswer(questionId: string, next: AnamnesisAnswer): void {
    setAnswers((prev) => prev.map((a) => (a.questionId === questionId ? next : a)))
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    if (!template) return
    const invalid = validateAnamnesisAnswers(template.questions, answers)
    if (invalid) return setError(invalid)
    setSaving(true)
    const result = await window.api.anamnesisRecords.create({ patientId, templateId, answers })
    setSaving(false)
    if (!result.ok) return setError(result.error ?? 'Não foi possível salvar')
    onSaved()
  }

  return (
    <div className="modal-overlay">
      <form className="card modal-card wide" role="dialog" aria-modal="true" aria-labelledby="fill-anamnesis-title" onSubmit={handleSubmit}>
        <div className="modal-head">
          <h2 id="fill-anamnesis-title">Preencher anamnese</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>

        {templates.length > 1 && (
          <label>
            Modelo
            <select value={templateId} onChange={(e) => chooseTemplate(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {!template && <p className="subtitle">Nenhum modelo de anamnese cadastrado — crie um em Configurações › Modelos de anamnese.</p>}

        {template && (
          <div className="anamnesis-form">
            {template.questions.map((q) => {
              const a = answers.find((x) => x.questionId === q.id) ?? { questionId: q.id, value: '' }
              return <QuestionField key={q.id} question={q} answer={a} onChange={(next) => updateAnswer(q.id, next)} />
            })}
          </div>
        )}

        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving || !template}>
            {saving ? 'Salvando...' : 'Salvar anamnese'}
          </button>
        </div>
      </form>
    </div>
  )
}
