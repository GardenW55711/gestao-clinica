import { KeyboardEvent, useMemo, useRef, useState } from 'react'
import type { Patient } from '@shared/types'
import { maskPhone } from '../utils/masks'
import { matchesPatient } from '../utils/search'
import { Icon } from './Icons'

interface Props {
  patients: Patient[]
  value: string
  onChange: (patientId: string) => void
  /** Chamado depois de cadastrar um paciente novo (para a lista do pai incluí-lo). */
  onCreated: (patient: Patient) => void
  autoFocus?: boolean
}

/**
 * Escolha de paciente digitando (nome, CPF ou telefone) e, se ele ainda não
 * existe, cadastro rápido (nome + telefone) sem sair da tela.
 */
export function PatientPicker({ patients, value, onChange, onCreated, autoFocus }: Props): JSX.Element {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = patients.find((p) => p.id === value)
  const results = useMemo(() => patients.filter((p) => matchesPatient(p, query)).slice(0, 6), [patients, query])

  function pick(patient: Patient): void {
    onChange(patient.id)
    setQuery('')
    setOpen(false)
    setActive(0)
  }

  function startCreating(): void {
    setNewName(/\d/.test(query) ? '' : query.trim())
    setNewPhone(/\d/.test(query) ? maskPhone(query) : '')
    setConsent(false)
    setError(null)
    setCreating(true)
    setOpen(false)
  }

  async function create(): Promise<void> {
    setError(null)
    if (!newName.trim()) return setError('Informe o nome')
    if (!consent) return setError('É necessário o aceite de uso de dados (LGPD)')
    setSaving(true)
    const result = await window.api.patients.create({
      name: newName.trim(),
      phone: newPhone || undefined,
      lgpdConsent: true
    })
    setSaving(false)
    if (!result.ok || !result.data) return setError(result.error ?? 'Não foi possível cadastrar')
    onCreated(result.data)
    onChange(result.data.id)
    setCreating(false)
    setQuery('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, results.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      if (results[active]) pick(results[active])
      else if (query.trim()) startCreating()
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
    }
  }

  if (selected && !creating) {
    return (
      <div className="patient-chip">
        <Icon name="patients" size={16} />
        <span>
          <strong>{selected.name}</strong>
          {selected.phone && <small className="muted"> · {selected.phone}</small>}
        </span>
        <button type="button" className="link-button" onClick={() => onChange('')}>
          Trocar
        </button>
      </div>
    )
  }

  if (creating) {
    return (
      <div className="quick-patient">
        <strong>Novo paciente</strong>
        <label>
          Nome
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} autoComplete="off" />
        </label>
        <label>
          Telefone
          <input
            value={newPhone}
            inputMode="numeric"
            placeholder="(00) 00000-0000"
            onChange={(e) => setNewPhone(maskPhone(e.target.value))}
            autoComplete="off"
          />
        </label>
        <label className="switch-row compact">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          Paciente autorizou o uso dos dados (LGPD)
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="soft-btn" onClick={() => setCreating(false)}>
            Voltar
          </button>
          <button type="button" onClick={create} disabled={saving}>
            {saving ? 'Salvando...' : 'Cadastrar e selecionar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="picker">
      <div className="picker-field">
        <Icon name="search" size={16} />
        <input
          ref={inputRef}
          type="text"
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder="Buscar paciente por nome, CPF ou telefone..."
          aria-label="Buscar paciente"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {open && (
        <ul className="picker-list" role="listbox">
          {results.map((p, index) => (
            <li
              key={p.id}
              role="option"
              aria-selected={index === active}
              className={index === active ? 'picker-option active' : 'picker-option'}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(p)
              }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="picker-name">{p.name}</span>
              <span className="picker-meta">{[p.phone, p.cpf].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
          <li
            role="option"
            aria-selected={active === results.length}
            className={active === results.length ? 'picker-option active create' : 'picker-option create'}
            onMouseDown={(e) => {
              e.preventDefault()
              startCreating()
            }}
            onMouseEnter={() => setActive(results.length)}
          >
            <Icon name="plus" size={15} />
            <span className="picker-name">
              {query.trim() ? `Cadastrar novo paciente “${query.trim()}”` : 'Cadastrar novo paciente'}
            </span>
          </li>
        </ul>
      )}
    </div>
  )
}
