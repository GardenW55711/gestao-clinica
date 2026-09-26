import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { SubTabs } from '../components/SubTabs'

export interface AgendaOutletContext {
  refreshPending: () => void
}

/** Agenda: calendário + pedidos vindos do autoagendamento online. */
export function Agenda(): JSX.Element {
  const [pending, setPending] = useState(0)

  const refreshPending = useCallback((): void => {
    window.api.bookingRequests.listPending().then((r) => {
      if (r.ok && r.data) setPending(r.data.length)
    })
  }, [])

  useEffect(() => {
    refreshPending()
  }, [refreshPending])

  return (
    <div className="agenda-wrap">
      <SubTabs
        tabs={[
          { to: '/agenda', label: 'Calendário', end: true },
          { to: '/agenda/pedidos', label: 'Pedidos online', badge: pending }
        ]}
      />
      <Outlet context={{ refreshPending } satisfies AgendaOutletContext} />
    </div>
  )
}
