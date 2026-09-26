import { Navigate, Outlet } from 'react-router-dom'
import { SubTabs } from '../../components/SubTabs'
import { useClinic } from '../../context/ClinicContext'

/** Cadastros: o que se mexe pouco (profissionais, salas e procedimentos). */
export function CadastrosLayout(): JSX.Element {
  const { staff } = useClinic()
  if (staff.role !== 'owner' && staff.role !== 'admin') return <Navigate to="/" replace />

  return (
    <div>
      <h1>Cadastros</h1>
      <SubTabs
        tabs={[
          { to: '/cadastros/profissionais', label: 'Profissionais' },
          { to: '/cadastros/salas', label: 'Salas' },
          { to: '/cadastros/procedimentos', label: 'Procedimentos' }
        ]}
      />
      <Outlet />
    </div>
  )
}
