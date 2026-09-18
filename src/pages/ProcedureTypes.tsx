import { CrudPage } from '../components/CrudPage'
import { formatCurrency } from '../utils/masks'
import type { ProcedureType, ProcedureTypeInput } from '@shared/types'

const emptyInput: ProcedureTypeInput = { name: '', durationMinutes: 30, defaultPrice: 0, requiresRoom: false }

export function ProcedureTypes(): JSX.Element {
  return (
    <CrudPage<ProcedureType, ProcedureTypeInput>
      title="Tipos de procedimento"
      description="A duração aqui é usada para bloquear o horário automaticamente na agenda."
      api={window.api.procedureTypes}
      emptyInput={emptyInput}
      fields={[
        { key: 'name', label: 'Nome', type: 'text', required: true },
        { key: 'durationMinutes', label: 'Duração (min)', type: 'number', required: true },
        { key: 'defaultPrice', label: 'Preço padrão (R$)', type: 'number' },
        { key: 'requiresRoom', label: 'Precisa de sala', type: 'checkbox' }
      ]}
      columns={[
        { key: 'name', label: 'Nome' },
        { key: 'durationMinutes', label: 'Duração (min)' },
        {
          key: 'defaultPrice',
          label: 'Preço padrão',
          render: (row) => formatCurrency(row.defaultPrice)
        }
      ]}
    />
  )
}
