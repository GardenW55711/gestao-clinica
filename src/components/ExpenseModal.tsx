import { FormEvent, useState } from 'react'
import { centsToInput, parseMoneyInput } from '@shared/money'
import { EXPENSE_CATEGORY_LABELS } from '@shared/types'
import type { Expense, ExpenseCategory, ExpenseInput } from '@shared/types'
import { useEscapeKey } from '../utils/useEscapeKey'
import { Icon } from './Icons'

// Sugestão de tipo por categoria (a pessoa pode trocar): fixa = paga todo mês, mesmo sem atender ninguém.
const DEFAULT_KIND: Record<ExpenseCategory, 'fixa' | 'variavel'> = {
  aluguel: 'fixa',
  salarios: 'fixa',
  pro_labore: 'fixa',
  contas: 'fixa',
  laboratorio: 'variavel',
  materiais: 'variavel',
  marketing: 'variavel',
  impostos: 'fixa',
  manutencao: 'variavel',
  outros: 'variavel'
}

const todayStr = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  expense: Expense | null
  /** Valores iniciais para uma despesa nova (ex.: compra de estoque). */
  preset?: Partial<ExpenseInput>
  onClose: () => void
  onSaved: () => void
}

export function ExpenseModal({ expense, preset, onClose, onSaved }: Props): JSX.Element {
  useEscapeKey(onClose)
  const [description, setDescription] = useState(expense?.description ?? preset?.description ?? '')
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? preset?.category ?? 'outros')
  const [kind, setKind] = useState<'fixa' | 'variavel'>(expense?.kind ?? preset?.kind ?? DEFAULT_KIND['outros'])
  const [kindTouched, setKindTouched] = useState(Boolean(expense || preset?.kind))
  const [amount, setAmount] = useState(centsToInput(expense?.amountCents ?? preset?.amountCents ?? 0))
  const [dueDate, setDueDate] = useState(expense?.dueDate ?? preset?.dueDate ?? todayStr())
  const [paid, setPaid] = useState(expense ? expense.paidAt !== null : (preset?.paid ?? false))
  const [recurring, setRecurring] = useState(expense?.recurringMonthly ?? preset?.recurringMonthly ?? false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function changeCategory(next: ExpenseCategory): void {
    setCategory(next)
    if (!kindTouched) setKind(DEFAULT_KIND[next])
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    const input: ExpenseInput = {
      description: description.trim(),
      category,
      kind,
      amountCents: parseMoneyInput(amount),
      dueDate,
      paid,
      recurringMonthly: recurring
    }
    setSaving(true)
    const result = expense
      ? await window.api.expenses.update(expense.id, input)
      : await window.api.expenses.create(input)
    setSaving(false)
    if (!result.ok) return setError(result.error ?? 'Não foi possível salvar')
    onSaved()
  }

  return (
    <div className="modal-overlay">
      <form className="card modal-card" role="dialog" aria-modal="true" aria-labelledby="exp-title" onSubmit={handleSubmit}>
        <div className="modal-head">
          <h2 id="exp-title">{expense ? 'Editar despesa' : 'Nova despesa'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>

        <label>
          Descrição
          <input autoFocus value={description} onChange={(e) => setDescription(e.target.value)} required autoComplete="off" />
        </label>

        <div className="form-row">
          <label>
            Categoria
            <select value={category} onChange={(e) => changeCategory(e.target.value as ExpenseCategory)}>
              {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <div className="period-picker" role="group" aria-label="Tipo da despesa">
              <button
                type="button"
                className={kind === 'fixa' ? 'period-btn active' : 'period-btn'}
                onClick={() => {
                  setKind('fixa')
                  setKindTouched(true)
                }}
              >
                Fixa
              </button>
              <button
                type="button"
                className={kind === 'variavel' ? 'period-btn active' : 'period-btn'}
                onClick={() => {
                  setKind('variavel')
                  setKindTouched(true)
                }}
              >
                Variável
              </button>
            </div>
          </label>
        </div>
        <p className="subtitle">
          Fixa: paga todo mês, atendendo ou não (aluguel, salários). Variável: cresce com o movimento (materiais,
          laboratório).
        </p>

        <div className="form-row">
          <label>
            Valor (R$)
            <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </label>
          <label>
            Vencimento
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </label>
        </div>

        <label className="switch-row compact">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          Já foi paga
        </label>
        <label className="switch-row compact">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
          Repete todo mês (o programa cria a do mês seguinte sozinho)
        </label>

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : expense ? 'Salvar alterações' : 'Lançar despesa'}
          </button>
        </div>
      </form>
    </div>
  )
}
