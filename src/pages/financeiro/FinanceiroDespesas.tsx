import { useCallback, useEffect, useMemo, useState } from 'react'
import { EXPENSE_CATEGORY_LABELS } from '@shared/types'
import type { Expense } from '@shared/types'
import { ExpenseModal } from '../../components/ExpenseModal'
import { useFeedback } from '../../components/Feedback'
import { Icon } from '../../components/Icons'
import { formatCurrency } from '../../utils/masks'

type Filter = 'todas' | 'pendentes' | 'pagas' | 'atrasadas'

function monthBounds(cursor: Date): { from: string; to: string } {
  const y = cursor.getFullYear()
  const m = cursor.getMonth()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const last = new Date(y, m + 1, 0).getDate()
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(last)}` }
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function FinanceiroDespesas(): JSX.Element {
  const { toast, confirm } = useFeedback()
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [filter, setFilter] = useState<Filter>('todas')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)

  const { from, to } = useMemo(() => monthBounds(cursor), [cursor])

  const load = useCallback(async (): Promise<void> => {
    const result = await window.api.expenses.list(from, to)
    if (result.ok && result.data) setExpenses(result.data)
    setLoaded(true)
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  const shown = expenses.filter((e) =>
    filter === 'todas'
      ? true
      : filter === 'pagas'
        ? e.paidAt !== null
        : filter === 'pendentes'
          ? e.paidAt === null
          : e.overdue
  )
  const total = expenses.reduce((s, e) => s + e.amountCents, 0)
  const paid = expenses.filter((e) => e.paidAt).reduce((s, e) => s + e.amountCents, 0)
  const overdueCount = expenses.filter((e) => e.overdue).length

  async function togglePaid(e: Expense): Promise<void> {
    const result = await window.api.expenses.setPaid(e.id, e.paidAt === null)
    if (!result.ok) return void toast.error(result.error ?? 'Não foi possível atualizar')
    load()
  }

  async function remove(e: Expense): Promise<void> {
    const ok = await confirm({
      title: `Remover "${e.description}"?`,
      message: e.recurringMonthly
        ? 'Esta despesa repete todo mês; só este lançamento será removido. Para parar de repetir, use Editar e desmarque "Repete todo mês".'
        : 'Ela deixa de aparecer nas listas e nos cálculos.',
      confirmLabel: 'Remover',
      danger: true
    })
    if (!ok) return
    await window.api.expenses.remove(e.id, false)
    toast.info('Despesa removida')
    load()
  }

  const monthTitle = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="page-head">
        <p className="subtitle">
          Tudo que sai do caixa. Despesas fixas e variáveis alimentam o lucro e o ponto de equilíbrio.
        </p>
        <button type="button" className="with-icon" onClick={() => setEditing('new')}>
          <Icon name="plus" size={18} />
          Nova despesa
        </button>
      </div>

      <div className="month-nav">
        <button type="button" className="icon-btn" aria-label="Mês anterior" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <h3 className="month-title">{monthTitle}</h3>
        <button type="button" className="icon-btn" aria-label="Próximo mês" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>

      <div className="tiles kpis">
        <div className="tile static">
          <span className="tile-label">Total do mês</span>
          <span className="tile-value">{formatCurrency(total)}</span>
          <span className="tile-hint">{expenses.length} lançamentos</span>
        </div>
        <div className="tile static">
          <span className="tile-label">Já pago</span>
          <span className="tile-value">{formatCurrency(paid)}</span>
          <span className="tile-hint">saiu do caixa</span>
        </div>
        <div className={overdueCount > 0 ? 'tile static warn' : 'tile static'}>
          <span className="tile-label">A pagar</span>
          <span className="tile-value">{formatCurrency(total - paid)}</span>
          <span className="tile-hint">{overdueCount > 0 ? `${overdueCount} em atraso` : 'nada atrasado'}</span>
        </div>
      </div>

      <div className="chips-row status-tabs" role="tablist" aria-label="Situação">
        {(['todas', 'pendentes', 'atrasadas', 'pagas'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={f === filter}
            className={f === filter ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setFilter(f)}
          >
            {f === 'todas' ? 'Todas' : f === 'pendentes' ? 'Pendentes' : f === 'atrasadas' ? 'Em atraso' : 'Pagas'}
          </button>
        ))}
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Vencimento</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Tipo</th>
            <th>Valor</th>
            <th>Situação</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {!loaded &&
            [0, 1, 2].map((i) => (
              <tr key={`sk-${i}`}>
                <td colSpan={7}>
                  <div className="skeleton" />
                </td>
              </tr>
            ))}
          {loaded &&
            shown.map((e) => (
              <tr key={e.id} className="row-enter clickable" onDoubleClick={() => setEditing(e)}>
                <td>{fmtDate(e.dueDate)}</td>
                <td>
                  <strong>{e.description}</strong>
                  {e.recurringMonthly && <span className="tag">todo mês</span>}
                </td>
                <td>{EXPENSE_CATEGORY_LABELS[e.category]}</td>
                <td>{e.kind === 'fixa' ? 'Fixa' : 'Variável'}</td>
                <td>{formatCurrency(e.amountCents)}</td>
                <td>
                  <button
                    type="button"
                    className={`sale-chip button ${e.paidAt ? 'paga' : e.overdue ? 'atrasada' : 'pendente'}`}
                    title={e.paidAt ? 'Clique para marcar como não paga' : 'Clique para marcar como paga'}
                    onClick={() => togglePaid(e)}
                  >
                    {e.paidAt ? `Paga em ${fmtDate(e.paidAt)}` : e.overdue ? 'Em atraso' : 'A pagar'}
                  </button>
                </td>
                <td className="row-actions">
                  <div className="row-actions-inner">
                    <button type="button" className="icon-btn" aria-label={`Editar ${e.description}`} title="Editar" onClick={() => setEditing(e)}>
                      <Icon name="edit" size={17} />
                    </button>
                    <button type="button" className="icon-btn danger" aria-label={`Remover ${e.description}`} title="Remover" onClick={() => remove(e)}>
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          {loaded && shown.length === 0 && (
            <tr>
              <td colSpan={7}>
                <div className="empty-state">
                  <Icon name="finance" size={34} />
                  <strong>Nenhuma despesa {filter === 'todas' ? 'neste mês' : 'nesta situação'}</strong>
                  <span>Use “Nova despesa” para lançar aluguel, salários, contas e compras.</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editing && (
        <ExpenseModal
          expense={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            toast.success('Despesa salva')
            load()
          }}
        />
      )}
    </div>
  )
}
