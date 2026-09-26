import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useClinic } from '../context/ClinicContext'
import { ThemeToggle } from './ThemeToggle'
import { UpdateBanner, VersionFooter } from './UpdateInfo'
import { Icon, type IconName } from './Icons'

const links: { to: string; label: string; icon: IconName; end: boolean; managersOnly?: boolean }[] = [
  { to: '/', label: 'Início', icon: 'home', end: true },
  { to: '/agenda', label: 'Agenda', icon: 'calendar', end: false },
  { to: '/patients', label: 'Pacientes', icon: 'patients', end: false },
  { to: '/financeiro', label: 'Financeiro', icon: 'finance', end: false },
  { to: '/estoque', label: 'Estoque', icon: 'stock', end: false },
  { to: '/cadastros', label: 'Cadastros', icon: 'folder', end: false, managersOnly: true },
  { to: '/configuracoes', label: 'Configurações', icon: 'settings', end: false, managersOnly: true }
]

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = (): void => setOnline(true)
    const off = (): void => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function AppShell(): JSX.Element {
  const { clinicName, staff } = useClinic()
  const isManager = staff.role === 'owner' || staff.role === 'admin'
  const location = useLocation()
  const online = useOnline()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2 title={clinicName}>
          <span className="clinic-initial">{clinicName.trim().charAt(0).toUpperCase()}</span>
          <span className="nav-label">{clinicName}</span>
        </h2>
        <nav>
          {links.filter((link) => isManager || !link.managersOnly).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              title={link.label}
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
            >
              <Icon name={link.icon} />
              <span className="nav-label">{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <ThemeToggle />
        <VersionFooter />
      </aside>
      <main className="content">
        {!online && (
          <div className="offline-banner" role="status">
            <span className="dot" />
            Sem internet — você pode continuar usando o programa, tudo fica salvo neste computador e sincroniza
            quando a conexão voltar.
          </div>
        )}
        <UpdateBanner />
        <div key={location.pathname.split('/').slice(0, 2).join('/')} className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
