import { FormEvent, useEffect, useState } from 'react'
import type { CardFees } from '@shared/types'
import { useFeedback } from '../../components/Feedback'

const FIELDS: { key: keyof CardFees; label: string; hint: string }[] = [
  { key: 'debitPercent', label: 'Cartão de débito (%)', hint: 'Taxa cobrada pela maquininha no débito.' },
  { key: 'creditPercent', label: 'Crédito à vista (%)', hint: 'Taxa do crédito em 1 vez.' },
  { key: 'creditInstallmentPercent', label: 'Crédito parcelado (%)', hint: 'Taxa do crédito em 2 ou mais vezes.' }
]

export function Taxas(): JSX.Element {
  const { toast } = useFeedback()
  const [values, setValues] = useState<Record<keyof CardFees, string> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.clinicSettings.get().then((r) => {
      if (r.ok && r.data) {
        const f = r.data.cardFees
        setValues({
          debitPercent: String(f.debitPercent),
          creditPercent: String(f.creditPercent),
          creditInstallmentPercent: String(f.creditInstallmentPercent)
        })
      }
    })
  }, [])

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!values) return
    setError(null)
    const toNumber = (text: string): number => Number(text.replace(',', '.')) || 0
    setSaving(true)
    const result = await window.api.clinicSettings.setCardFees({
      debitPercent: toNumber(values.debitPercent),
      creditPercent: toNumber(values.creditPercent),
      creditInstallmentPercent: toNumber(values.creditInstallmentPercent)
    })
    setSaving(false)
    if (!result.ok) return setError(result.error ?? 'Não foi possível salvar')
    toast.success('Taxas salvas')
  }

  if (!values) return <div className="skeleton block" />

  return (
    <div>
      <h2 className="section-title">Taxas de cartão</h2>
      <p className="subtitle">
        A taxa da maquininha é descontada de cada parcela de cartão no momento em que ela é recebida. Mudar aqui vale
        para os próximos recebimentos — o que já foi recebido não muda.
      </p>
      <form className="card settings-card" onSubmit={handleSubmit}>
        <div className="form-row three">
          {FIELDS.map((f) => (
            <label key={f.key}>
              {f.label}
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={values[f.key]}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
              <small className="muted">{f.hint}</small>
            </label>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar taxas'}
          </button>
        </div>
      </form>
    </div>
  )
}
