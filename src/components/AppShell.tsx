import { NavLink, Outlet } from 'react-router-dom'
import { useClinic } from '../context/ClinicContext'

const links = [
  { to: '/', label: 'Início', end: true },
  { to: '/patients', label: 'Pacientes', end: false },
  { to: '/professionals', label: 'Profissionais', end: false },
  { to: '/rooms', label: 'Salas', end: false },
  { to: '/procedure-types', label: 'Tipos de procedimento', end: false }
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
          <span className="nav-item disabled">Agenda (em breve)</span>
          <span className="nav-item disabled">Estoque (em breve)</span>
          <span className="nav-item disabled">Vendas (em breve)</span>
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
