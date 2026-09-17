import { useEffect, useState } from 'react'
import type {
  InventoryItemSummary,
  Patient,
  PaymentMethod,
  ProcedureType,
  Sale,
  SaleItemInput
} from '@shared/types'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'Pix',
  outro: 'Outro'
}

export function Vendas(): JSX.Element {
  const [patients, setPatients] = useState<Patient[]>([])
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItemSummary[]>([])
  const [sales, setSales] = useState<Sale[]>([])

  const [patientId, setPatientId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro')
  const [items, setItems] = useState<SaleItemInput[]>([])

  const [kind, setKind] = useState<'procedimento' | 'produto'>('procedimento')
  const [selectedRefId, setSelectedRefId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('0')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function loadAll(): Promise<void> {
    const [p, pt, inv, s] = await Promise.all([
      window.api.patients.list(),
      window.api.procedureTypes.list(),
      window.api.inventory.listItems(),
      window.api.sales.list()
    ])
    if (p.ok && p.data) setPatients(p.data)
    if (pt.ok && pt.data) setProcedureTypes(pt.data.filter((x) => x.active))
    if (inv.ok && inv.data) setInventoryItems(inv.data)
    if (s.ok && s.data) setSales(s.data)
  }

  useEffect(() => {
    loadAll()
  }, [])

  function handleSelectRef(id: string): void {
    setSelectedRefId(id)
    if (kind === 'procedimento') {
      const proc = procedureTypes.find((p) => p.id === id)
      if (proc) setUnitPrice(String(proc.defaultPrice))
    } else {
      const item = inventoryItems.find((i) => i.id === id)
      if (item) setUnitPrice(String(item.unitCost))
    }
  }

  function handleAddItem(): void {
    if (!selectedRefId) return
    const qty = Number(quantity) || 1
    const price = Number(unitPrice) || 0

    if (kind === 'procedimento') {
      const proc = procedureTypes.find((p) => p.id === selectedRefId)
      if (!proc) return
      setItems((prev) => [
        ...prev,
        { kind: 'procedimento', description: proc.name, procedureTypeId: proc.id, quantity: qty, unitPrice: price }
      ])
    } else {
      const item = inventoryItems.find((i) => i.id === selectedRefId)
      if (!item) return
      setItems((prev) => [
        ...prev,
        { kind: 'produto', description: item.name, inventoryItemId: item.id, quantity: qty, unitPrice: price }
      ])
    }

    setSelectedRefId('')
    setQuantity('1')
    setUnitPrice('0')
  }

  function handleRemoveItem(index: number): void {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

  async function handleSubmit(): Promise<void> {
    setError(null)
    if (!patientId) {
      setError('Selecione o paciente')
      return
    }
    if (items.length === 0) {
      setError('Adicione ao menos um item')
      return
    }
    setLoading(true)
    const result = await window.api.sales.create({ patientId, paymentMethod, items })
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? 'Não foi possível registrar a venda')
      return
    }
    setItems([])
    setPatientId('')
    loadAll()
  }

  return (
    <div>
      <h1>Vendas</h1>

      <div className="card sale-form">
        <label>
          Paciente
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
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

        <h3>Itens</h3>
        <div className="inline-form">
          <label>
            Tipo
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as 'procedimento' | 'produto')
                setSelectedRefId('')
                setUnitPrice('0')
              }}
            >
              <option value="procedimento">Procedimento</option>
              <option value="produto">Produto do estoque</option>
            </select>
          </label>

          <label>
            {kind === 'procedimento' ? 'Procedimento' : 'Produto'}
            <select value={selectedRefId} onChange={(e) => handleSelectRef(e.target.value)}>
              <option value="" disabled>
                Selecione...
              </option>
              {kind === 'procedimento'
                ? procedureTypes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                : inventoryItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (disponível: {i.currentQuantity})
                    </option>
                  ))}
            </select>
          </label>

          <label>
            Quantidade
            <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>

          <label>
            Preço unitário (R$)
            <input type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          </label>

          <button type="button" onClick={handleAddItem} disabled={!selectedRefId}>
            Adicionar item
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Qtd</th>
              <th>Preço unit.</th>
              <th>Subtotal</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>R$ {item.unitPrice.toFixed(2)}</td>
                <td>R$ {(item.quantity * item.unitPrice).toFixed(2)}</td>
                <td>
                  <button type="button" className="link-button" onClick={() => handleRemoveItem(i)}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  Nenhum item adicionado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="sale-total">Total: R$ {total.toFixed(2)}</p>

        <label>
          Forma de pagamento
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
            {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="error">{error}</p>}

        <button type="button" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Registrando...' : 'Registrar venda'}
        </button>
      </div>

      <h2>Últimas vendas</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Paciente</th>
            <th>Itens</th>
            <th>Total</th>
            <th>Pagamento</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id}>
              <td>{new Date(sale.createdAt).toLocaleString('pt-BR')}</td>
              <td>{sale.patientName}</td>
              <td>{sale.items.map((i) => i.description).join(', ')}</td>
              <td>R$ {sale.totalAmount.toFixed(2)}</td>
              <td>{PAYMENT_LABELS[sale.paymentMethod]}</td>
            </tr>
          ))}
          {sales.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-row">
                Nenhuma venda registrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
