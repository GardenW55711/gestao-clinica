import { FormEvent, useCallback, useEffect, useState } from 'react'
import type { Professional, StaffMember, StaffRole } from '@shared/types'
import { useFeedback } from '../../components/Feedback'
import { Icon } from '../../components/Icons'
import { useClinic } from '../../context/ClinicContext'
import { useEscapeKey } from '../../utils/useEscapeKey'

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Dono',
  admin: 'Administrador',
  professional: 'Profissional',
  receptionist: 'Recepção'
}

const ROLE_HELP: Record<StaffRole, string> = {
  owner: 'Acesso total.',
  admin: 'Acesso total, exceto criar outros administradores.',
  professional: 'Vê a agenda toda, edita os próprios atendimentos e vê só a própria produção.',
  receptionist: 'Cuida da agenda, pacientes e recebimentos. Não vê despesas nem lucro.'
}

function StaffModal({
  member,
  professionals,
  canMakeAdmin,
  onClose,
  onSaved
}: {
  member: StaffMember | null
  professionals: Professional[]
  canMakeAdmin: boolean
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  useEscapeKey(onClose)
  const isOwner = member?.role === 'owner'
  const [name, setName] = useState(member?.name ?? '')
  const [role, setRole] = useState<StaffRole>(member?.role ?? 'receptionist')
  const [pin, setPin] = useState('')
  const [active, setActive] = useState(member?.active ?? true)
  const [professionalId, setProfessionalId] = useState(member?.professionalId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    if (!member && !pin) return setError('Defina um PIN de 4 a 8 números')
    const input = {
      name,
      role,
      pin: pin || undefined,
      active,
      professionalId: role === 'professional' ? professionalId || null : null
    }
    setSaving(true)
    const result = member
      ? await window.api.staff.update(member.id, input)
      : await window.api.staff.create(input)
    setSaving(false)
    if (!result.ok) return setError(result.error ?? 'Não foi possível salvar')
    onSaved()
  }

  return (
    <div className="modal-overlay">
      <form className="card modal-card" role="dialog" aria-modal="true" aria-labelledby="staff-title" onSubmit={handleSubmit}>
        <div className="modal-head">
          <h2 id="staff-title">{member ? 'Editar funcionário' : 'Novo funcionário'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>

        <label>
          Nome
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" />
        </label>

        <label>
          Cargo
          <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} disabled={isOwner}>
            {isOwner && <option value="owner">{ROLE_LABELS.owner}</option>}
            {canMakeAdmin && <option value="admin">{ROLE_LABELS.admin}</option>}
            <option value="professional">{ROLE_LABELS.professional}</option>
            <option value="receptionist">{ROLE_LABELS.receptionist}</option>
          </select>
          <small className="muted">{ROLE_HELP[role]}</small>
        </label>

        {role === 'professional' && (
          <label>
            Profissional da agenda
            <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">— escolher —</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <small className="muted">Liga este usuário à agenda dele: é assim que o programa sabe quais atendimentos são “os seus”.</small>
          </label>
        )}

        <label>
          {member ? 'Novo PIN (deixe em branco para manter)' : 'PIN (4 a 8 números)'}
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          />
        </label>

        {member && !isOwner && (
          <label className="switch-row compact">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Ativo (pode entrar no programa)
          </label>
        )}

        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : member ? 'Salvar alterações' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function Funcionarios(): JSX.Element {
  const { toast } = useFeedback()
  const { staff: me } = useClinic()
  const [members, setMembers] = useState<StaffMember[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null)

  const load = useCallback(async (): Promise<void> => {
    const [st, pr] = await Promise.all([window.api.staff.list(), window.api.professionals.list()])
    if (st.ok && st.data) setMembers(st.data)
    if (pr.ok && pr.data) setProfessionals(pr.data.filter((p) => p.active))
    setLoaded(true)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const professionalName = (id: string | null): string =>
    (id && professionals.find((p) => p.id === id)?.name) || '—'

  return (
    <div>
      <div className="page-head">
        <div>
          <h2 className="section-title">Funcionários</h2>
          <p className="subtitle">
            Quem usa o programa. Cada pessoa escolhe o próprio nome e digita o PIN ao entrar; o cargo define o que ela
            pode ver e fazer.
          </p>
        </div>
        <button type="button" className="with-icon" onClick={() => setEditing('new')}>
          <Icon name="plus" size={18} />
          Novo funcionário
        </button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Cargo</th>
            <th>Profissional da agenda</th>
            <th>Situação</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {loaded &&
            members.map((m) => (
              <tr key={m.id} className="row-enter clickable" onDoubleClick={() => setEditing(m)}>
                <td>
                  <strong>{m.name}</strong>
                </td>
                <td>{ROLE_LABELS[m.role]}</td>
                <td>{m.role === 'professional' ? professionalName(m.professionalId) : '—'}</td>
                <td>
                  <span className={`sale-chip ${m.active ? 'paga' : 'cancelada'}`}>{m.active ? 'Ativo' : 'Inativo'}</span>
                </td>
                <td className="row-actions">
                  <button type="button" className="icon-btn" aria-label={`Editar ${m.name}`} title="Editar" onClick={() => setEditing(m)}>
                    <Icon name="edit" size={17} />
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {editing && (
        <StaffModal
          member={editing === 'new' ? null : editing}
          professionals={professionals}
          canMakeAdmin={me.role === 'owner'}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            toast.success('Funcionário salvo')
            load()
          }}
        />
      )}
    </div>
  )
}
