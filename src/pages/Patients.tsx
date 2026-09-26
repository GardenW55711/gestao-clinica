import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Patient } from '@shared/types'
import { useFeedback } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { PatientFormModal } from '../components/PatientFormModal'
import { matchesPatient } from '../utils/search'

export function Patients(): JSX.Element {
  const { toast, confirm } = useFeedback()
  const navigate = useNavigate()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  async function load(): Promise<void> {
    const result = await window.api.patients.list()
    if (result.ok && result.data) setPatients(result.data)
    setLoaded(true)
  }

  useEffect(() => {
    load()
  }, [])

  const shown = useMemo(
    () => patients.filter((p) => matchesPatient(p, query)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [patients, query]
  )

  async function remove(patient: Patient): Promise<void> {
    const ok = await confirm({
      title: `Remover ${patient.name}?`,
      message: 'O paciente deixa de aparecer nas listas. Atendimentos e cobranças antigos continuam registrados.',
      confirmLabel: 'Remover',
      danger: true
    })
    if (!ok) return
    await window.api.patients.remove(patient.id)
    toast.info('Paciente removido')
    load()
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Pacientes</h1>
          <p className="subtitle">Clique em um paciente para abrir a ficha: dados, atendimentos e financeiro.</p>
        </div>
        <button type="button" className="with-icon" onClick={() => setCreating(true)}>
          <Icon name="plus" size={18} />
          Novo paciente
        </button>
      </div>

      <div className="search-bar">
        <Icon name="search" size={17} />
        <input
          type="search"
          placeholder="Buscar por nome, CPF ou telefone..."
          aria-label="Buscar paciente"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <span className="muted">
          {shown.length} {shown.length === 1 ? 'paciente' : 'pacientes'}
        </span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Telefone</th>
            <th>CPF</th>
            <th>E-mail</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {!loaded &&
            [0, 1, 2].map((i) => (
              <tr key={`sk-${i}`}>
                <td colSpan={5}>
                  <div className="skeleton" />
                </td>
              </tr>
            ))}
          {loaded &&
            shown.map((p) => (
              <tr key={p.id} className="row-enter clickable" onClick={() => navigate(`/patients/${p.id}`)}>
                <td>
                  <strong>{p.name}</strong>
                </td>
                <td>{p.phone ?? '—'}</td>
                <td>{p.cpf ?? '—'}</td>
                <td>{p.email ?? '—'}</td>
                <td className="row-actions">
                  <div className="row-actions-inner">
                    <button
                      type="button"
                      className="icon-btn danger"
                      aria-label={`Remover ${p.name}`}
                      title="Remover"
                      onClick={(e) => {
                        e.stopPropagation()
                        remove(p)
                      }}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          {loaded && shown.length === 0 && (
            <tr>
              <td colSpan={5}>
                <div className="empty-state">
                  <Icon name="patients" size={34} />
                  <strong>{query ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}</strong>
                  <span>{query ? 'Confira o nome, CPF ou telefone digitado.' : 'Use “Novo paciente” para cadastrar o primeiro.'}</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {creating && (
        <PatientFormModal
          onClose={() => setCreating(false)}
          onSaved={(patient) => {
            setCreating(false)
            toast.success('Paciente cadastrado')
            navigate(`/patients/${patient.id}`)
          }}
        />
      )}
    </div>
  )
}
