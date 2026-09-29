import { Navigate, Outlet } from 'react-router-dom'
import { SubTabs } from '../../components/SubTabs'
import { useClinic } from '../../context/ClinicContext'

export function ConfiguracoesLayout(): JSX.Element {
  const { staff } = useClinic()
  if (staff.role !== 'owner' && staff.role !== 'admin') return <Navigate to="/" replace />

  return (
    <div>
      <h1>Configurações</h1>
      <SubTabs
        tabs={[
          { to: '/configuracoes', label: 'Autoagendamento', end: true },
          { to: '/configuracoes/horarios', label: 'Horários' },
          { to: '/configuracoes/bloqueios', label: 'Bloqueios' },
          { to: '/configuracoes/taxas', label: 'Taxas de cartão' },
          { to: '/configuracoes/funcionarios', label: 'Funcionários' },
          { to: '/configuracoes/clinica', label: 'Dados da clínica' },
          { to: '/configuracoes/anamnese', label: 'Modelos de anamnese' }
        ]}
      />
      <Outlet />
    </div>
  )
}
