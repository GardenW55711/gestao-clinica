import { NavLink, Outlet } from 'react-router-dom'
import { useClinic } from '../context/ClinicContext'

const links = [
  { to: '/', label: 'Início', end: true },
  { to: '/agenda', label: 'Agenda', end: false },
  { to: '/patients', label: 'Pacientes', end: false },
  { to: '/professionals', label: 'Profissionais', end: false },
  { to: '/rooms', label: 'Salas', end: false },
  { to: '/procedure-types', label: 'Tipos de procedimento', end: false },
  { to: '/estoque', label: 'Estoque', end: false },
  { to: '/vendas', label: 'Vendas', end: false }
]

export function AppShell(): JSX.Element {
  const { clinicName } = useClinic()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2>{clinicName}</h2>
        <nav>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
