import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useClinic } from '../context/ClinicContext'
import { useFeedback } from '../components/Feedback'
import { Icon, type IconName } from '../components/Icons'

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
  to: string
  icon: IconName
  label: string
  value: number | null
  hint: string
  warn?: boolean
}

export function Home(): JSX.Element {
  const { staff } = useClinic()
  const { toast } = useFeedback()
  const [syncing, setSyncing] = useState(false)
  const [appointmentsToday, setAppointmentsToday] = useState<number | null>(null)
  const [lowStock, setLowStock] = useState<number | null>(null)
  const [pending, setPending] = useState<number | null>(null)

  useEffect(() => {
    window.api.appointments.listByDate(todayIso()).then((r) => {
      if (r.ok && r.data) setAppointmentsToday(r.data.filter((a) => a.status !== 'cancelled').length)
    })
    Promise.all([window.api.inventory.listItems(), window.api.inventory.expiringSoon()]).then(([items, alerts]) => {
      const low = items.ok && items.data ? items.data.filter((i) => i.currentQuantity < i.minQuantity).length : 0
      const expiring = alerts.ok && alerts.data ? alerts.data.length : 0
      setLowStock(low + expiring)
    })
    window.api.bookingRequests.listPending().then((r) => {
      if (r.ok && r.data) setPending(r.data.length)
    })
  }, [])

  async function handleSync(): Promise<void> {
    setSyncing(true)
    const result = await window.api.syncNow()
    setSyncing(false)
    if (result.ok) toast.success('Tudo sincronizado com a nuvem')
    else toast.error(`Não sincronizou: ${result.error}`)
  }

  const tiles: Tile[] = [
    { to: '/agenda', icon: 'calendar', label: 'Agendamentos hoje', value: appointmentsToday, hint: 'Abrir agenda' },
    {
      to: '/estoque',
      icon: 'stock',
      label: 'Atenção no estoque',
      value: lowStock,
      hint: 'Itens baixos ou vencendo',
      warn: (lowStock ?? 0) > 0
    },
    {
      to: '/configuracoes',
      icon: 'patients',
      label: 'Pedidos online',
      value: pending,
      hint: 'Aguardando sua resposta',
      warn: (pending ?? 0) > 0
    }
  ]

  const dateText = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <p className="eyebrow">{dateText}</p>
      <h1>
        {greeting()}, {staff.name.split(' ')[0]}
      </h1>

      <div className="tiles">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className={t.warn ? 'tile warn' : 'tile'}>
            <span className="tile-icon">
              <Icon name={t.icon} size={22} />
            </span>
            <span className="tile-value">{t.value === null ? <span className="skeleton tiny" /> : t.value}</span>
            <span className="tile-label">{t.label}</span>
            <span className="tile-hint">{t.hint}</span>
          </Link>
        ))}
      </div>

      <button type="button" className="ghost-btn" onClick={handleSync} disabled={syncing}>
        {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
      </button>
    </div>
  )
}
