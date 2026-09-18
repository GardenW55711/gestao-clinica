import { FormEvent, ReactNode, useEffect, useState } from 'react'
import type { ApiResult } from '@shared/types'
import { maskCpf, maskPhone } from '../utils/masks'
import { useFeedback } from './Feedback'
import { Icon } from './Icons'

export interface FieldConfig<Input> {
  key: keyof Input
  label: string
  type: 'text' | 'number' | 'checkbox' | 'date' | 'cpf' | 'phone'
  required?: boolean
}

export interface ColumnConfig<Dto> {
  key: keyof Dto
  label: string
  render?: (row: Dto) => ReactNode
}

interface CrudApiLike<Dto, Input> {
  list: () => Promise<ApiResult<Dto[]>>
  create: (input: Input) => Promise<ApiResult<Dto>>
  remove: (id: string) => Promise<ApiResult<null>>
}

interface Props<Dto extends { id: string }, Input extends object> {
  title: string
  description?: string
  itemName?: string
  fields: FieldConfig<Input>[]
  columns: ColumnConfig<Dto>[]
  api: CrudApiLike<Dto, Input>
  emptyInput: Input
}

export function CrudPage<Dto extends { id: string }, Input extends object>({
  title,
  description,
  itemName = 'registro',
  fields,
  columns,
  api,
  emptyInput
}: Props<Dto, Input>): JSX.Element {
  const { toast, confirm } = useFeedback()
  const [items, setItems] = useState<Dto[]>([])
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState<Input>(emptyInput)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [formKey, setFormKey] = useState(0)

  async function load(): Promise<void> {
    const result = await api.list()
    if (result.ok && result.data) setItems(result.data)
    setLoaded(true)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await api.create(form)
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? 'Não foi possível salvar')
      return
    }
    setForm(emptyInput)
    setFormKey((k) => k + 1)
    toast.success('Salvo com sucesso')
    load()
  }

  async function handleRemove(id: string): Promise<void> {
    const ok = await confirm({
      title: `Remover ${itemName}?`,
      message: 'Ele deixa de aparecer nas listas. Essa ação não pode ser desfeita por aqui.',
      confirmLabel: 'Remover',
      danger: true
    })
    if (!ok) return
    await api.remove(id)
    toast.info('Removido')
    load()
  }

  function updateField(key: keyof Input, value: unknown): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div>
      <h1>{title}</h1>
      {description && <p className="subtitle">{description}</p>}

      <form key={formKey} className="inline-form" onSubmit={handleSubmit}>
        {fields.map((field, index) => (
          <label key={String(field.key)} className={field.type === 'checkbox' ? 'check-field' : undefined}>
            {field.label}
            {field.type === 'checkbox' ? (
              <input
                type="checkbox"
                checked={Boolean(form[field.key])}
                onChange={(e) => updateField(field.key, e.target.checked)}
              />
            ) : field.type === 'cpf' || field.type === 'phone' ? (
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder={field.type === 'cpf' ? '000.000.000-00' : '(00) 00000-0000'}
                value={(form[field.key] as string | undefined) ?? ''}
                required={field.required}
                onChange={(e) =>
                  updateField(field.key, field.type === 'cpf' ? maskCpf(e.target.value) : maskPhone(e.target.value))
                }
              />
            ) : (
              <input
                type={field.type}
                autoFocus={index === 0}
                autoComplete="off"
                value={(form[field.key] as string | number | undefined) ?? ''}
                required={field.required}
                onChange={(e) =>
                  updateField(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)
                }
              />
            )}
          </label>
        ))}
        <button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Adicionar'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={String(c.key)}>{c.label}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {!loaded &&
            [0, 1, 2].map((i) => (
              <tr key={`sk-${i}`}>
                <td colSpan={columns.length + 1}>
                  <div className="skeleton" />
                </td>
              </tr>
            ))}
          {loaded &&
            items.map((item) => (
              <tr key={item.id} className="row-enter">
                {columns.map((c) => (
                  <td key={String(c.key)}>{c.render ? c.render(item) : String(item[c.key] ?? '')}</td>
                ))}
                <td className="row-actions">
                  <button type="button" className="link-button" onClick={() => handleRemove(item.id)}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          {loaded && items.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1}>
                <div className="empty-state">
                  <Icon name="empty" size={34} />
                  <strong>Nada por aqui ainda</strong>
                  <span>Use o formulário acima para adicionar o primeiro {itemName}.</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
