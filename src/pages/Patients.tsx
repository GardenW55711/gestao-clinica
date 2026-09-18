import { CrudPage } from '../components/CrudPage'
import type { Patient, PatientInput } from '@shared/types'

const emptyInput: PatientInput = {
  name: '',
  phone: '',
  email: '',
  birthDate: '',
  cpf: '',
  notes: '',
  lgpdConsent: false
}

export function Patients(): JSX.Element {
  return (
    <CrudPage<Patient, PatientInput>
      title="Pacientes"
      description="O aceite de uso de dados (LGPD) é obrigatório para cadastrar um paciente."
      api={window.api.patients}
      emptyInput={emptyInput}
      fields={[
        { key: 'name', label: 'Nome', type: 'text', required: true },
        { key: 'phone', label: 'Telefone', type: 'phone' },
        { key: 'cpf', label: 'CPF', type: 'cpf' },
        { key: 'email', label: 'E-mail', type: 'text' },
        { key: 'birthDate', label: 'Nascimento', type: 'date' },
        { key: 'lgpdConsent', label: 'Paciente autorizou o uso dos dados', type: 'checkbox', required: true }
      ]}
      columns={[
        { key: 'name', label: 'Nome' },
        { key: 'phone', label: 'Telefone' },
        { key: 'cpf', label: 'CPF' },
        { key: 'email', label: 'E-mail' }
      ]}
    />
  )
}
