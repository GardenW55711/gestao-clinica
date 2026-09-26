import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { SubTabs, type SubTab } from '../../components/SubTabs'
import { useClinic } from '../../context/ClinicContext'

export function FinanceiroLayout(): JSX.Element {
  const { staff } = useClinic()
  const { pathname } = useLocation()
  const isManager = staff.role === 'owner' || staff.role === 'admin'

  // Dono/admin veem tudo. Os demais só cuidam das cobranças e recebimentos.
  if (!isManager && (pathname === '/financeiro' || pathname.endsWith('/despesas'))) {
    return <Navigate to="/financeiro/recebimentos" replace />
  }

  const tabs: SubTab[] = isManager
    ? [
        { to: '/financeiro', label: 'Visão geral', end: true },
        { to: '/financeiro/recebimentos', label: 'Recebimentos' },
        { to: '/financeiro/despesas', label: 'Despesas' }
      ]
    : [{ to: '/financeiro/recebimentos', label: 'Recebimentos' }]

  return (
    <div>
      <h1>Financeiro</h1>
      <SubTabs tabs={tabs} />
      <Outlet />
    </div>
  )
}