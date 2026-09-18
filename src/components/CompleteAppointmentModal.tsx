import { useEffect, useMemo, useState } from 'react'
import { useEscapeKey } from '../utils/useEscapeKey'
import { Icon } from './Icons'
import { ItemPicker } from './ItemPicker'
import type { Appointment, InventoryItemSummary, ProcedureType, StockUsageItem } from '@shared/types'

interface Props {
  appointment: Appointment
  procedure: ProcedureType | undefined
  onCancel: () => void
  onConfirm: (usedItems: StockUsageItem[]) => Promise<void>
}

interface Line {
  itemId: string
  name: string
  unit: string
  planned: number | null // null = item extra, fora do previsto
}

export function CompleteAppointmentModal({ appointment, procedure, onCancel, onConfirm }: Props): JSX.Element {
  useEscapeKey(onCancel)

  const planned = procedure?.items ?? []
  const hasPlanned = planned.length > 0

  const [inventory, setInventory] = useState<InventoryItemSummary[]>([])
  const [exceeded, setExceeded] = useState(false)
  const [lines, setLines] = useState<Line[]>(
    planned.map((i) => ({ itemId: i.inventoryItemId, name: i.itemName, unit: i.unit, planned: i.defaultQuantity }))
  )
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(planned.map((i) => [i.inventoryItemId, String(i.defaultQuantity)]))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.inventory.listItems().then((r) => r.ok && r.data && setInventory(r.data))
  }, [])

  const available = useMemo(() => new Map(inventory.map((i) => [i.id, i.currentQuantity])), [inventory])
  const canEdit = exceeded || !hasPlanned

  function quantityOf(line: Line): number {
    if (!canEdit && line.planned !== null) return line.planned
    return Number(quantities[line.itemId]) || 0
  }

  function setExceededChoice(value: boolean): void {
    setExceeded(value)
    if (!value) {
      // volta ao previsto e descarta itens extras
      setLines((prev) => prev.filter((l) => l.planned !== null))
      setQuantities(Object.fromEntries(planned.map((i) => [i.inventoryItemId, String(i.defaultQuantity)])))
    }
  }

  function addExtra(item: InventoryItemSummary): void {
    setLines((prev) => [...prev, { itemId: item.id, name: item.name, unit: item.unit, planned: null }])
    setQuantities((prev) => ({ ...prev, [item.id]: '1' }))
  }

  const shortages = lines.filter((l) => available.size > 0 && quantityOf(l) > (available.get(l.itemId) ?? 0))

  async function handleConfirm(): Promise<void> {
    setError(null)
    const used: StockUsageItem[] = lines
      .map((l) => ({ itemId: l.itemId, quantity: quantityOf(l) }))
      .filter((u) => u.quantity > 0)

    setSaving(true)
    try {
      await onConfirm(used)
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="card modal-card wide" role="dialog" aria-modal="true" aria-labelledby="complete-title">
        <div className="modal-head">
          <div>
            <h2 id="complete-title">Finalizar atendimento</h2>
            <p className="subtitle tight">
              {appointment.patientName} · {appointment.procedureTypeName}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>

        {hasPlanned ? (
          <>
            <h3>Produtos deste procedimento</h3>
            <p className="subtitle">Estes itens serão descontados do estoque ao finalizar.</p>
          </>
        ) : (
          <p className="subtitle">
            Este procedimento não tem produtos cadastrados. Se algum material foi usado, adicione abaixo (opcional).
          </p>
        )}

        {lines.length > 0 && (
          <ul className="used-list">
            {lines.map((line) => {
              const qty = quantityOf(line)
              const stock = available.get(line.itemId)
              const short = stock !== undefined && qty > stock
              const over = line.planned !== null && qty > line.planned
              return (
                <li key={line.itemId} className={short ? 'used-row short row-enter' : 'used-row row-enter'}>
                  <span className="used-name">
                    {line.name}
                    <small>
                      {line.planned !== null ? `previsto: ${line.planned} ${line.unit}` : 'item extra'}
                      {stock !== undefined && ` · em estoque: ${stock} ${line.unit}`}
                    </small>
                  </span>
                  {canEdit ? (
                    <label className="qty-field">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={quantities[line.itemId] ?? ''}
                        aria-label={`Quantidade usada de ${line.name}`}
                        onChange={(e) => setQuantities((prev) => ({ ...prev, [line.itemId]: e.target.value }))}
                      />
                      <span>{line.unit}</span>
                    </label>
                  ) : (
                    <span className="qty-static">
                      {qty} {line.unit}
                    </span>
                  )}
                  {over && <span className="tag warn">+{+(qty - (line.planned ?? 0)).toFixed(2)} acima</span>}
                  {line.planned === null && (
                    <button
                      type="button"
                      className="icon-btn danger"
                      aria-label={`Remover ${line.name}`}
                      onClick={() => setLines((prev) => prev.filter((l) => l.itemId !== line.itemId))}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {hasPlanned && (
          <div className="question">
            <span>Algum item excedeu o uso previsto?</span>
            <div className="period-picker" role="group" aria-label="Algum item excedeu o uso previsto?">
              <button
                type="button"
                className={!exceeded ? 'period-btn active' : 'period-btn'}
                onClick={() => setExceededChoice(false)}
              >
                Não
              </button>
              <button
                type="button"
                className={exceeded ? 'period-btn active' : 'period-btn'}
                onClick={() => setExceededChoice(true)}
              >
                Sim
              </button>
            </div>
          </div>
        )}

        {canEdit && (
          <div className="extra-picker">
            <span className="subtitle tight">{hasPlanned ? 'Usou algum outro item?' : 'Adicionar material usado'}</span>
            <ItemPicker items={inventory} excludeIds={lines.map((l) => l.itemId)} onPick={addExtra} />
          </div>
        )}

        {shortages.length > 0 && (
          <p className="error">
            Estoque insuficiente de: {shortages.map((s) => s.name).join(', ')}. Ajuste a quantidade ou registre uma
            entrada no estoque.
          </p>
        )}
        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="primary-action" onClick={handleConfirm} disabled={saving || shortages.length > 0}>
            {saving ? 'Finalizando...' : 'Finalizar e dar baixa'}
          </button>
        </div>
      </div>
    </div>
  )
}
