import { FormEvent, useCallback, useEffect, useState } from 'react'
import type { Professional, ScheduleBlock } from '@shared/types'
import { useFeedback } from '../../components/Feedback'
import { Icon } from '../../components/Icons'

function fmt(iso: string, allDay: boolean): string {
  const d = new Date(iso)
  return allDay
    ? d.toLocaleDateString('pt-BR')
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isAllDay(b: ScheduleBlock): boolean {
  const s = new Date(b.startAt)
  const e = new Date(b.endAt)
  return s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 23 && e.getMinutes() === 59
}

export function Bloqueios(): JSX.Element {
  const { toast, confirm } = useFeedback()
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([])
  const [loaded, setLoaded] = useState(false)

  const [professionalId, setProfessionalId] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    const [pr, bl] = await Promise.all([window.api.professionals.list(), window.api.scheduleBlocks.list()])
    if (pr.ok && pr.data) setProfessionals(pr.data.filter((p) => p.active))
    if (bl.ok && bl.data) setBlocks(bl.data)
    setLoaded(true)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    if (!start) return setError('Informe quando começa')
    const from = allDay ? `${start}T00:00:00` : start
    const to = allDay ? `${end || start}T23:59:59` : end
    if (!to) return setError('Informe quando termina')
    const result = await window.api.scheduleBlocks.create({
      professionalId: professionalId || null,
      startAt: new Date(from).toISOString(),
      endAt: new Date(to).toISOString(),
      reason
    })
    if (!result.ok) return setError(result.error ?? 'Não foi possível salvar')
    toast.success('Bloqueio criado')
    setStart('')
    setEnd('')
    setReason('')
    load()
  }

  async function remove(b: ScheduleBlock): Promise<void> {
    const ok = await confirm({
      title: 'Remover este bloqueio?',
      message: 'O horário volta a ficar livre para agendamentos.',
      confirmLabel: 'Remover',
      danger: true
    })
    if (!ok) return
    await window.api.scheduleBlocks.remove(b.id)
    toast.info('Bloqueio removido')
    load()
  }

  return (
    <div>
      <h2 className="section-title">Bloqueios da agenda</h2>
      <p className="subtitle">
        Férias, feriado, almoço de equipe, curso… O horário aparece riscado na agenda e ninguém consegue marcar nele
        (inclusive pelo autoagendamento).
      </p>

      <form className="card settings-card" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Vale para
            <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">Todos os profissionais</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Motivo
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Férias, feriado, curso..." autoComplete="off" />
          </label>
        </div>

        <label className="switch-row compact">
          <input type="checkbox" checked={allDay} onChange={(e) => { setAllDay(e.target.checked); setStart(''); setEnd('') }} />
          Dia(s) inteiro(s)
        </label>

        <div className="form-row">
          <label>
            {allDay ? 'De' : 'Início'}
            <input type={allDay ? 'date' : 'datetime-local'} value={start} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label>
            {allDay ? 'Até (opcional)' : 'Fim'}
            <input type={allDay ? 'date' : 'datetime-local'} value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} required={!allDay} />
          </label>
        </div>

        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="submit">Adicionar bloqueio</button>
        </div>
      </form>

      <table className="data-table">
        <thead>
          <tr>
            <th>Quando</th>
            <th>Vale para</th>
            <th>Motivo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {loaded &&
            blocks.map((b) => {
              const all = isAllDay(b)
              return (
                <tr key={b.id} className="row-enter">
                  <td>
                    {fmt(b.startAt, all)} → {fmt(b.endAt, all)}
                  </td>
                  <td>{b.professionalName ?? 'Todos'}</td>
                  <td>{b.reason ?? '—'}</td>
                  <td className="row-actions">
                    <button type="button" className="icon-btn danger" aria-label="Remover bloqueio" title="Remover" onClick={() => remove(b)}>
                      <Icon name="trash" size={17} />
                    </button>
                  </td>
                </tr>
              )
            })}
          {loaded && blocks.length === 0 && (
            <tr>
              <td colSpan={4}>
                <div className="empty-state">
                  <Icon name="calendar" size={34} />
                  <strong>Nenhum bloqueio</strong>
                  <span>Adicione férias, feriados ou horários indisponíveis acima.</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
