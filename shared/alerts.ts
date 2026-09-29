// Regras puras sobre alertas de saúde do paciente (Fase 2 / Etapa A), para
// poder testar sem precisar do banco nem da tela.
import type { PatientAlertSeverity, PatientAlertSummary } from './types'

const SEVERITY_ORDER: Record<PatientAlertSeverity, number> = { grave: 0, atencao: 1 }

/** Mais graves primeiro (para a faixa vermelha sempre mostrar o pior caso em destaque). */
export function sortAlertsBySeverity<T extends { severity: PatientAlertSeverity }>(alerts: T[]): T[] {
  return [...alerts].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

export function hasGraveAlert(alerts: PatientAlertSummary[]): boolean {
  return alerts.some((a) => a.severity === 'grave')
}

/** Texto curto para tooltip/atenção rápida (ex.: na agenda), sem abrir a ficha. */
export function alertsSummaryText(alerts: PatientAlertSummary[], max = 3): string {
  const sorted = sortAlertsBySeverity(alerts)
  const shown = sorted.slice(0, max).map((a) => a.text)
  const rest = sorted.length - shown.length
  return rest > 0 ? `${shown.join(' · ')} (+${rest})` : shown.join(' · ')
}
