import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFeedback } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { NewAppointmentForm } from '../components/NewAppointmentForm'
import { CompleteAppointmentModal } from '../components/CompleteAppointmentModal'
import { TimeGrid, type GridColumn } from '../components/calendar/TimeGrid'
import { MonthGrid } from '../components/calendar/MonthGrid'
import { AppointmentPopover } from '../components/calendar/AppointmentPopover'
import {
  DEFAULT_END_HOUR,
  DEFAULT_START_HOUR,
  STATUS_META,
  STATUS_ORDER,
  addDays,
  addMonths,
  fromDateStr,
  loadPref,
  minutesOfDay,
  monthGrid,
  professionalColor,
  savePref,
  startOfWeek,
  toDateStr,
  type CalendarView
} from '../utils/calendar'
import type {
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  Patient,
  Professional,
  ProcedureType,
  Room,
  StockUsageItem
} from '@shared/types'

const VIEW_LABELS: Record<CalendarView, string> = { day: 'Dia', week: 'Semana', month: 'Mês' }

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

function rangeFor(view: CalendarView, cursor: Date): { from: Date; to: Date } {
  if (view === 'day') return { from: cursor, to: cursor }
  if (view === 'week') {
    const start = startOfWeek(cursor)
    return { from: start, to: addDays(start, 6) }
  }
  const { start, weeks } = monthGrid(cursor)
  return { from: start, to: addDays(start, weeks * 7 - 1) }
}

function titleFor(view: CalendarView, cursor: Date): string {
  if (view === 'day') {
    return capitalize(cursor.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
  }
  if (view === 'week') {
    const start = startOfWeek(cursor)
    const end = addDays(start, 6)
    const sameMonth = start.getMonth() === end.getMonth()
    const left = start.toLocaleDateString('pt-BR', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
    const right = end.toLocaleDateString('pt-BR', { day: 'numeric', month: sameMonth ? 'long' : 'short', year: 'numeric' })
    return `${left.replace('.', '')} – ${right.replace('.', '')}`
  }
  return capitalize(cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))
}

export function Agenda(): JSX.Element {
  const { toast, confirm } = useFeedback()

  const [view, setView] = useState<CalendarView>(() => loadPref<CalendarView>('agenda.view', 'day'))
  const [cursor, setCursor] = useState<Date>(() => fromDateStr(toDateStr(new Date())))
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [hiddenStatuses, setHiddenStatuses] = useState<AppointmentStatus[]>(() =>
    loadPref<AppointmentStatus[]>('agenda.hiddenStatuses', ['cancelled'])
  )
  const [hiddenProfs, setHiddenProfs] = useState<string[]>(() => loadPref<string[]>('agenda.hiddenProfs', []))
  const [now, setNow] = useState(() => new Date())
  const [popover, setPopover] = useState<{ appt: Appointment; rect: DOMRect } | null>(null)
  const [formSlot, setFormSlot] = useState<{ date: string; professionalId: string; time: string } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [completing, setCompleting] = useState<Appointment | null>(null)
  const [loaded, setLoaded] = useState(false)
  const requestId = useRef(0)

  const cursorStr = toDateStr(cursor)
  const todayStr = toDateStr(now)

  const load = useCallback(async (): Promise<void> => {
    const { from, to } = rangeFor(view, cursor)
    const id = ++requestId.current
    const result = await window.api.appointments.listRange(toDateStr(from), toDateStr(to))
    if (id !== requestId.current) return
    if (result.ok && result.data) setAppointments(result.data)
    setLoaded(true)
  }, [view, cursor])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    window.api.professionals.list().then((r) => r.ok && r.data && setProfessionals(r.data.filter((p) => p.active)))
    window.api.patients.list().then((r) => r.ok && r.data && setPatients(r.data))
    window.api.procedureTypes.list().then((r) => r.ok && r.data && setProcedureTypes(r.data.filter((p) => p.active)))
    window.api.rooms.list().then((r) => r.ok && r.data && setRooms(r.data.filter((rm) => rm.active)))
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => savePref('agenda.view', view), [view])
  useEffect(() => savePref('agenda.hiddenStatuses', hiddenStatuses), [hiddenStatuses])
  useEffect(() => savePref('agenda.hiddenProfs', hiddenProfs), [hiddenProfs])

  const colorMap = useMemo(
    () => new Map(professionals.map((p, i) => [p.id, professionalColor(p, i)])),
    [professionals]
  )
  const colorOf = useCallback((id: string) => colorMap.get(id) ?? '#2f9e6e', [colorMap])

  const visibleProfessionals = professionals.filter((p) => !hiddenProfs.includes(p.id))
  const byProfessional = appointments.filter((a) => !hiddenProfs.includes(a.professionalId))
  const visible = byProfessional.filter((a) => !hiddenStatuses.includes(a.status))
  const statusCount = (s: AppointmentStatus): number => byProfessional.filter((a) => a.status === s).length

  // ---------- navegação ----------
  function shift(direction: 1 | -1): void {
    setCursor((c) => (view === 'day' ? addDays(c, direction) : view === 'week' ? addDays(c, 7 * direction) : addMonths(c, direction)))
  }

  function goToday(): void {
    setCursor(fromDateStr(toDateStr(new Date())))
  }

  function changeView(next: CalendarView): void {
    setView(next)
  }

  function openDay(dateStr: string): void {
    setCursor(fromDateStr(dateStr))
    setView('day')
  }

  // Atalhos: setas mudam o período, T = hoje, D/S/M = visão (fora de campos de texto e janelas)
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const tag = (e.target as HTMLElement).tagName
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || formSlot || completing || popover || e.ctrlKey || e.metaKey) return
      if (e.key === 'ArrowLeft') shift(-1)
      else if (e.key === 'ArrowRight') shift(1)
      else if (e.key.toLowerCase() === 't') goToday()
      else if (e.key.toLowerCase() === 'd') changeView('day')
      else if (e.key.toLowerCase() === 's') changeView('week')
      else if (e.key.toLowerCase() === 'm') changeView('month')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---------- criação ----------
  function openNew(): void {
    const isToday = cursorStr === todayStr
    const base = isToday ? Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 30) * 30 : DEFAULT_START_HOUR * 60
    const minutes = Math.min(Math.max(base, DEFAULT_START_HOUR * 60), (DEFAULT_END_HOUR - 1) * 60 + 30)
    const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
    setFormError(null)
    setFormSlot({ date: cursorStr, professionalId: (visibleProfessionals[0] ?? professionals[0])?.id ?? '', time })
  }

  function handleGridCreate(column: GridColumn, time: string): void {
    setFormError(null)
    setPopover(null)
    setFormSlot({
      date: column.date,
      professionalId: view === 'day' ? column.key : (visibleProfessionals[0]?.id ?? ''),
      time
    })
  }

  async function handleCreate(input: AppointmentInput): Promise<void> {
    const result = await window.api.appointments.create(input)
    if (!result.ok) {
      setFormError(result.error ?? 'Não foi possível agendar')
      return
    }
    setFormError(null)
    setFormSlot(null)
    toast.success('Agendamento criado')
    load()
  }

  // ---------- ações no agendamento ----------
  async function changeStatus(appt: Appointment, status: AppointmentStatus, message: string): Promise<void> {
    setPopover(null)
    await window.api.appointments.setStatus(appt.id, status)
    toast.success(message)
    load()
  }

  async function handleNoShow(appt: Appointment): Promise<void> {
    const ok = await confirm({
      title: 'Marcar como falta?',
      message: `${appt.patientName} não compareceu. O horário continua ocupado.`,
      confirmLabel: 'Marcar falta'
    })
    if (ok) changeStatus(appt, 'no_show', 'Marcado como falta')
  }

  async function handleCancel(appt: Appointment): Promise<void> {
    const ok = await confirm({
      title: 'Cancelar este agendamento?',
      message: 'O horário volta a ficar livre na agenda.',
      confirmLabel: 'Cancelar agendamento',
      danger: true
    })
    if (ok) changeStatus(appt, 'cancelled', 'Agendamento cancelado')
  }

  async function handleConfirmComplete(usedItems: StockUsageItem[]): Promise<void> {
    if (!completing) return
    const result = await window.api.appointments.complete(completing.id, usedItems)
    if (!result.ok) throw new Error(result.error ?? 'Não foi possível finalizar')
    setCompleting(null)
    toast.success(usedItems.length > 0 ? 'Atendimento finalizado e estoque atualizado' : 'Atendimento finalizado')
    load()
  }

  // ---------- montagem das colunas ----------
  const { startHour, endHour } = useMemo(() => {
    let s = DEFAULT_START_HOUR
    let e = DEFAULT_END_HOUR
    for (const a of visible) {
      s = Math.min(s, Math.floor(minutesOfDay(a.startAt) / 60))
      e = Math.max(e, Math.ceil((minutesOfDay(a.endAt) || 24 * 60) / 60))
    }
    return { startHour: s, endHour: Math.min(e, 24) }
  }, [visible])

  const { columns, apptsByColumn } = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    let cols: GridColumn[] = []

    if (view === 'day') {
      cols = visibleProfessionals.map((p) => ({
        key: p.id,
        title: p.name,
        subtitle: p.specialty ?? undefined,
        date: cursorStr,
        isToday: cursorStr === todayStr,
        accent: colorOf(p.id)
      }))
      for (const c of cols) map.set(c.key, [])
      for (const a of visible) map.get(a.professionalId)?.push(a)
    } else if (view === 'week') {
      const start = startOfWeek(cursor)
      cols = Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i)
        const key = toDateStr(d)
        return {
          key,
          title: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
          date: key,
          isToday: key === todayStr,
          dayNumber: d.getDate(),
          onHeaderClick: () => openDay(key)
        }
      })
      for (const c of cols) map.set(c.key, [])
      for (const a of visible) map.get(toDateStr(new Date(a.startAt)))?.push(a)
    }
    return { columns: cols, apptsByColumn: map }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cursor, visible, visibleProfessionals.length, colorOf, todayStr])

  const selectedProcedure = completing ? procedureTypes.find((p) => p.id === completing.procedureTypeId) : undefined
  const scrollKey = `${view}|${cursorStr}`

  if (loaded && professionals.length === 0) {
    return (
      <div>
        <h1>Agenda</h1>
        <div className="empty-state card">
          <Icon name="calendar" size={36} />
          <strong>Cadastre um profissional para começar</strong>
          <span>Depois é só clicar em um horário da agenda para marcar o primeiro atendimento.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="agenda-page">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button type="button" className="soft-btn" onClick={goToday}>
            Hoje
          </button>
          <div className="nav-arrows">
            <button type="button" className="icon-btn" aria-label="Anterior" onClick={() => shift(-1)}>
              <Icon name="chevronLeft" size={18} />
            </button>
            <button type="button" className="icon-btn" aria-label="Próximo" onClick={() => shift(1)}>
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
          <h2 className="cal-title" key={`${view}${cursorStr}`}>
            {titleFor(view, cursor)}
          </h2>
          <input
            type="date"
            className="date-jump"
            aria-label="Ir para a data"
            value={cursorStr}
            onChange={(e) => e.target.value && setCursor(fromDateStr(e.target.value))}
          />
        </div>

        <div className="cal-actions">
          <div className="period-picker" role="group" aria-label="Visão do calendário">
            {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => (
              <button
                key={v}
                type="button"
                className={v === view ? 'period-btn active' : 'period-btn'}
                onClick={() => changeView(v)}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
          <button type="button" className="with-icon" onClick={openNew}>
            <Icon name="plus" size={18} />
            Novo agendamento
          </button>
        </div>
      </div>

      <div className="cal-filters">
        <div className="chips-row" aria-label="Profissionais">
          {professionals.map((p) => {
            const active = !hiddenProfs.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                className={active ? 'filter-chip active' : 'filter-chip'}
                style={{ ['--c' as string]: colorOf(p.id) }}
                onClick={() => setHiddenProfs((prev) => (active ? [...prev, p.id] : prev.filter((id) => id !== p.id)))}
              >
                <span className="dot" />
                {p.name}
              </button>
            )
          })}
        </div>

        <div className="chips-row legend" aria-label="Status">
          {STATUS_ORDER.map((s) => {
            const active = !hiddenStatuses.includes(s)
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                className={`filter-chip status-${s}${active ? ' active' : ''}`}
                onClick={() => setHiddenStatuses((prev) => (active ? [...prev, s] : prev.filter((x) => x !== s)))}
              >
                <span className="dot" />
                {STATUS_META[s].label}
                <small>{statusCount(s)}</small>
              </button>
            )
          })}
        </div>
      </div>

      <div className="cal-stage page-enter" key={view}>
        {view === 'month' ? (
          <MonthGrid
            month={cursor}
            appointments={visible}
            todayStr={todayStr}
            colorOf={colorOf}
            onOpenDay={openDay}
            onOpenAppt={(appt, rect) => setPopover({ appt, rect })}
          />
        ) : columns.length === 0 ? (
          <div className="empty-state card">
            <Icon name="professional" size={34} />
            <strong>Nenhum profissional selecionado</strong>
            <span>Marque ao menos um profissional acima para ver a agenda.</span>
          </div>
        ) : (
          <TimeGrid
            columns={columns}
            apptsByColumn={apptsByColumn}
            startHour={startHour}
            endHour={endHour}
            now={now}
            colorOf={colorOf}
            showProfessional={view === 'week'}
            scrollKey={scrollKey}
            onCreate={handleGridCreate}
            onOpen={(appt, rect) => setPopover({ appt, rect })}
          />
        )}
      </div>

      {popover && (
        <AppointmentPopover
          appt={popover.appt}
          anchor={popover.rect}
          color={colorOf(popover.appt.professionalId)}
          onClose={() => setPopover(null)}
          onConfirm={() => changeStatus(popover.appt, 'confirmed', 'Agendamento confirmado')}
          onFinish={() => {
            setCompleting(popover.appt)
            setPopover(null)
          }}
          onNoShow={() => handleNoShow(popover.appt)}
          onCancel={() => handleCancel(popover.appt)}
        />
      )}

      {formSlot && (
        <NewAppointmentForm
          date={formSlot.date}
          professionalId={formSlot.professionalId}
          time={formSlot.time}
          professionals={professionals}
          patients={patients}
          procedureTypes={procedureTypes}
          rooms={rooms}
          error={formError}
          onCancel={() => {
            setFormSlot(null)
            setFormError(null)
          }}
          onSubmit={handleCreate}
        />
      )}

      {completing && (
        <CompleteAppointmentModal
          appointment={completing}
          procedure={selectedProcedure}
          onCancel={() => setCompleting(null)}
          onConfirm={handleConfirmComplete}
        />
      )}
    </div>
  )
}
