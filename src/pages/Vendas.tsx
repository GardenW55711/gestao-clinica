import { useEffect, useMemo, useState } from 'react'
import { useFeedback } from '../components/Feedback'
import { RankingBars, SeriesChart } from '../components/Charts'
import { formatCurrency } from '../utils/masks'
import type {
  FinancialSeriesPoint,
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

type PeriodMode = 'today' | '7d' | 'month' | 'custom'
type Granularity = 'day' | 'month'

const PERIOD_LABELS: Record<Exclude<PeriodMode, 'custom'>, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  month: 'Este mês'
}

function presetRange(preset: Exclude<PeriodMode, 'custom'>): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const from =
    preset === 'today'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : preset === '7d'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
        : new Date(now.getFullYear(), now.getMonth(), 1)
  return { from, to }
}

function parseInputDate(value: string, endOfDay: boolean): Date {
  const [y, m, d] = value.split('-').map(Number)
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d)
}

export function Vendas(): JSX.Element {
  const { toast } = useFeedback()
  const [patients, setPatients] = useState<Patient[]>([])
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItemSummary[]>([])
  const [sales, setSales] = useState<Sale[]>([])

  const [mode, setMode] = useState<PeriodMode>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [series, setSeries] = useState<FinancialSeriesPoint[]>([])

  const [patientId, setPatientId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro')
  const [items, setItems] = useState<SaleItemInput[]>([])

  const [kind, setKind] = useState<'procedimento' | 'produto'>('procedimento')
  const [selectedRefId, setSelectedRefId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('0')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const customInvalid = mode === 'custom' && customFrom !== '' && customTo !== '' && customFrom > customTo
  const customIncomplete = mode === 'custom' && (customFrom === '' || customTo === '')

  const range = useMemo(() => {
    if (mode !== 'custom') return presetRange(mode)
    if (customFrom === '' || customTo === '' || customFrom > customTo) return null
    return { from: parseInputDate(customFrom, false), to: parseInputDate(customTo, true) }
  }, [mode, customFrom, customTo])

  const rangeKey = range ? `${range.from.toISOString()}|${range.to.toISOString()}` : null

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

  async function loadFinancial(): Promise<void> {
    if (!range) return
    const from = range.from.toISOString()
    const to = range.to.toISOString()
    const [sum, ser] = await Promise.all([
      window.api.sales.financialSummary(from, to),
      window.api.sales.financialSeries(from, to, granularity)
    ])
    if (sum.ok && sum.data) setSummary(sum.data)
    if (ser.ok && ser.data) setSeries(ser.data)
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    loadFinancial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, granularity])

  function choosePreset(preset: Exclude<PeriodMode, 'custom'>): void {
    setMode(preset)
    setCustomFrom('')
    setCustomTo('')
  }

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
    loadFinancial()
  }

  const totalAmount = summary?.totalAmount ?? 0
  const salesCount = summary?.salesCount ?? 0
  const ticket = salesCount > 0 ? totalAmount / salesCount : 0

  return (
    <div>
      <h1>Financeiro</h1>
      <p className="subtitle">Controle de faturamento da clínica — cobranças por procedimento e produto.</p>

      <div className="filter-bar card">
        <div className="period-picker" role="group" aria-label="Período">
          {(Object.keys(PERIOD_LABELS) as Exclude<PeriodMode, 'custom'>[]).map((p) => (
            <button
              key={p}
              type="button"
              className={p === mode ? 'period-btn active' : 'period-btn'}
              onClick={() => choosePreset(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        <div className={mode === 'custom' ? 'date-range active' : 'date-range'}>
          <label>
            De
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => {
                setCustomFrom(e.target.value)
                setMode('custom')
              }}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => {
                setCustomTo(e.target.value)
                setMode('custom')
              }}
            />
          </label>
        </div>

        {customInvalid && <span className="error">A data inicial não pode ser depois da final.</span>}
        {customIncomplete && !customInvalid && <span className="filter-hint">Informe as duas datas.</span>}
      </div>

      <div className="tiles kpis">
        <div className="tile static">
          <span className="tile-label">Faturamento</span>
          <span className="tile-value">{formatCurrency(totalAmount)}</span>
          <span className="tile-hint">no período selecionado</span>
        </div>
        <div className="tile static">
          <span className="tile-label">Vendas</span>
          <span className="tile-value">{salesCount}</span>
          <span className="tile-hint">cobranças registradas</span>
        </div>
        <div className="tile static">
          <span className="tile-label">Ticket médio</span>
          <span className="tile-value">{formatCurrency(ticket)}</span>
          <span className="tile-hint">por venda</span>
        </div>
      </div>

      <div className="card chart-card">
        <div className="chart-head">
          <h3>Vendas por período</h3>
          <div className="period-picker" role="group" aria-label="Agrupar por">
            <button
              type="button"
              className={granularity === 'day' ? 'period-btn active' : 'period-btn'}
              onClick={() => setGranularity('day')}
            >
              Dia
            </button>
            <button
              type="button"
              className={granularity === 'month' ? 'period-btn active' : 'period-btn'}
              onClick={() => setGranularity('month')}
            >
              Mês
            </button>
          </div>
        </div>
        <SeriesChart points={series} granularity={granularity} />
      </div>

      <div className="financial-breakdown">
        <div className="card chart-card">
          <h3>Vendas por procedimento</h3>
          <RankingBars
            rows={(summary?.byProcedureType ?? []).map((r) => ({ label: r.name, total: r.total }))}
            emptyText="Sem procedimentos cobrados no período."
          />
        </div>
        <div className="card chart-card">
          <h3>Formas de pagamento</h3>
          <RankingBars
            rows={(summary?.byPaymentMethod ?? []).map((r) => ({ label: PAYMENT_LABELS[r.paymentMethod], total: r.total }))}
            emptyText="Sem vendas no período."
          />
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
