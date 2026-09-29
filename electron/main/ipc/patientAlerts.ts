import { randomUUID } from 'crypto'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { patientAlerts } from '../db/schema'
import { EVERYONE, handle, nowIso, requireClinicId, requireClinicalAccess } from './util'
import type { PatientAlert, PatientAlertInput, PatientAlertSummary } from '@shared/types'

function toDto(row: typeof patientAlerts.$inferSelect): PatientAlert {
  return {
    id: row.id,
    text: row.text,
    severity: row.severity,
    origin: row.origin,
    active: row.active,
    createdAt: row.createdAt
  }
}

/** Alertas ativos de vários pacientes de uma vez (usado pela agenda). Ver alertas vale para todo cargo. */
export function activeAlertsByPatient(patientIds: string[]): Map<string, PatientAlertSummary[]> {
  const map = new Map<string, PatientAlertSummary[]>()
  if (patientIds.length === 0) return map
  const rows = getDb()
    .select()
    .from(patientAlerts)
    .where(and(inArray(patientAlerts.patientId, patientIds), eq(patientAlerts.active, true), isNull(patientAlerts.deletedAt)))
    .all()
  for (const row of rows) {
    const list = map.get(row.patientId) ?? []
    list.push({ id: row.id, text: row.text, severity: row.severity })
    map.set(row.patientId, list)
  }
  return map
}

export function registerPatientAlertHandlers(): void {
  // Ver os alertas (mesmo os desativados, para o histórico na ficha) vale para todo cargo.
  handle('patientAlerts:list', EVERYONE, (patientId: string): PatientAlert[] =>
    getDb()
      .select()
      .from(patientAlerts)
      .where(and(eq(patientAlerts.patientId, patientId), isNull(patientAlerts.deletedAt)))
      .all()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toDto)
  )

  // Alerta manual: só quem tem acesso clínico (o de origem "anamnese" só muda salvando uma anamnese nova).
  handle('patientAlerts:create', null, (input: PatientAlertInput): PatientAlert => {
    requireClinicalAccess()
    if (!input.text.trim()) throw new Error('Descreva o alerta')
    const clinicId = requireClinicId()
    const id = randomUUID()
    const timestamp = nowIso()
    getDb()
      .insert(patientAlerts)
      .values({
        id,
        clinicId,
        patientId: input.patientId,
        text: input.text.trim(),
        severity: input.severity,
        origin: 'manual',
        sourceRecordId: null,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
        deletedAt: null
      })
      .run()
    return toDto(getDb().select().from(patientAlerts).where(eq(patientAlerts.id, id)).get()!)
  })

  handle('patientAlerts:setActive', null, (params: { id: string; active: boolean }): null => {
    requireClinicalAccess()
    const db = getDb()
    const current = db.select().from(patientAlerts).where(eq(patientAlerts.id, params.id)).get()
    if (!current) throw new Error('Alerta não encontrado')
    if (current.origin !== 'manual') {
      throw new Error('Este alerta veio da anamnese — atualize preenchendo uma anamnese nova')
    }
    db.update(patientAlerts)
      .set({ active: params.active, updatedAt: nowIso(), syncStatus: 'pending' })
      .where(eq(patientAlerts.id, params.id))
      .run()
    return null
  })
}
