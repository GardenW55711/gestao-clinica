import { FormEvent, useState } from 'react'
import type { InventoryItemSummary, ProcedureType } from '@shared/types'
import { useEscapeKey } from '../utils/useEscapeKey'
import { Icon } from './Icons'
import { ItemPicker } from './ItemPicker'

interface Row {
  inventoryItemId: string
  name: string
  unit: string
  quantity: string
}

interface Props {
  procedure: ProcedureType | null
  inventory: InventoryItemSummary[]
  onClose: () => void
  onSaved: (isNew: boolean) => void
}

export function ProcedureFormModal({ procedure, inventory, onClose, onSaved }: Props): JSX.Element {
  useEscapeKey(onClose)
  const [name, setName] = useState(procedure?.name ?? '')
  const [duration, setDuration] = useState(String(procedure?.durationMinutes ?? 30))
  const [price, setPrice] = useState(String(procedure?.defaultPrice ?? 0))
  const [requiresRoom, setRequiresRoom] = useState(procedure?.requiresRoom ?? false)
  const [rows, setRows] = useState<Row[]>(
    (procedure?.items ?? []).map((i) => ({
      inventoryItemId: i.inventoryItemId,
      name: i.itemName,
      unit: i.unit,
      quantity: String(i.defaultQuantity)
    }))
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function addItem(item: InventoryItemSummary): void {
    setRows((prev) => [...prev, { inventoryItemId: item.id, name: item.name, unit: item.unit, quantity: '1' }])
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)

    const items = rows.map((r) => ({ inventoryItemId: r.inventoryItemId, defaultQuantity: Number(r.quantity) }))
    if (items.some((i) => !(i.defaultQuantity > 0))) {
      setError('Informe a quantidade padrão de cada produto (maior que zero)')
      return
    }

    const input = {
      name: name.trim(),
      durationMinutes: Number(duration),
      defaultPrice: Number(price) || 0,
      requiresRoom,
      items
    }

    setSaving(true)
    const result = procedure
      ? await window.api.procedureTypes.update(procedure.id, input)
      : await window.api.procedureTypes.create(input)
    setSaving(false)

    if (!result.ok) {
      setError(result.error ?? 'Não foi possível salvar')
      return
    }
    onSaved(!procedure)
  }

  return (
    <div className="modal-overlay">
      <form
        className="card modal-card wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="proc-title"
        onSubmit={handleSubmit}
      >
        <div className="modal-head">
          <h2 id="proc-title">{procedure ? 'Editar procedimento' : 'Novo procedimento'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>

        <label>
          Nome
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" />
        </label>

        <div className="form-row">
          <label>
            Duração (min)
            <input
              type="number"
              min="5"
              step="5"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
          </label>
          <label>
            Preço padrão (R$)
            <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
        </div>

        <label className="switch-row compact">
          <input type="checkbox" checked={requiresRoom} onChange={(e) => setRequiresRoom(e.target.checked)} />
          Precisa de sala
        </label>

        <section className="modal-section">
          <h3>Produtos utilizados</h3>
          <p className="subtitle">
            Serão descontados do estoque quando o atendimento for finalizado na agenda. Defina a quantidade padrão de
            cada um.
          </p>

          <ItemPicker items={inventory} excludeIds={rows.map((r) => r.inventoryItemId)} onPick={addItem} />

          <ul className="used-list">
            {rows.map((row) => (
              <li key={row.inventoryItemId} className="used-row row-enter">
                <span className="used-name">{row.name}</span>
                <label className="qty-field">
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={row.quantity}
                    aria-label={`Quantidade padrão de ${row.name}`}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.inventoryItemId === row.inventoryItemId ? { ...r, quantity: e.target.value } : r))
                      )
                    }
                  />
                  <span>{row.unit}</span>
                </label>
                <button
                  type="button"
                  className="icon-btn danger"
                  aria-label={`Remover ${row.name}`}
                  onClick={() => setRows((prev) => prev.filter((r) => r.inventoryItemId !== row.inventoryItemId))}
                >
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
            {rows.length === 0 && <li className="used-empty">Nenhum produto adicionado — este procedimento não desconta estoque.</li>}
          </ul>
        </section>

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : procedure ? 'Salvar alterações' : 'Cadastrar procedimento'}
          </button>
        </div>
      </form>
    </div>
  )
}
