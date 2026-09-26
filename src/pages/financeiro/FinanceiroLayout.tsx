import { Outlet } from 'react-router-dom'
import { SubTabs } from '../../components/SubTabs'

export function FinanceiroLayout(): JSX.Element {
  return (
    <div>
      <h1>Financeiro</h1>
      <SubTabs
        tabs={[
          { to: '/financeiro', label: 'Visão geral', end: true },
          { to: '/financeiro/recebimentos', label: 'Recebimentos' }
        ]}
      />
      <Outlet />
    </div>
  )
}
