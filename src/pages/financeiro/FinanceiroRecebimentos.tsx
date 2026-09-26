import { Fragment, useCallback, useEffect, useState } from 'react'
import { PAYMENT_LABELS } from '@shared/types'
import type { Installment, PaymentMethod, Sale, SaleFilter } from '@shared/types'
import { ChargeModal } from '../../components/ChargeModal'
import { useFeedback } from '../../components/Feedback'
import { Icon } from '../../components/Icons'
import { useClinic } from '../../context/ClinicContext'
import { formatCurrency } from '../../utils/masks'
import { useEscapeKey } from '../../utils/useEscapeKey'

type Tab = 'todas' | 'pendente' | 'atrasada' | 'parcial' | 'paga' | 'cancelada'

const TABS: { key: Tab; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'atrasada', label: 'Em atraso' },
  { key: 'parcial', label: 'Parciais' },
  { key: 'paga', label: 'Pagas' },
  { key: 'cancelada', label: 'Canceladas' }
]

const STATUS_LABEL = { pendente: 'Pendente', parcial: 'Parcial', paga: 'Paga', cancelada: 'Cancelada' } as const

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function ReceiveModal({
  parcel,
  defaultMethod,
  onClose,
  onDone
}: {
  parcel: Installment
  defaultMethod: PaymentMethod
  onClose: () => void
  onDone: () => void
}): JSX.Element {
  useEscapeKey(onClose)
  const { toast } = useFeedback()
  const [method, setMethod] = useState<PaymentMethod>(parcel.paymentMethod ?? defaultMethod)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm(): Promise<void> {
    setSaving(true)
    const result = await window.api.sales.receive({ installmentId: parcel.id, paymentMethod: method })
    setSaving(false)
    if (!result.ok) return setError(result.error ?? 'Não foi possível registrar')
    toast.success('Recebimento registrado')
    onDone()
  }

  return (
    <div className="modal-overlay">
      <div className="card modal-card" role="dialog" aria-modal="true" aria-labelledby="receive-title">
        <div className="modal-head">
          <h2 id="receive-title">Receber parcela</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>
        <p className="subtitle">
          Parcela {parcel.number}/{parcel.totalInstallments} · {formatCurrency(parcel.amountCents)} · vence em{' '}
          {fmtDate(parcel.dueDate)}
        </p>
        <label>
          Forma de pagamento
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="primary-action" onClick={confirm} disabled={saving}>
            {saving ? 'Salvando...' : 'Confirmar recebimento'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function FinanceiroRecebimentos(): JSX.Element {
  const { toast, confirm } = useFeedback()
  const { staff } = useClinic()
  const isManager = staff.role === 'owner' || staff.role === 'admin'

  const [tab, setTab] = useState<Tab>('todas')
  const [sales, setSales] = useState<Sale[]>([])
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [charging, setCharging] = useState(false)
  const [receiving, setReceiving] = useState<{ parcel: Installment; sale: Sale } | null>(null)

  const load = useCallback(async (): Promise<void> => {
    const filter: SaleFilter = tab === 'todas' ? {} : { status: tab }
    const result = await window.api.sales.list(filter)
    if (result.ok && result.data) setSales(result.data)
    setLoaded(true)
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

  async function cancelSale(sale: Sale): Promise<void> {
    const ok = await confirm({
      title: 'Cancelar esta cobrança?',
      message:
        'Ela deixa de contar nos indicadores. O que já foi recebido não é devolvido automaticamente — acerte isso fora do programa.',
      confirmLabel: 'Cancelar cobrança',
      danger: true
    })
    if (!ok) return
    const result = await window.api.sales.cancel(sale.id)
    if (!result.ok) return void toast.error(result.error ?? 'Não foi possível cancelar')
    toast.info('Cobrança cancelada')
    load()
  }

  async function undo(parcel: Installment): Promise<void> {
    const ok = await confirm({
      title: 'Desfazer este recebimento?',
      message: 'A parcela volta a ficar pendente.',
      confirmLabel: 'Desfazer',
      danger: true
    })
    if (!ok) return
    const result = await window.api.sales.undoReceive(parcel.id)
    if (!result.ok) return void toast.error(result.error ?? 'Não foi possível desfazer')
    load()
  }

  return (
    <div>
      <div className="page-head">
        <p className="subtitle">Cobranças e parcelas. Aqui você recebe o que ficou pendente e acompanha os atrasos.</p>
        <button type="button" className="with-icon" onClick={() => setCharging(true)}>
          <Icon name="plus" size={18} />
          Nova cobrança
        </button>
      </div>

      <div className="chips-row status-tabs" role="tablist" aria-label="Situação">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab}
            className={t.key === tab ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Paciente</th>
            <th>Itens</th>
            <th>Total</th>
            <th>Recebido</th>
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
            sales.map((sale) => {
              const overdue = sale.installments.some((p) => p.overdue)
              const expanded = open === sale.id
              return (
                <Fragment key={sale.id}>
                  <tr className="row-enter clickable" onClick={() => setOpen(expanded ? null : sale.id)}>
                    <td>{new Date(sale.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td>{sale.patientName}</td>
                    <td>{sale.items.map((i) => i.description).join(', ')}</td>
                    <td>
                      {formatCurrency(sale.totalAmountCents)}
                      {sale.discountCents > 0 && <small className="muted"> (−{formatCurrency(sale.discountCents)})</small>}
                    </td>
                    <td>{formatCurrency(sale.paidCents)}</td>
                    <td>
                      <span className={`sale-chip ${overdue ? 'atrasada' : sale.status}`}>
                        {overdue ? 'Em atraso' : STATUS_LABEL[sale.status]}
                      </span>
                    </td>
                    <td className="row-actions">
                      <Icon name={expanded ? 'chevronLeft' : 'chevronRight'} size={16} />
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="detail-row">
                      <td colSpan={7}>
                        <ul className="installment-detail">
                          {sale.installments.map((p) => (
                            <li key={p.id} className={p.overdue ? 'overdue' : undefined}>
                              <span>
                                Parcela {p.number}/{p.totalInstallments}
                              </span>
                              <span>{formatCurrency(p.amountCents)}</span>
                              <span className="muted">vence {fmtDate(p.dueDate)}</span>
                              {p.paidAt ? (
                                <span className="paid-info">
                                  <Icon name="check" size={14} /> recebida em {fmtDate(p.paidAt)} ·{' '}
                                  {PAYMENT_LABELS[p.paymentMethod]}
                                  {p.feeCents > 0 && <small className="muted"> (taxa {formatCurrency(p.feeCents)})</small>}
                                </span>
                              ) : (
                                <span className="paid-info">{p.overdue ? 'em atraso' : 'pendente'}</span>
                              )}
                              <span className="parcel-actions">
                                {!p.paidAt && sale.status !== 'cancelada' && (
                                  <button
                                    type="button"
                                    className="soft-btn"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setReceiving({ parcel: p, sale })
                                    }}
                                  >
                                    Receber
                                  </button>
                                )}
                                {p.paidAt && isManager && sale.status !== 'cancelada' && (
                                  <button
                                    type="button"
                                    className="link-button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      undo(p)
                                    }}
                                  >
                                    Desfazer
                                  </button>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {isManager && sale.status !== 'cancelada' && (
                          <button type="button" className="link-button danger-link" onClick={() => cancelSale(sale)}>
                            Cancelar cobrança
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          {loaded && sales.length === 0 && (
            <tr>
              <td colSpan={7}>
                <div className="empty-state">
                  <Icon name="finance" size={34} />
                  <strong>Nenhuma cobrança {tab === 'todas' ? 'registrada ainda' : 'nesta situação'}</strong>
                  <span>Ao finalizar um atendimento na agenda, a cobrança já vem preenchida.</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {charging && (
        <ChargeModal
          onClose={() => setCharging(false)}
          onSaved={() => {
            setCharging(false)
            load()
          }}
        />
      )}
      {receiving && (
        <ReceiveModal
          parcel={receiving.parcel}
          defaultMethod={receiving.sale.installments[0]?.paymentMethod ?? 'dinheiro'}
          onClose={() => setReceiving(null)}
          onDone={() => {
            setReceiving(null)
            load()
          }}
        />
      )}
    </div>
  )
}
