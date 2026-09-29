import { sortAlertsBySeverity } from '@shared/alerts'
import type { PatientAlertSummary } from '@shared/types'
import { Icon } from './Icons'

/** Faixa vermelha fixa de alertas de saúde — usada na ficha do paciente e no popover da agenda. */
export function AlertBanner({ alerts }: { alerts: PatientAlertSummary[] }): JSX.Element | null {
  if (alerts.length === 0) return null
  return (
    <div className="alert-banner" role="alert">
      <Icon name="alert" size={18} />
      <ul>
        {sortAlertsBySeverity(alerts).map((a) => (
          <li key={a.id} className={a.severity === 'grave' ? 'grave' : undefined}>
            {a.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
