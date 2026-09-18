import { useEffect, useState } from 'react'
import type { InventoryItemSummary, StockUsageItem } from '@shared/types'

interface Props {
  onCancel: () => void
  onConfirm: (usedItems: StockUsageItem[]) => Promise<void>
}

export function CompleteAppointmentModal({ onCancel, onConfirm }: Props): JSX.Element {
  const [items, setItems] = useState<InventoryItemSummary[]>([])
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.inventory.listItems().then((r) => r.ok && r.data && setItems(r.data))
  }, [])

  async function handleConfirm(): Promise<void> {
    setError(null)
    const usedItems: StockUsageItem[] = Object.entries(quantities)
      .map(([itemId, qty]) => ({ itemId, quantity: Number(qty) }))
      .filter((item) => item.quantity > 0)

    setLoading(true)
    try {
      await onConfirm(usedItems)
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Finalizar atendimento</h2>
        <p className="subtitle">Se algum material foi usado, informe a quantidade (opcional — pode deixar em branco).</p>

        {items.length === 0 ? (
          <p className="subtitle">Nenhum item de estoque cadastrado.</p>
        ) : (
          items.map((item) => (
            <label key={item.id}>
              {item.name} (disponível: {item.currentQuantity} {item.unit})
              <input
                type="number"
                min="0"
                max={item.currentQuantity}
                value={quantities[item.id] ?? ''}
                onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
              />
            </label>
          ))
        )}

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Salvando...' : 'Confirmar e finalizar'}
          </button>
        </div>
      </div>
    </div>
  )
}
