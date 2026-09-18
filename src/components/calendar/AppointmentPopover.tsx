import type { Appointment } from '@shared/types'
import { STATUS_META, formatClock } from '../../utils/calendar'
import { useEscapeKey } from '../../utils/useEscapeKey'
import { Icon } from '../Icons'

interface Props {
  appt: Appointment
  anchor: DOMRect
  color: string
  onClose: () => void
  onConfirm: () => void
  onFinish: () => void
  onNoShow: () => void
  onCancel: () => void
}

const WIDTH = 340

export function AppointmentPopover({ appt, anchor, color, onClose, onConfirm, onFinish, onNoShow, onCancel }: Props): JSX.Element {
  useEscapeKey(onClose)

  const start = new Date(appt.startAt)
  const minutes = Math.round((new Date(appt.endAt).getTime() - start.getTime()) / 60000)
  const dateText = start.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const spaceRight = window.innerWidth - anchor.right
  const left = spaceRight > WIDTH + 24 ? anchor.right + 10 : Math.max(anchor.left - WIDTH - 10, 12)
  const top = Math.min(Math.max(anchor.top - 8, 12), Math.max(window.innerHeight - 420, 12))

  const open = appt.status === 'scheduled' || appt.status === 'confirmed'

  return (
    <div className="popover-layer" onClick={onClose}>
      <div
        className="popover"
        role="dialog"
        aria-label={`Agendamento de ${appt.patientName}`}
        style={{ left, top, width: WIDTH, ['--prof' as string]: color }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="popover-head">
          <span className={`status-pill status-${appt.status}`}>{STATUS_META[appt.status].label}</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={16} />
          </button>
        </div>

        <h3 className="popover-title">{appt.patientName}</h3>
        <p className="popover-proc">{appt.procedureTypeName}</p>

        <ul className="popover-info">
          <li>
            <Icon name="calendar" size={16} />
            <span>
              <span className="cap">{dateText}</span>
              <br />
              {formatClock(appt.startAt)} – {formatClock(appt.endAt)} · {minutes} min
            </span>
          </li>
          <li>
            <Icon name="professional" size={16} />
            <span>
              <span className="dot" style={{ background: color }} /> {appt.professionalName}
            </span>
          </li>
          {appt.roomName && (
            <li>
              <Icon name="room" size={16} />
              <span>{appt.roomName}</span>
            </li>
          )}
          {appt.notes && (
            <li>
              <Icon name="procedure" size={16} />
              <span>{appt.notes}</span>
            </li>
          )}
        </ul>

        {open && (
          <div className="popover-actions">
            <button type="button" onClick={onFinish}>
              <Icon name="check" size={16} />
              Finalizar atendimento
            </button>
            <div className="popover-secondary">
              {appt.status === 'scheduled' && (
                <button type="button" className="soft" onClick={onConfirm}>
                  Confirmar
                </button>
              )}
              <button type="button" className="soft" onClick={onNoShow}>
                Faltou
              </button>
              <button type="button" className="soft danger" onClick={onCancel}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
