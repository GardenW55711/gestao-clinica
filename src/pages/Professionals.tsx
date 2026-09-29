import { CrudPage } from '../components/CrudPage'
import type { Professional, ProfessionalInput } from '@shared/types'

const emptyInput: ProfessionalInput = { name: '', specialty: '', color: '', commissionPercent: 0, croNumber: '', croUf: '' }

export function Professionals(): JSX.Element {
  return (
    <CrudPage<Professional, ProfessionalInput>
      title="Profissionais"
      embedded
      itemName="profissional"
      description="O CRO é obrigatório para emitir receita e atestado (Fase 2). A comissão é o percentual que o profissional recebe sobre o valor recebido dos atendimentos dele."
      api={window.api.professionals}
      emptyInput={emptyInput}
      toInput={(p) => ({
        name: p.name,
        specialty: p.specialty ?? '',
        color: p.color ?? '',
        commissionPercent: p.commissionPercent,
        croNumber: p.croNumber ?? '',
        croUf: p.croUf ?? ''
      })}
      fields={[
        { key: 'name', label: 'Nome', type: 'text', required: true },
        { key: 'specialty', label: 'Especialidade', type: 'text' },
        { key: 'commissionPercent', label: 'Comissão (%)', type: 'number' },
        { key: 'croNumber', label: 'CRO (número)', type: 'text' },
        { key: 'croUf', label: 'CRO (UF)', type: 'text' }
      ]}
      columns={[
        { key: 'name', label: 'Nome' },
        { key: 'specialty', label: 'Especialidade' },
        {
          key: 'commissionPercent',
          label: 'Comissão',
          render: (p) => `${p.commissionPercent.toLocaleString('pt-BR')}%`
        },
        { key: 'croNumber', label: 'CRO', render: (p) => (p.croNumber ? `${p.croNumber}/${p.croUf ?? '—'}` : '—') }
      ]}
    />
  )
}
