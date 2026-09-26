import { useEffect, useMemo, useState } from 'react'
import { centsToInput, parseMoneyInput } from '@shared/money'
import { discountCentsFrom, installmentFeeCents, cardFeePercent, suggestInstallments } from '@shared/finance'
import { PAYMENT_LABELS } from '@shared/types'
import type {
  CardFees,
  InstallmentInput,
  InventoryItemSummary,
  Patient,
  PaymentMethod,
  ProcedureType,
  Professional,
  SaleItemInput
} from '@shared/types'
import { formatCurrency } from '../utils/masks'
import { useEscapeKey } from '../utils/useEscapeKey'
import { useFeedback } from './Feedback'
import { Icon } from './Icons'

export interface ChargePrefill {
  patientId?: string
  professionalId?: string
  appointmentId?: string
  procedureTypeId?: string
}

interface Props {
  prefill?: ChargePrefill
  /** Texto do botão que fecha sem cobrar (ex.: "Agora não" depois de finalizar o atendimento). */
  closeLabel?: string
  onClose: () => void
  onSaved: () => void
}

const todayStr = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const METHODS = Object.keys(PAYMENT_LABELS) as PaymentMethod[]
// Débito, Pix e dinheiro entram de uma vez; as demais podem ser parceladas.
const CAN_SPLIT: PaymentMethod[] = ['cartao_credito', 'boleto', 'outro']
const NO_FEES: CardFees = { debitPercent: 0, creditPercent: 0, creditInstallmentPercent: 0 }

export function ChargeModal({ prefill, closeLabel = 'Cancelar', onClose, onSaved }: Props): JSX.Element {
  useEscapeKey(onClose)
  const { toast } = useFeedback()

  const [patients, setPatients] = useState<Patient[]>([])
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [inventory, setInventory] = useState<InventoryItemSummary[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [fees, setFees] = useState<CardFees>(NO_FEES)

  const [patientId, setPatientId] = useState(prefill?.patientId ?? '')
  const [professionalId, setProfessionalId] = useState(prefill?.professionalId ?? '')
  const [items, setItems] = useState<SaleItemInput[]>([])

  const [kind, setKind] = useState<'procedimento' | 'produto'>('procedimento')
  const [refId, setRefId] = useState('')
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')

  const [discountType, setDiscountType] = useState<'value' | 'percent'>('value')
  const [discountText, setDiscountText] = useState('')

  const [method, setMethod] = useState<PaymentMethod>('dinheiro')
  const [count, setCount] = useState(1)
  const [parcels, setParcels] = useState<InstallmentInput[]>([])
  const [manualParcels, setManualParcels] = useState(false)
  const [firstDue, setFirstDue] = useState(todayStr())

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      window.api.patients.list(),
      window.api.procedureTypes.list(),
      window.api.inventory.listItems(),
      window.api.professionals.list(),
      window.api.clinicSettings.get()
    ]).then(([p, pt, inv, pr, settings]) => {
      if (p.ok && p.data) setPatients(p.data)
      if (pt.ok && pt.data) {
        const active = pt.data.filter((x) => x.active)
        setProcedures(active)
        // Cobrança de um atendimento já vem com o procedimento e o preço padrão.
        const proc = prefill?.procedureTypeId ? active.find((x) => x.id === prefill.procedureTypeId) : undefined
        if (proc) {
          setItems([
            {
              kind: 'procedimento',
              description: proc.name,
              procedureTypeId: proc.id,
              quantity: 1,
              unitPriceCents: proc.defaultPriceCents
            }
          ])
        }
      }
      if (inv.ok && inv.data) setInventory(inv.data)
      if (pr.ok && pr.data) setProfessionals(pr.data.filter((x) => x.active))
      if (settings.ok && settings.data) setFees(settings.data.cardFees)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const grossCents = items.reduce((sum, i) => sum + Math.round(i.quantity * i.unitPriceCents), 0)
  const discountCents = useMemo(() => {
    const raw = discountText.trim()
    if (!raw) return 0
    return discountCentsFrom(grossCents, discountType, discountType === 'percent' ? Number(raw.replace(',', '.')) || 0 : parseMoneyInput(raw))
  }, [discountText, discountType, grossCents])
  const totalCents = grossCents - discountCents

  // Sempre que o total, o número de parcelas ou o 1º vencimento mudam, as parcelas são sugeridas de novo
  // (a menos que a pessoa já tenha editado alguma manualmente).
  useEffect(() => {
    if (manualParcels) return
    setParcels(suggestInstallments(totalCents, count, firstDue, false))
  }, [totalCents, count, firstDue, manualParcels])

  function chooseMethod(next: PaymentMethod): void {
    setMethod(next)
    if (!CAN_SPLIT.includes(next)) {
      setCount(1)
      setManualParcels(false)
    }
  }

  function handleSelectRef(id: string): void {
    setRefId(id)
    if (kind === 'procedimento') {
      const proc = procedures.find((p) => p.id === id)
      if (proc) setPrice(centsToInput(proc.defaultPriceCents))
    } else {
      const item = inventory.find((i) => i.id === id)
      if (item) setPrice(centsToInput(item.unitCostCents))
    }
  }

  function addItem(): void {
    if (!refId) return
    const quantity = Number(qty.replace(',', '.')) || 1
    const unitPriceCents = parseMoneyInput(price)
    if (kind === 'procedimento') {
      const proc = procedures.find((p) => p.id === refId)
      if (!proc) return
      setItems((prev) => [
        ...prev,
        { kind, description: proc.name, procedureTypeId: proc.id, quantity, unitPriceCents }
      ])
    } else {
      const item = inventory.find((i) => i.id === refId)
      if (!item) return
      setItems((prev) => [...prev, { kind, description: item.name, inventoryItemId: item.id, quantity, unitPriceCents }])
    }
    setRefId('')
    setQty('1')
    setPrice('')
  }

  function updateParcel(index: number, patch: Partial<InstallmentInput>): void {
    setManualParcels(true)
    setParcels((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  const parcelsSum = parcels.reduce((s, p) => s + p.amountCents, 0)
  const diff = totalCents - parcelsSum
  const feePercent = cardFeePercent(method, count, fees)
  const estimatedFee = parcels.reduce((s, p) => s + installmentFeeCents(p.amountCents, method, count, fees), 0)

  async function submit(payNow: boolean): Promise<void> {
    setError(null)
    if (!patientId) return setError('Selecione o paciente')
    if (items.length === 0) return setError('Adicione ao menos um item')
    if (totalCents <= 0) return setError('O valor a cobrar precisa ser maior que zero')
    if (diff !== 0) return setError('A soma das parcelas precisa ser igual ao total')

    // "Receber agora" recebe a 1ª parcela hoje (mesmo que o vencimento dela seja outro dia).
    const finalParcels = parcels.map((p, i) => ({ ...p, paid: payNow && i === 0 }))
    setSaving(true)
    const result = await window.api.sales.create({
      patientId,
      appointmentId: prefill?.appointmentId,
      professionalId: professionalId || undefined,
      items,
      discountCents,
      paymentMethod: method,
      installments: finalParcels
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? 'Não foi possível registrar a cobrança')
      return
    }
    toast.success(payNow ? 'Recebimento registrado' : 'Cobrança registrada — fica pendente')
    onSaved()
  }

  const locked = Boolean(prefill?.patientId)

  return (
    <div className="modal-overlay">
      <div className="card modal-card wide charge-modal" role="dialog" aria-modal="true" aria-labelledby="charge-title">
        <div className="modal-head">
          <h2 id="charge-title">{prefill?.appointmentId ? 'Cobrar atendimento' : 'Nova cobrança'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="form-row">
          <label>
            Paciente
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)} disabled={locked}>
              <option value="" disabled>
                Selecione...
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Profissional
            <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">— não informar —</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section className="modal-section">
          <h3>Itens</h3>
          {items.length > 0 && (
            <ul className="charge-items">
              {items.map((item, i) => (
                <li key={i} className="row-enter">
                  <span className="charge-item-name">
                    {item.description}
                    <small>
                      {item.quantity} × {formatCurrency(item.unitPriceCents)}
                    </small>
                  </span>
                  <strong>{formatCurrency(Math.round(item.quantity * item.unitPriceCents))}</strong>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label={`Remover ${item.description}`}
                    onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="add-item-row">
            <label>
              Tipo
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as 'procedimento' | 'produto')
                  setRefId('')
                  setPrice('')
                }}
              >
                <option value="procedimento">Procedimento</option>
                <option value="produto">Produto do estoque</option>
              </select>
            </label>
            <label className="grow">
              {kind === 'procedimento' ? 'Procedimento' : 'Produto'}
              <select value={refId} onChange={(e) => handleSelectRef(e.target.value)}>
                <option value="" disabled>
                  Selecione...
                </option>
                {kind === 'procedimento'
                  ? procedures.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  : inventory.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} (disponível: {i.currentQuantity})
                      </option>
                    ))}
              </select>
            </label>
            <label className="narrow">
              Qtd
              <input type="number" min="0.01" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
            <label className="narrow">
              Preço (R$)
              <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <button type="button" className="soft-btn" onClick={addItem} disabled={!refId}>
              Adicionar
            </button>
          </div>
        </section>

        <section className="modal-section">
          <h3>Desconto</h3>
          <div className="discount-row">
            <div className="period-picker" role="group" aria-label="Tipo de desconto">
              <button
                type="button"
                className={discountType === 'value' ? 'period-btn active' : 'period-btn'}
                onClick={() => setDiscountType('value')}
              >
                R$
              </button>
              <button
                type="button"
                className={discountType === 'percent' ? 'period-btn active' : 'period-btn'}
                onClick={() => setDiscountType('percent')}
              >
                %
              </button>
            </div>
            <input
              type="number"
              min="0"
              step={discountType === 'percent' ? '1' : '0.01'}
              aria-label="Valor do desconto"
              placeholder={discountType === 'percent' ? '0' : '0,00'}
              value={discountText}
              onChange={(e) => setDiscountText(e.target.value)}
            />
            {discountCents > 0 && <span className="muted">= {formatCurrency(discountCents)} de desconto</span>}
          </div>
        </section>

        <div className="charge-summary">
          <div>
            <span>Subtotal</span>
            <strong>{formatCurrency(grossCents)}</strong>
          </div>
          {discountCents > 0 && (
            <div>
              <span>Desconto</span>
              <strong>− {formatCurrency(discountCents)}</strong>
            </div>
          )}
          <div className="total">
            <span>Total a cobrar</span>
            <strong>{formatCurrency(totalCents)}</strong>
          </div>
        </div>

        <section className="modal-section">
          <h3>Pagamento</h3>
          <div className="form-row">
            <label>
              Forma de pagamento
              <select value={method} onChange={(e) => chooseMethod(e.target.value as PaymentMethod)}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Parcelas
              <select
                value={count}
                disabled={!CAN_SPLIT.includes(method)}
                onChange={(e) => {
                  setCount(Number(e.target.value))
                  setManualParcels(false)
                }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'À vista' : `${n}x`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {count > 1 ? '1º vencimento' : 'Vencimento'}
              <input
                type="date"
                value={firstDue}
                onChange={(e) => {
                  setFirstDue(e.target.value || todayStr())
                  setManualParcels(false)
                }}
              />
            </label>
          </div>

          {count > 1 && (
            <ul className="installment-list">
              {parcels.map((p, i) => (
                <li key={i}>
                  <span className="muted">
                    {i + 1}/{count}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label={`Valor da parcela ${i + 1}`}
                    value={centsToInput(p.amountCents)}
                    onChange={(e) => updateParcel(i, { amountCents: parseMoneyInput(e.target.value) })}
                  />
                  <input
                    type="date"
                    aria-label={`Vencimento da parcela ${i + 1}`}
                    value={p.dueDate}
                    onChange={(e) => e.target.value && updateParcel(i, { dueDate: e.target.value })}
                  />
                </li>
              ))}
            </ul>
          )}
          {count > 1 && (
            <p className="subtitle">
              Em "Receber agora", a 1ª parcela é recebida hoje e as demais ficam pendentes nos vencimentos acima.
            </p>
          )}
          {diff !== 0 && (
            <p className="error">
              {diff > 0 ? `Faltam ${formatCurrency(diff)}` : `Passou ${formatCurrency(-diff)}`} para fechar o total.
            </p>
          )}
          {feePercent > 0 && (
            <p className="subtitle">
              Taxa do cartão: {feePercent.toLocaleString('pt-BR')}% — estimativa {formatCurrency(estimatedFee)} (você
              recebe {formatCurrency(totalCents - estimatedFee)} líquidos).
            </p>
          )}
        </section>

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {closeLabel}
          </button>
          <button type="button" disabled={saving} onClick={() => submit(false)}>
            Cobrar depois
          </button>
          <button type="button" className="primary-action" disabled={saving} onClick={() => submit(true)}>
            {saving ? 'Salvando...' : 'Receber agora'}
          </button>
        </div>
      </div>
    </div>
  )
}
