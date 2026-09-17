import { FormEvent, ReactNode, useEffect, useState } from 'react'
import type { ApiResult } from '@shared/types'

export interface FieldConfig<Input> {
  key: keyof Input
  label: string
  type: 'text' | 'number' | 'checkbox' | 'date'
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
  fields: FieldConfig<Input>[]
  columns: ColumnConfig<Dto>[]
  api: CrudApiLike<Dto, Input>
  emptyInput: Input
}

export function CrudPage<Dto extends { id: string }, Input extends object>({
  title,
  description,
  fields,
  columns,
  api,
  emptyInput
}: Props<Dto, Input>): JSX.Element {
  const [items, setItems] = useState<Dto[]>([])
  const [form, setForm] = useState<Input>(emptyInput)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load(): Promise<void> {
    const result = await api.list()
    if (result.ok && result.data) setItems(result.data)
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
    load()
  }

  async function handleRemove(id: string): Promise<void> {
    await api.remove(id)
    load()
  }

  function updateField(key: keyof Input, value: unknown): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div>
      <h1>{title}</h1>
      {description && <p className="subtitle">{description}</p>}

      <form className="inline-form" onSubmit={handleSubmit}>
        {fields.map((field) => (
          <label key={String(field.key)}>
            {field.label}
            {field.type === 'checkbox' ? (
              <input
                type="checkbox"
                checked={Boolean(form[field.key])}
                onChange={(e) => updateField(field.key, e.target.checked)}
              />
            ) : (
              <input
                type={field.type}
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
          {items.map((item) => (
            <tr key={item.id}>
              {columns.map((c) => (
                <td key={String(c.key)}>{c.render ? c.render(item) : String(item[c.key] ?? '')}</td>
              ))}
              <td>
                <button type="button" className="link-button" onClick={() => handleRemove(item.id)}>
                  Remover
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="empty-row">
                Nenhum registro ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
