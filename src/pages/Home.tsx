import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DashboardSummary, OverviewData } from '@shared/types'
import { useClinic } from '../context/ClinicContext'
import { useFeedback } from '../components/Feedback'
import { Icon, type IconName } from '../components/Icons'
import { formatCurrency } from '../utils/masks'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Tile {
  key: string
  to: string
  icon: IconName
  label: string
  value: string | number | null
  hint: string
  warn?: boolean
}

export function Home(): JSX.Element {
  const { staff } = useClinic()
  const { toast } = useFeedback()
  const isManager = staff.role === 'owner' || staff.role === 'admin'

  const [syncing, setSyncing] = useState(false)
  const [appointmentsToday, setAppointmentsToday] = useState<number | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(0)
  const [lowStock, setLowStock] = useState<number | null>(null)
  const [pending, setPending] = useState<number | null>(null)
  const [dash, setDash] = useState<DashboardSummary | null>(null)
  const [month, setMonth] = useState<OverviewData | null>(null)

  useEffect(() => {
    window.api.appointments.listByDate(todayIso()).then((r) => {
      if (r.ok && r.data) {
        const active = r.data.filter((a) => a.status !== 'cancelled')
        setAppointmentsToday(active.length)
        setUnconfirmed(active.filter((a) => a.status === 'scheduled').length)
      }
    })
    Promise.all([window.api.inventory.listItems(), window.api.inventory.expiringSoon()]).then(([items, alerts]) => {
      const low = items.ok && items.data ? items.data.filter((i) => i.currentQuantity < i.minQuantity).length : 0
      const expiring = alerts.ok && alerts.data ? alerts.data.length : 0
      setLowStock(low + expiring)
    })
    window.api.bookingRequests.listPending().then((r) => {
      if (r.ok && r.data) setPending(r.data.length)
    })
    window.api.finance.dashboard().then((r) => {
      if (r.ok && r.data) setDash(r.data)
    })
    if (isManager) {
      const now = new Date()
      window.api.finance
        .overview({
          from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
          to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
        })
        .then((r) => {
          if (r.ok && r.data) setMonth(r.data)
        })
    }
  }, [isManager])

  async function handleSync(): Promise<void> {
    setSyncing(true)
    const result = await window.api.syncNow()
    setSyncing(false)
    if (result.ok) toast.success('Tudo sincronizado com a nuvem')
    else toast.error(`Não sincronizou: ${result.error}`)
  }

  const tiles: Tile[] = [
    {
      key: 'agenda',
      to: '/agenda',
      icon: 'calendar',
      label: 'Agendamentos hoje',
      value: appointmentsToday,
      hint: unconfirmed > 0 ? `${unconfirmed} ainda sem confirmar` : appointmentsToday ? 'todos confirmados' : 'Abrir agenda',
      warn: unconfirmed > 0
    },
    {
      key: 'receber',
      to: '/financeiro/recebimentos',
      icon: 'finance',
      label: 'A receber hoje',
      value: dash ? formatCurrency(dash.dueTodayCents) : null,
      hint: dash ? `${dash.dueTodayCount} ${dash.dueTodayCount === 1 ? 'parcela vence' : 'parcelas vencem'} hoje` : ''
    },
    {
      key: 'atraso',
      to: '/financeiro/recebimentos',
      icon: 'finance',
      label: 'Parcelas em atraso',
      value: dash ? dash.overdueCount : null,
      hint: dash ? (dash.overdueCount > 0 ? `${formatCurrency(dash.overdueCents)} para cobrar` : 'nada atrasado') : '',
      warn: (dash?.overdueCount ?? 0) > 0
    },
    {
      key: 'estoque',
      to: '/estoque',
      icon: 'stock',
      label: 'Atenção no estoque',
      value: lowStock,
      hint: 'Itens baixos ou vencendo',
      warn: (lowStock ?? 0) > 0
    },
    {
      key: 'pedidos',
      to: '/agenda/pedidos',
      icon: 'patients',
      label: 'Pedidos online',
      value: pending,
      hint: 'Aguardando sua resposta',
      warn: (pending ?? 0) > 0
    }
  ]

  const be = month?.breakEven
  const dateText = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <p className="eyebrow">{dateText}</p>
      <h1>
        {greeting()}, {staff.name.split(' ')[0]}
      </h1>

      <div className="tiles">
        {tiles.map((t) => (
          <Link key={t.key} to={t.to} className={t.warn ? 'tile warn' : 'tile'}>
            <span className="tile-icon">
              <Icon name={t.icon} size={22} />
            </span>
            <span className="tile-value">{t.value === null ? <span className="skeleton tiny" /> : t.value}</span>
            <span className="tile-label">{t.label}</span>
            <span className="tile-hint">{t.hint}</span>
          </Link>
        ))}
      </div>

      {isManager && (
        <Link to="/financeiro" className="tile home-goal">
          <span className="tile-label">Recebido no mês × ponto de equilíbrio</span>
          {!be && <span className="skeleton block" />}
          {be && (
            <>
              <span className="be-numbers">
                <span>
                  <span className="tile-hint">Recebido (bruto)</span>
                  <strong className="be-value">{formatCurrency(be.receivedCents)}</strong>
                </span>
                <span>
                  <span className="tile-hint">Precisa faturar</span>
                  <strong className="be-value">{be.breakEvenCents === null ? '—' : formatCurrency(be.breakEvenCents)}</strong>
                </span>
              </span>
              <span className="progress" role="progressbar" aria-valuenow={Math.round(be.progressPercent)} aria-valuemin={0} aria-valuemax={100}>
                <span className={be.reached ? 'progress-bar reached' : 'progress-bar'} style={{ width: `${be.progressPercent}%` }} />
              </span>
              <span className={be.reached ? 'be-message good' : 'be-message'}>
                {be.breakEvenCents === null
                  ? 'Sem dados suficientes neste mês para calcular.'
                  : be.reached
                    ? 'Meta batida — tudo acima disso é lucro.'
                    : `Faltam ${formatCurrency(be.missingCents ?? 0)} para cobrir os custos do mês.`}
              </span>
            </>
          )}
        </Link>
      )}

      <button type="button" className="ghost-btn" onClick={handleSync} disabled={syncing}>
        {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
      </button>
    </div>
  )
}
