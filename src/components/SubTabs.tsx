import { NavLink } from 'react-router-dom'

export interface SubTab {
  to: string
  label: string
  end?: boolean
  badge?: number
}

/** Abas de seção dentro de uma página (Financeiro, Cadastros, Agenda). */
export function SubTabs({ tabs }: { tabs: SubTab[] }): JSX.Element {
  return (
    <nav className="subtabs" aria-label="Seções">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => 'subtab' + (isActive ? ' active' : '')}
        >
          {tab.label}
          {tab.badge ? <span className="subtab-badge">{tab.badge}</span> : null}
        </NavLink>
      ))}
    </nav>
  )
}
