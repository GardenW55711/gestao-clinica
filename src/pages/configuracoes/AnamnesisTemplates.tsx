import { FormEvent, useCallback, useEffect, useState } from 'react'
import type { AnamnesisAnswerType, AnamnesisQuestion, AnamnesisTemplate } from '@shared/anamnesis'
import { useFeedback } from '../../components/Feedback'
import { Icon } from '../../components/Icons'
import { useEscapeKey } from '../../utils/useEscapeKey'

const TYPE_LABELS: Record<AnamnesisAnswerType, string> = {
  sim_nao: 'Sim / Não',
  texto: 'Texto livre',
  multipla_escolha: 'Múltipla escolha'
}

let nextId = 1
const newId = (): string => `q${Date.now()}_${nextId++}`

const emptyQuestion = (): AnamnesisQuestion => ({ id: newId(), text: '', type: 'sim_nao', required: false })

function QuestionEditor({
  question,
  onChange,
  onRemove,
  onMove
}: {
  question: AnamnesisQuestion
  onChange: (q: AnamnesisQuestion) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}): JSX.Element {
  const optionsText = (question.options ?? []).join(', ')

  function setOptions(text: string): void {
    const options = text
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
    onChange({ ...question, options, alertOptions: (question.alertOptions ?? []).filter((o) => options.includes(o)) })
  }

  function toggleAlertOption(option: string, checked: boolean): void {
    const current = question.alertOptions ?? []
    onChange({ ...question, alertOptions: checked ? [...current, option] : current.filter((o) => o !== option) })
  }

  return (
    <li className="question-editor row-enter">
      <div className="question-editor-head">
        <input
          className="question-text"
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          placeholder="Texto da pergunta"
        />
        <div className="question-editor-actions">
          <button type="button" className="icon-btn" aria-label="Mover para cima" onClick={() => onMove(-1)}>
            <Icon name="chevronLeft" size={15} className="rotate90" />
          </button>
          <button type="button" className="icon-btn" aria-label="Mover para baixo" onClick={() => onMove(1)}>
            <Icon name="chevronRight" size={15} className="rotate90" />
          </button>
          <button type="button" className="icon-btn danger" aria-label="Remover pergunta" onClick={onRemove}>
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>

      <div className="form-row three">
        <label>
          Tipo de resposta
          <select value={question.type} onChange={(e) => onChange({ ...question, type: e.target.value as AnamnesisAnswerType })}>
            {(Object.keys(TYPE_LABELS) as AnamnesisAnswerType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="switch-row compact">
          <input type="checkbox" checked={question.required} onChange={(e) => onChange({ ...question, required: e.target.checked })} />
          Obrigatória
        </label>
        {question.type === 'sim_nao' && (
          <label className="switch-row compact">
            <input
              type="checkbox"
              checked={question.askDetailsIfYes ?? false}
              onChange={(e) => onChange({ ...question, askDetailsIfYes: e.target.checked })}
            />
            Pedir detalhes se "sim"
          </label>
        )}
      </div>

      {question.type === 'multipla_escolha' && (
        <label>
          Opções (separadas por vírgula)
          <input value={optionsText} onChange={(e) => setOptions(e.target.value)} placeholder="Ex.: Diabetes, Hipertensão, Asma" />
        </label>
      )}

      {question.type !== 'texto' && (
        <div className="alert-config">
          <label className="switch-row compact">
            <input
              type="checkbox"
              checked={question.generatesAlert ?? false}
              onChange={(e) => onChange({ ...question, generatesAlert: e.target.checked })}
            />
            Gera alerta de saúde
          </label>
          {question.generatesAlert && question.type === 'sim_nao' && (
            <label>
              Rótulo do alerta (opcional — sem isso usa o texto da pergunta)
              <input value={question.alertLabel ?? ''} onChange={(e) => onChange({ ...question, alertLabel: e.target.value })} />
            </label>
          )}
          {question.generatesAlert && question.type === 'multipla_escolha' && (question.options ?? []).length > 0 && (
            <div className="alert-options">
              <span className="subtitle tight">Quais opções geram alerta?</span>
              <div className="chips-row">
                {(question.options ?? []).map((o) => (
                  <label key={o} className="check-chip">
                    <input
                      type="checkbox"
                      checked={(question.alertOptions ?? []).includes(o)}
                      onChange={(e) => toggleAlertOption(o, e.target.checked)}
                    />
                    {o}
                  </label>
                ))}
              </div>
            </div>
          )}
          {question.generatesAlert && (
            <label>
              Gravidade
              <div className="period-picker" role="group" aria-label="Gravidade do alerta">
                <button
                  type="button"
                  className={question.alertSeverity !== 'grave' ? 'period-btn active' : 'period-btn'}
                  onClick={() => onChange({ ...question, alertSeverity: 'atencao' })}
                >
                  Atenção
                </button>
                <button
                  type="button"
                  className={question.alertSeverity === 'grave' ? 'period-btn active' : 'period-btn'}
                  onClick={() => onChange({ ...question, alertSeverity: 'grave' })}
                >
                  Grave
                </button>
              </div>
            </label>
          )}
        </div>
      )}
    </li>
  )
}

function TemplateFormModal({
  template,
  onClose,
  onSaved
}: {
  template: AnamnesisTemplate | null
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  useEscapeKey(onClose)
  const [name, setName] = useState(template?.name ?? '')
  const [questions, setQuestions] = useState<AnamnesisQuestion[]>(template?.questions ?? [emptyQuestion()])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function updateQuestion(index: number, q: AnamnesisQuestion): void {
    setQuestions((prev) => prev.map((x, i) => (i === index ? q : x)))
  }

  function moveQuestion(index: number, dir: -1 | 1): void {
    setQuestions((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Informe o nome do modelo')
    if (questions.some((q) => !q.text.trim())) return setError('Toda pergunta precisa de um texto')
    setSaving(true)
    const input = { name: name.trim(), questions }
    const result = template ? await window.api.anamnesisTemplates.update(template.id, input) : await window.api.anamnesisTemplates.create(input)
    setSaving(false)
    if (!result.ok) return setError(result.error ?? 'Não foi possível salvar')
    onSaved()
  }

  return (
    <div className="modal-overlay">
      <form className="card modal-card wide" role="dialog" aria-modal="true" aria-labelledby="tpl-title" onSubmit={handleSubmit}>
        <div className="modal-head">
          <h2 id="tpl-title">{template ? 'Editar modelo' : 'Novo modelo de anamnese'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>

        <label>
          Nome do modelo
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" />
        </label>

        <section className="modal-section">
          <div className="page-head">
            <h3>Perguntas</h3>
            <button type="button" className="soft-btn" onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}>
              <Icon name="plus" size={15} /> Adicionar pergunta
            </button>
          </div>
          <ul className="question-list">
            {questions.map((q, i) => (
              <QuestionEditor
                key={q.id}
                question={q}
                onChange={(next) => updateQuestion(i, next)}
                onRemove={() => setQuestions((prev) => prev.filter((_, idx) => idx !== i))}
                onMove={(dir) => moveQuestion(i, dir)}
              />
            ))}
          </ul>
        </section>

        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar modelo'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function AnamnesisTemplates(): JSX.Element {
  const { toast, confirm } = useFeedback()
  const [templates, setTemplates] = useState<AnamnesisTemplate[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState<AnamnesisTemplate | 'new' | null>(null)

  const load = useCallback(async (): Promise<void> => {
    const r = await window.api.anamnesisTemplates.list()
    if (r.ok && r.data) setTemplates(r.data)
    setLoaded(true)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function remove(template: AnamnesisTemplate): Promise<void> {
    const ok = await confirm({
      title: `Remover "${template.name}"?`,
      message: 'As anamneses já preenchidas com este modelo continuam guardadas normalmente (elas têm sua própria cópia das perguntas).',
      confirmLabel: 'Remover',
      danger: true
    })
    if (!ok) return
    await window.api.anamnesisTemplates.remove(template.id)
    toast.info('Modelo removido')
    load()
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2 className="section-title">Modelos de anamnese</h2>
          <p className="subtitle">Usados ao preencher a anamnese na ficha do paciente. Editar um modelo não muda anamneses já preenchidas.</p>
        </div>
        <button type="button" className="with-icon" onClick={() => setEditing('new')}>
          <Icon name="plus" size={18} />
          Novo modelo
        </button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Perguntas</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {loaded &&
            templates.map((t) => (
              <tr key={t.id} className="row-enter clickable" onDoubleClick={() => setEditing(t)}>
                <td>
                  <strong>{t.name}</strong>
                </td>
                <td>{t.questions.length}</td>
                <td className="row-actions">
                  <div className="row-actions-inner">
                    <button type="button" className="icon-btn" aria-label={`Editar ${t.name}`} title="Editar" onClick={() => setEditing(t)}>
                      <Icon name="edit" size={17} />
                    </button>
                    <button type="button" className="icon-btn danger" aria-label={`Remover ${t.name}`} title="Remover" onClick={() => remove(t)}>
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          {loaded && templates.length === 0 && (
            <tr>
              <td colSpan={3} className="empty-row">
                Nenhum modelo cadastrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editing && (
        <TemplateFormModal
          template={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            toast.success('Modelo salvo')
            load()
          }}
        />
      )}
    </div>
  )
}
