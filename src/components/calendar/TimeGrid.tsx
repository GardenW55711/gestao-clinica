import { KeyboardEvent, MouseEvent, useEffect, useRef, useState } from 'react'
import type { Appointment } from '@shared/types'
import {
  HOUR_PX,
  PX_PER_MIN,
  SNAP_MIN,
  formatClock,
  layoutOverlaps,
  minutesOfDay,
  minutesToClock
} from '../../utils/calendar'
import { Icon } from '../Icons'

export interface GridColumn {
  key: string
  title: string
  subtitle?: string
  date: string
  isToday: boolean
  dayNumber?: number
  accent?: string
  onHeaderClick?: () => void
}

interface Props {
  columns: GridColumn[]
  apptsByColumn: Map<string, Appointment[]>
  startHour: number
  endHour: number
  now: Date
  colorOf: (professionalId: string) => string
  showProfessional: boolean
  scrollKey: string
  onCreate: (column: GridColumn, time: string) => void
  onOpen: (appt: Appointment, rect: DOMRect) => void
}

export function TimeGrid({
  columns,
  apptsByColumn,
  startHour,
  endHour,
  now,
  colorOf,
  showProfessional,
  scrollKey,
  onCreate,
  onOpen
}: Props): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [ghost, setGhost] = useState<{ key: string; minutes: number } | null>(null)

  const totalMin = (endHour - startHour) * 60
  const bodyHeight = totalMin * PX_PER_MIN
  const nowMin = minutesOfDay(now)
  const nowInRange = nowMin >= startHour * 60 && nowMin <= endHour * 60
  const firstToday = columns.findIndex((c) => c.isToday)
  const hasToday = firstToday >= 0

  // Ao trocar de dia/visão, rola até o horário atual (se hoje estiver na tela) ou volta ao topo.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = hasToday && nowInRange ? (nowMin - startHour * 60) * PX_PER_MIN - 140 : 0
    el.scrollTo({ top: Math.max(target, 0), behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey])

  function minutesAt(e: MouseEvent<HTMLDivElement>): number {
    const rect = e.currentTarget.getBoundingClientRect()
    const raw = (e.clientY - rect.top) / PX_PER_MIN
    const snapped = Math.floor(raw / SNAP_MIN) * SNAP_MIN
    return startHour * 60 + Math.min(Math.max(snapped, 0), totalMin - SNAP_MIN)
  }

  function handleMove(column: GridColumn, e: MouseEvent<HTMLDivElement>): void {
    const minutes = minutesAt(e)
    setGhost((g) => (g && g.key === column.key && g.minutes === minutes ? g : { key: column.key, minutes }))
  }

  function handleKey(appt: Appointment, e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(appt, e.currentTarget.getBoundingClientRect())
    }
  }

  const template = `56px repeat(${columns.length}, minmax(${columns.length > 3 ? 96 : 150}px, 1fr))`
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)

  return (
    <div className="tg" ref={scrollRef}>
      <div className="tg-inner" style={{ ['--hour-px' as string]: `${HOUR_PX}px` }}>
        <div className="tg-head" style={{ gridTemplateColumns: template }}>
          <div className="tg-corner" />
          {columns.map((col) => (
            <div
              key={col.key}
              className={`tg-col-head${col.isToday ? ' today' : ''}${col.onHeaderClick ? ' clickable' : ''}`}
              onClick={col.onHeaderClick}
            >
              {col.dayNumber !== undefined ? (
                <>
                  <span className="dow">{col.title}</span>
                  <span className="day-number">{col.dayNumber}</span>
                </>
              ) : (
                <>
                  <span className="prof-name">
                    <span className="dot" style={{ background: col.accent }} />
                    {col.title}
                  </span>
                  {col.subtitle && <span className="dow">{col.subtitle}</span>}
                </>
              )}
            </div>
          ))}
        </div>

        <div className="tg-body" style={{ gridTemplateColumns: template }}>
          <div className="tg-gutter" style={{ height: bodyHeight }}>
            {hours.map((h) => (
              <span key={h} className="tg-hour" style={{ top: (h - startHour) * HOUR_PX }}>
                {h === startHour ? '' : `${String(h).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>

          {columns.map((col, colIndex) => {
            const placed = layoutOverlaps(apptsByColumn.get(col.key) ?? [])
            const ghostHere = ghost && ghost.key === col.key ? ghost : null
            return (
              <div
                key={col.key}
                className={col.isToday ? 'tg-col today' : 'tg-col'}
                style={{ height: bodyHeight }}
                onMouseMove={(e) => handleMove(col, e)}
                onMouseLeave={() => setGhost(null)}
                onClick={(e) => onCreate(col, minutesToClock(minutesAt(e)))}
              >
                {ghostHere && (
                  <div
                    className="tg-ghost"
                    style={{ top: (ghostHere.minutes - startHour * 60) * PX_PER_MIN, height: 30 * PX_PER_MIN }}
                  >
                    <Icon name="plus" size={13} />
                    {minutesToClock(ghostHere.minutes)}
                  </div>
                )}

                {col.isToday && nowInRange && (
                  <div className="now-line" style={{ top: (nowMin - startHour * 60) * PX_PER_MIN }}>
                    {colIndex === firstToday && <span className="now-label">{formatClock(now)}</span>}
                  </div>
                )}

                {placed.map(({ appt, col: c, cols }) => {
                  const startMin = Math.max(minutesOfDay(appt.startAt), startHour * 60)
                  const endMin = Math.min(minutesOfDay(appt.endAt) || 24 * 60, endHour * 60)
                  const top = (startMin - startHour * 60) * PX_PER_MIN
                  const height = Math.max((endMin - startMin) * PX_PER_MIN, 18)
                  const width = 100 / cols
                  return (
                    <div
                      key={appt.id}
                      role="button"
                      tabIndex={0}
                      className={`appt-block status-${appt.status}`}
                      style={{
                        top,
                        height: height - 2,
                        left: `calc(${c * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                        ['--prof' as string]: colorOf(appt.professionalId)
                      }}
                      onMouseMove={(e) => {
                        e.stopPropagation()
                        setGhost(null)
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpen(appt, e.currentTarget.getBoundingClientRect())
                      }}
                      onKeyDown={(e) => handleKey(appt, e)}
                      aria-label={`${appt.patientName}, ${appt.procedureTypeName}, ${formatClock(appt.startAt)}`}
                    >
                      <div className="appt-title">
                        {appt.status === 'completed' && <Icon name="check" size={13} />}
                        <span>{appt.patientName}</span>
                      </div>
                      {height >= 40 && (
                        <div className="appt-sub">
                          {formatClock(appt.startAt)}–{formatClock(appt.endAt)} · {appt.procedureTypeName}
                        </div>
                      )}
                      {height >= 62 && showProfessional && <div className="appt-sub">{appt.professionalName}</div>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
