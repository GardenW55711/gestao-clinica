import { CrudPage } from '../components/CrudPage'
import type { Professional, ProfessionalInput } from '@shared/types'

const emptyInput: ProfessionalInput = { name: '', specialty: '', color: '' }

export function Professionals(): JSX.Element {
  return (
    <CrudPage<Professional, ProfessionalInput>
      title="Profissionais"
      itemName="profissional"
      api={window.api.professionals}
      emptyInput={emptyInput}
      fields={[
        { key: 'name', label: 'Nome', type: 'text', required: true },
        { key: 'specialty', label: 'Especialidade', type: 'text' }
      ]}
      columns={[
        { key: 'name', label: 'Nome' },
        { key: 'specialty', label: 'Especialidade' }
      ]}
    />
  )
}
