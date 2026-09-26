import { Fragment, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { PAYMENT_LABELS } from '@shared/types'
import type { Sale } from '@shared/types'
import { Icon } from '../../components/Icons'
import { formatCurrency } from '../../utils/masks'
import type { PatientFileContext } from './PatientFile'

const STATUS_LABEL = { pendente: 'Pendente', parcial: 'Parcial', paga: 'Paga', cancelada: 'Cancelada' } as const

const fmtDate = (iso: string): string => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function PatientFinance(): JSX.Element {
  const { patient } = useOutletContext<PatientFileContext>()
  const [sales, setSales] = useState<Sale[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.api.sales.list({ patientId: patient.id }).then((r) => {
      if (r.ok && r.data) setSales(r.data)
      setLoaded(true)
    })
  }, [patient.id])

  const active = sales.filter((s) => s.status !== 'cancelada')
  const total = active.reduce((s, x) => s + x.totalAmountCents, 0)
  const paid = active.reduce((s, x) => s + x.paidCents, 0)
  const overdueCents = active.flatMap((s) => s.installments).filter((p) => p.overdue).reduce((s, p) => s + p.amountCents, 0)

  return (
    <div>
      <div className="patient-stats">
        <span className="stat-chip">
          <strong>{formatCurrency(total)}</strong> cobrado
        </span>
        <span className="stat-chip">
          <strong>{formatCurrency(paid)}</strong> recebido
        </span>
        <span className="stat-chip">
          <strong>{formatCurrency(total - paid)}</strong> em aberto
        </span>
        <span className={overdueCents > 0 ? 'stat-chip danger' : 'stat-chip'}>
          <strong>{formatCurrency(overdueCents)}</strong> em atraso
        </span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Itens</th>
            <th>Total</th>
            <th>Recebido</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {loaded &&
            sales.map((s) => {
              const overdue = s.installments.some((p) => p.overdue)
              return (
                <Fragment key={s.id}>
                  <tr className="row-enter">
                    <td>{new Date(s.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td>{s.items.map((i) => i.description).join(', ')}</td>
                    <td>{formatCurrency(s.totalAmountCents)}</td>
                    <td>{formatCurrency(s.paidCents)}</td>
                    <td>
                      <span className={`sale-chip ${overdue ? 'atrasada' : s.status}`}>{overdue ? 'Em atraso' : STATUS_LABEL[s.status]}</span>
                    </td>
                  </tr>
                  {s.status !== 'cancelada' && s.installments.length > 0 && (
                    <tr className="detail-row">
                      <td colSpan={5}>
                        <ul className="installment-detail">
                          {s.installments.map((p) => (
                            <li key={p.id} className={p.overdue ? 'overdue' : undefined}>
                              <span>
                                Parcela {p.number}/{p.totalInstallments}
                              </span>
                              <span>{formatCurrency(p.amountCents)}</span>
                              <span className="muted">vence {fmtDate(p.dueDate)}</span>
                              <span className="paid-info">
                                {p.paidAt ? (
                                  <>
                                    <Icon name="check" size={14} /> recebida em {fmtDate(p.paidAt)} · {PAYMENT_LABELS[p.paymentMethod]}
                                  </>
                                ) : p.overdue ? (
                                  'em atraso'
                                ) : (
                                  'pendente'
                                )}
                              </span>
                              <span />
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          {loaded && sales.length === 0 && (
            <tr>
              <td colSpan={5}>
                <div className="empty-state">
                  <Icon name="finance" size={34} />
                  <strong>Nenhuma cobrança deste paciente</strong>
                  <span>
                    Para receber ou registrar pagamentos, use <Link to="/financeiro/recebimentos">Financeiro › Recebimentos</Link>.
                  </span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
