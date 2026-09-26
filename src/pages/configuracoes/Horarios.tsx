import { useEffect, useState } from 'react'
import type { Professional, WorkingHoursDay } from '@shared/types'
import { useFeedback } from '../../components/Feedback'
import { Icon } from '../../components/Icons'

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

interface DayState {
  works: boolean
  startTime: string
  endTime: string
  breakStart: string
  breakEnd: string
}

const DEFAULT_DAY: DayState = { works: false, startTime: '08:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00' }

function emptyWeek(): DayState[] {
  return WEEKDAYS.map((_, i) => ({ ...DEFAULT_DAY, works: i >= 1 && i <= 5 }))
}

export function Horarios(): JSX.Element {
  const { toast } = useFeedback()
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [professionalId, setProfessionalId] = useState('')
  const [week, setWeek] = useState<DayState[]>(emptyWeek())
  const [configured, setConfigured] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.professionals.list().then((r) => {
      if (r.ok && r.data) {
        const active = r.data.filter((p) => p.active)
        setProfessionals(active)
        if (active[0]) setProfessionalId(active[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (!professionalId) return
    window.api.workingHours.listAll().then((r) => {
      const mine = r.ok && r.data ? r.data.find((x) => x.professionalId === professionalId) : undefined
      setConfigured(Boolean(mine && mine.days.length > 0))
      const next = emptyWeek().map((d) => ({ ...d, works: false }))
      if (mine && mine.days.length > 0) {
        for (const d of mine.days) {
          next[d.weekday] = {
            works: true,
            startTime: d.startTime,
            endTime: d.endTime,
            breakStart: d.breakStart ?? '',
            breakEnd: d.breakEnd ?? ''
          }
        }
      } else {
        // Sem horário cadastrado: sugere segunda a sexta (ainda não vale até salvar).
        next.splice(0, next.length, ...emptyWeek())
      }
      setWeek(next)
      setError(null)
    })
  }, [professionalId])

  function update(index: number, patch: Partial<DayState>): void {
    setWeek((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  function copyFirstWorkingDay(): void {
    const source = week.find((d) => d.works)
    if (!source) return
    setWeek((prev) => prev.map((d) => (d.works ? { ...source, works: true } : d)))
  }

  async function save(): Promise<void> {
    setError(null)
    const days: WorkingHoursDay[] = week
      .map((d, weekday) => ({ d, weekday }))
      .filter(({ d }) => d.works)
      .map(({ d, weekday }) => ({
        weekday,
        startTime: d.startTime,
        endTime: d.endTime,
        breakStart: d.breakStart || null,
        breakEnd: d.breakEnd || null
      }))
    setSaving(true)
    const result = await window.api.workingHours.set({ professionalId, days })
    setSaving(false)
    if (!result.ok) return setError(result.error ?? 'Não foi possível salvar')
    setConfigured(days.length > 0)
    toast.success(days.length > 0 ? 'Horário salvo' : 'Horário removido — sem restrição de dias')
  }

  if (professionals.length === 0) {
    return (
      <div className="empty-state card">
        <Icon name="professional" size={34} />
        <strong>Cadastre um profissional primeiro</strong>
        <span>Em Cadastros › Profissionais.</span>
      </div>
    )
  }

  return (
    <div>
      <h2 className="section-title">Horário de trabalho</h2>
      <p className="subtitle">
        Define quando cada profissional atende. A agenda não deixa marcar fora desses horários (nem no
        autoagendamento) e a taxa de ocupação usa esses horários. Sem horário cadastrado, não há restrição.
      </p>

      <div className="card settings-card">
        <label>
          Profissional
          <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {!configured && <p className="subtitle">Ainda não configurado — o quadro abaixo é uma sugestão (seg a sex).</p>}

        <table className="hours-table">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Início</th>
              <th>Fim</th>
              <th>Intervalo (início)</th>
              <th>Intervalo (fim)</th>
            </tr>
          </thead>
          <tbody>
            {week.map((d, i) => (
              <tr key={i} className={d.works ? undefined : 'off'}>
                <td>
                  <label className="switch-row compact">
                    <input type="checkbox" checked={d.works} onChange={(e) => update(i, { works: e.target.checked })} />
                    {WEEKDAYS[i]}
                  </label>
                </td>
                <td>
                  <input type="time" value={d.startTime} disabled={!d.works} onChange={(e) => update(i, { startTime: e.target.value })} aria-label={`Início ${WEEKDAYS[i]}`} />
                </td>
                <td>
                  <input type="time" value={d.endTime} disabled={!d.works} onChange={(e) => update(i, { endTime: e.target.value })} aria-label={`Fim ${WEEKDAYS[i]}`} />
                </td>
                <td>
                  <input type="time" value={d.breakStart} disabled={!d.works} onChange={(e) => update(i, { breakStart: e.target.value })} aria-label={`Início do intervalo ${WEEKDAYS[i]}`} />
                </td>
                <td>
                  <input type="time" value={d.breakEnd} disabled={!d.works} onChange={(e) => update(i, { breakEnd: e.target.value })} aria-label={`Fim do intervalo ${WEEKDAYS[i]}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="soft-btn" onClick={copyFirstWorkingDay}>
            Copiar o 1º dia para os outros dias marcados
          </button>
          <button type="button" onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar horário'}
          </button>
        </div>
      </div>
    </div>
  )
}
