import type { Appointment } from '@shared/types'
import { addDays, formatClock, monthGrid, startOfMonth, toDateStr } from '../../utils/calendar'

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MAX_CHIPS = 3

interface Props {
  month: Date
  appointments: Appointment[]
  todayStr: string
  colorOf: (professionalId: string) => string
  onOpenDay: (dateStr: string) => void
  onOpenAppt: (appt: Appointment, rect: DOMRect) => void
}

export function MonthGrid({ month, appointments, todayStr, colorOf, onOpenDay, onOpenAppt }: Props): JSX.Element {
  const first = startOfMonth(month)
  const { start: gridStart, weeks } = monthGrid(month)
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i))

  const byDay = new Map<string, Appointment[]>()
  for (const appt of appointments) {
    const key = toDateStr(new Date(appt.startAt))
    const list = byDay.get(key) ?? []
    list.push(appt)
    byDay.set(key, list)
  }
  for (const list of byDay.values()) list.sort((a, b) => a.startAt.localeCompare(b.startAt))

  return (
    <div className="month">
      <div className="month-head">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="month-body" style={{ gridTemplateRows: `repeat(${weeks}, minmax(96px, 1fr))` }}>
        {days.map((day) => {
          const key = toDateStr(day)
          const list = byDay.get(key) ?? []
          const outside = day.getMonth() !== first.getMonth()
          return (
            <div
              key={key}
              className={`month-cell${outside ? ' outside' : ''}${key === todayStr ? ' today' : ''}`}
              onClick={() => onOpenDay(key)}
            >
              <span className="month-daynum">{day.getDate()}</span>
              <div className="month-chips">
                {list.slice(0, MAX_CHIPS).map((appt) => (
                  <div
                    key={appt.id}
                    role="button"
                    tabIndex={0}
                    className={`month-chip status-${appt.status}`}
                    style={{ ['--prof' as string]: colorOf(appt.professionalId) }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenAppt(appt, e.currentTarget.getBoundingClientRect())
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onOpenAppt(appt, e.currentTarget.getBoundingClientRect())
                    }}
                  >
                    <span className="time">{formatClock(appt.startAt)}</span>
                    <span className="who">{appt.patientName.split(' ')[0]}</span>
                  </div>
                ))}
                {list.length > MAX_CHIPS && <span className="month-more">+{list.length - MAX_CHIPS} mais</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
