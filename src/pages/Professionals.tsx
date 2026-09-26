import { CrudPage } from '../components/CrudPage'
import type { Professional, ProfessionalInput } from '@shared/types'

const emptyInput: ProfessionalInput = { name: '', specialty: '', color: '', commissionPercent: 0 }

export function Professionals(): JSX.Element {
  return (
    <CrudPage<Professional, ProfessionalInput>
      title="Profissionais"
      embedded
      itemName="profissional"
      description="A comissão é o percentual que o profissional recebe sobre o valor recebido dos atendimentos dele."
      api={window.api.professionals}
      emptyInput={emptyInput}
      toInput={(p) => ({
        name: p.name,
        specialty: p.specialty ?? '',
        color: p.color ?? '',
        commissionPercent: p.commissionPercent
      })}
      fields={[
        { key: 'name', label: 'Nome', type: 'text', required: true },
        { key: 'specialty', label: 'Especialidade', type: 'text' },
        { key: 'commissionPercent', label: 'Comissão (%)', type: 'number' }
      ]}
      columns={[
        { key: 'name', label: 'Nome' },
        { key: 'specialty', label: 'Especialidade' },
        {
          key: 'commissionPercent',
          label: 'Comissão',
          render: (p) => `${p.commissionPercent.toLocaleString('pt-BR')}%`
        }
      ]}
    />
  )
}