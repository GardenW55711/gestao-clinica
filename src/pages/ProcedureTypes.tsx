import { useEffect, useState } from 'react'
import { useFeedback } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { ProcedureFormModal } from '../components/ProcedureFormModal'
import { formatCurrency } from '../utils/masks'
import type { InventoryItemSummary, ProcedureType } from '@shared/types'

export function ProcedureTypes(): JSX.Element {
  const { toast, confirm } = useFeedback()
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [inventory, setInventory] = useState<InventoryItemSummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState<ProcedureType | 'new' | null>(null)

  async function load(): Promise<void> {
    const [p, inv] = await Promise.all([window.api.procedureTypes.list(), window.api.inventory.listItems()])
    if (p.ok && p.data) setProcedures(p.data)
    if (inv.ok && inv.data) setInventory(inv.data)
    setLoaded(true)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleRemove(procedure: ProcedureType): Promise<void> {
    const ok = await confirm({
      title: `Remover "${procedure.name}"?`,
      message: 'Ele deixa de aparecer para novos agendamentos. Agendamentos e vendas antigos continuam registrados.',
      confirmLabel: 'Remover',
      danger: true
    })
    if (!ok) return
    await window.api.procedureTypes.remove(procedure.id)
    toast.info('Procedimento removido')
    load()
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Tipos de procedimento</h1>
          <p className="subtitle">
            A duração bloqueia o horário na agenda e os produtos cadastrados são descontados do estoque ao finalizar o
            atendimento.
          </p>
        </div>
        <button type="button" className="with-icon" onClick={() => setEditing('new')}>
          <Icon name="plus" size={18} />
          Novo procedimento
        </button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Duração</th>
            <th>Preço padrão</th>
            <th>Produtos utilizados</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {!loaded &&
            [0, 1, 2].map((i) => (
              <tr key={`sk-${i}`}>
                <td colSpan={5}>
                  <div className="skeleton" />
                </td>
              </tr>
            ))}
          {loaded &&
            procedures.map((p) => (
              <tr key={p.id} className="row-enter clickable" onDoubleClick={() => setEditing(p)}>
                <td>
                  <strong>{p.name}</strong>
                  {p.requiresRoom && <span className="tag">usa sala</span>}
                </td>
                <td>{p.durationMinutes} min</td>
                <td>{formatCurrency(p.defaultPrice)}</td>
                <td>
                  {p.items.length === 0 ? (
                    <span className="muted">—</span>
                  ) : (
                    <span className="chips">
                      {p.items.slice(0, 3).map((i) => (
                        <span key={i.inventoryItemId} className="chip" title={`${i.defaultQuantity} ${i.unit}`}>
                          {i.itemName} · {i.defaultQuantity} {i.unit}
                        </span>
                      ))}
                      {p.items.length > 3 && (
                        <span
                          className="chip more"
                          title={p.items
                            .slice(3)
                            .map((i) => `${i.itemName}: ${i.defaultQuantity} ${i.unit}`)
                            .join('\n')}
                        >
                          +{p.items.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td className="row-actions">
                  <div className="row-actions-inner">
                    <button type="button" className="icon-btn" aria-label={`Editar ${p.name}`} title="Editar" onClick={() => setEditing(p)}>
                      <Icon name="edit" size={17} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      aria-label={`Remover ${p.name}`}
                      title="Remover"
                      onClick={() => handleRemove(p)}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          {loaded && procedures.length === 0 && (
            <tr>
              <td colSpan={5}>
                <div className="empty-state">
                  <Icon name="procedure" size={34} />
                  <strong>Nenhum procedimento cadastrado</strong>
                  <span>Clique em “Novo procedimento” para criar o primeiro.</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editing && (
        <ProcedureFormModal
          procedure={editing === 'new' ? null : editing}
          inventory={inventory}
          onClose={() => setEditing(null)}
          onSaved={(isNew) => {
            setEditing(null)
            toast.success(isNew ? 'Procedimento cadastrado' : 'Alterações salvas')
            load()
          }}
        />
      )}
    </div>
  )
}
