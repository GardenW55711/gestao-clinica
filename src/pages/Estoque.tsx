import { FormEvent, useEffect, useState } from 'react'
import { useFeedback } from '../components/Feedback'
import type { InventoryBatchAlert, InventoryItemInput, InventoryItemSummary } from '@shared/types'

const emptyItemInput: InventoryItemInput = { name: '', category: '', unit: 'unidade', minQuantity: 0, unitCost: 0 }

export function Estoque(): JSX.Element {
  const { toast } = useFeedback()
  const [items, setItems] = useState<InventoryItemSummary[]>([])
  const [alerts, setAlerts] = useState<InventoryBatchAlert[]>([])
  const [itemForm, setItemForm] = useState<InventoryItemInput>(emptyItemInput)
  const [itemError, setItemError] = useState<string | null>(null)

  const [moveItemId, setMoveItemId] = useState('')
  const [moveQuantity, setMoveQuantity] = useState('')
  const [moveExpiry, setMoveExpiry] = useState('')
  const [moveReason, setMoveReason] = useState('')
  const [moveError, setMoveError] = useState<string | null>(null)
  const [moveLoading, setMoveLoading] = useState(false)

  async function loadItems(): Promise<void> {
    const result = await window.api.inventory.listItems()
    if (result.ok && result.data) setItems(result.data)
  }

  async function loadAlerts(): Promise<void> {
    const result = await window.api.inventory.expiringSoon()
    if (result.ok && result.data) setAlerts(result.data)
  }

  useEffect(() => {
    loadItems()
    loadAlerts()
  }, [])

  async function handleCreateItem(e: FormEvent): Promise<void> {
    e.preventDefault()
    setItemError(null)
    const result = await window.api.inventory.createItem(itemForm)
    if (!result.ok) {
      setItemError(result.error ?? 'Não foi possível salvar')
      return
    }
    setItemForm(emptyItemInput)
    toast.success('Item cadastrado')
    loadItems()
  }

  async function handleEntry(): Promise<void> {
    setMoveError(null)
    setMoveLoading(true)
    const result = await window.api.inventory.addEntry({
      itemId: moveItemId,
      quantity: Number(moveQuantity),
      expiryDate: moveExpiry || undefined
    })
    setMoveLoading(false)
    if (!result.ok) {
      setMoveError(result.error ?? 'Não foi possível registrar a entrada')
      return
    }
    setMoveQuantity('')
    setMoveExpiry('')
    toast.success('Entrada registrada')
    loadItems()
    loadAlerts()
  }

  async function handleExit(): Promise<void> {
    setMoveError(null)
    setMoveLoading(true)
    const result = await window.api.inventory.addExit({
      itemId: moveItemId,
      quantity: Number(moveQuantity),
      reason: moveReason || undefined
    })
    setMoveLoading(false)
    if (!result.ok) {
      setMoveError(result.error ?? 'Não foi possível registrar a saída')
      return
    }
    setMoveQuantity('')
    setMoveReason('')
    toast.success('Saída registrada')
    loadItems()
    loadAlerts()
  }

  return (
    <div>
      <h1>Estoque</h1>

      {alerts.length > 0 && (
        <div className="alert-box">
          <strong>Atenção com a validade:</strong>
          <ul>
            {alerts.map((a, i) => (
              <li key={i}>
                {a.itemName} — {a.quantity} {a.batchCode ? `(lote ${a.batchCode})` : ''} —{' '}
                {a.status === 'expired' ? 'VENCIDO em' : 'vence em'} {a.expiryDate}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2>Itens</h2>
      <form className="inline-form" onSubmit={handleCreateItem}>
        <label>
          Nome
          <input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required />
        </label>
        <label>
          Categoria
          <input value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} />
        </label>
        <label>
          Unidade
          <input value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} required />
        </label>
        <label>
          Estoque mínimo
          <input
            type="number"
            value={itemForm.minQuantity}
            onChange={(e) => setItemForm({ ...itemForm, minQuantity: Number(e.target.value) })}
          />
        </label>
        <label>
          Custo unitário (R$)
          <input
            type="number"
            value={itemForm.unitCost}
            onChange={(e) => setItemForm({ ...itemForm, unitCost: Number(e.target.value) })}
          />
        </label>
        <button type="submit">Adicionar item</button>
      </form>
      {itemError && <p className="error">{itemError}</p>}

      <table className="data-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Quantidade atual</th>
            <th>Mínimo</th>
            <th>Próxima validade</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={item.currentQuantity < item.minQuantity ? 'row-warning' : ''}>
              <td>{item.name}</td>
              <td>{item.category}</td>
              <td>
                {item.currentQuantity} {item.unit}
                {item.currentQuantity < item.minQuantity && <span className="badge-low"> baixo</span>}
              </td>
              <td>{item.minQuantity}</td>
              <td>{item.nextExpiry ?? '-'}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-row">
                Nenhum item cadastrado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Movimentar estoque</h2>
      <div className="inline-form">
        <label>
          Item
          <select value={moveItemId} onChange={(e) => setMoveItemId(e.target.value)}>
            <option value="" disabled>
              Selecione...
            </option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantidade
          <input type="number" min="0" value={moveQuantity} onChange={(e) => setMoveQuantity(e.target.value)} />
        </label>
        <label>
          Validade (só para entrada)
          <input type="date" value={moveExpiry} onChange={(e) => setMoveExpiry(e.target.value)} />
        </label>
        <label>
          Motivo (só para saída)
          <input value={moveReason} onChange={(e) => setMoveReason(e.target.value)} />
        </label>
        <button type="button" disabled={!moveItemId || !moveQuantity || moveLoading} onClick={handleEntry}>
          Registrar entrada
        </button>
        <button type="button" disabled={!moveItemId || !moveQuantity || moveLoading} onClick={handleExit}>
          Registrar saída
        </button>
      </div>
      {moveError && <p className="error">{moveError}</p>}
    </div>
  )
}
