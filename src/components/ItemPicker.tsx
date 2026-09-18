import { KeyboardEvent, useMemo, useRef, useState } from 'react'
import type { InventoryItemSummary } from '@shared/types'
import { Icon } from './Icons'

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

interface Props {
  items: InventoryItemSummary[]
  excludeIds?: string[]
  onPick: (item: InventoryItemSummary) => void
  placeholder?: string
  autoFocus?: boolean
}

/** Barra de pesquisa dos itens do estoque: digita, escolhe na lista (mouse ou setas + Enter). */
export function ItemPicker({ items, excludeIds = [], onPick, placeholder, autoFocus }: Props): JSX.Element {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = normalize(query.trim())
    return items
      .filter((i) => !excludeIds.includes(i.id))
      .filter((i) => !q || normalize(i.name).includes(q) || normalize(i.category ?? '').includes(q))
      .slice(0, 8)
  }, [items, excludeIds, query])

  function pick(item: InventoryItemSummary): void {
    onPick(item)
    setQuery('')
    setActive(0)
    setOpen(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && open && results[active]) {
      e.preventDefault()
      pick(results[active])
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
    }
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
          placeholder={placeholder ?? 'Pesquisar item do estoque...'}
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
          {results.map((item, index) => (
            <li
              key={item.id}
              role="option"
              aria-selected={index === active}
              className={index === active ? 'picker-option active' : 'picker-option'}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(item)
              }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="picker-name">{item.name}</span>
              <span className="picker-meta">
                {item.currentQuantity} {item.unit} em estoque
              </span>
            </li>
          ))}
          {results.length === 0 && (
            <li className="picker-empty">
              {items.length === 0 ? 'Nenhum item cadastrado no estoque ainda.' : 'Nenhum item encontrado.'}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
