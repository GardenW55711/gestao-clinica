import { useEffect, useState } from 'react'
import { useFeedback } from '../components/Feedback'
import { formatCurrency } from '../utils/masks'
import type {
  FinancialSummary,
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

type PeriodPreset = 'today' | '7d' | 'month'

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  month: 'Este mês'
}

function getRange(preset: PeriodPreset): { from: string; to: string } {
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  let from: Date
  if (preset === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  } else if (preset === '7d') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0)
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  }
  return { from: from.toISOString(), to: to.toISOString() }
}

export function Vendas(): JSX.Element {
  const { toast } = useFeedback()
  const [patients, setPatients] = useState<Patient[]>([])
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItemSummary[]>([])
  const [sales, setSales] = useState<Sale[]>([])

  const [period, setPeriod] = useState<PeriodPreset>('month')
  const [summary, setSummary] = useState<FinancialSummary | null>(null)

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

  async function loadSummary(): Promise<void> {
    const { from, to } = getRange(period)
    const result = await window.api.sales.financialSummary(from, to)
    if (result.ok && result.data) setSummary(result.data)
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    loadSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

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
    toast.success('Venda registrada')
    loadAll()
    loadSummary()
  }

  return (
    <div>
      <h1>Financeiro</h1>
      <p className="subtitle">Controle de faturamento da clínica — cobranças por procedimento e produto.</p>

      <div className="card financial-panel">
        <div className="period-picker">
          {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((p) => (
            <button
              key={p}
              type="button"
              className={p === period ? 'period-btn active' : 'period-btn'}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        <p className="sale-total">Faturamento no período: {formatCurrency(summary?.totalAmount ?? 0)}</p>

        <div className="financial-breakdown">
          <div>
            <h3>Por forma de pagamento</h3>
            <table className="data-table">
              <tbody>
                {(summary?.byPaymentMethod ?? []).map((row) => (
                  <tr key={row.paymentMethod}>
                    <td>{PAYMENT_LABELS[row.paymentMethod]}</td>
                    <td>{formatCurrency(row.total)}</td>
                  </tr>
                ))}
                {(!summary || summary.byPaymentMethod.length === 0) && (
                  <tr>
                    <td colSpan={2} className="empty-row">
                      Sem vendas no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div>
            <h3>Por tipo de procedimento</h3>
            <table className="data-table">
              <tbody>
                {(summary?.byProcedureType ?? []).map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{formatCurrency(row.total)}</td>
                  </tr>
                ))}
                {(!summary || summary.byProcedureType.length === 0) && (
                  <tr>
                    <td colSpan={2} className="empty-row">
                      Sem procedimentos cobrados no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2>Registrar cobrança</h2>
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
                <td>{formatCurrency(item.unitPrice)}</td>
                <td>{formatCurrency(item.quantity * item.unitPrice)}</td>
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

        <p className="sale-total">Total: {formatCurrency(total)}</p>

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
              <td>{formatCurrency(sale.totalAmount)}</td>
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
