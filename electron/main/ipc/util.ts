import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { auditLog, staffMembers } from '../db/schema'
import { getCurrentClinicId, getCurrentStaffMemberId, getCurrentStaffRole } from '../session'
import type { ApiResult, StaffRole } from '@shared/types'

export function nowIso(): string {
  return new Date().toISOString()
}

/** AAAA-MM-DD de hoje no fuso do computador. */
export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function requireClinicId(): string {
  const id = getCurrentClinicId()
  if (!id) throw new Error('Nenhuma clínica logada')
  return id
}

/**
 * Confere o cargo de quem está usando o programa. Vale no processo principal
 * (não só escondendo botões na tela): mesmo um bug na tela não abre uma área
 * proibida. Sem cargo definido (antes de escolher o funcionário) nada passa.
 */
export function requireRole(...allowed: StaffRole[]): StaffRole {
  const role = getCurrentStaffRole()
  if (!role || !allowed.includes(role)) {
    throw new Error('Você não tem permissão para esta ação')
  }
  return role
}

export const MANAGERS: StaffRole[] = ['owner', 'admin']
export const EVERYONE: StaffRole[] = ['owner', 'admin', 'professional', 'receptionist']
export const NOT_PROFESSIONAL: StaffRole[] = ['owner', 'admin', 'receptionist']

/**
 * Acesso clínico (Fase 2): dono e profissional sempre têm; administrador só se
 * o dono liberou (`staff_members.clinical_access`); recepção nunca. Usado para
 * anamnese completa, odontograma, plano, evolução e imagens clínicas.
 */
export function hasClinicalAccess(): boolean {
  const role = getCurrentStaffRole()
  if (role === 'owner' || role === 'professional') return true
  if (role !== 'admin') return false
  const id = getCurrentStaffMemberId()
  if (!id) return false
  const row = getDb().select({ clinicalAccess: staffMembers.clinicalAccess }).from(staffMembers).where(eq(staffMembers.id, id)).get()
  return row?.clinicalAccess ?? false
}

export function requireClinicalAccess(): void {
  requireRole(...EVERYONE)
  if (!hasClinicalAccess()) throw new Error('Você não tem acesso liberado aos dados clínicos deste paciente')
}

/**
 * Registro de auditoria (LGPD: dado de saúde é sensível). Usado para abertura
 * de prontuário, criação de registros clínicos e impressão de documentos.
 */
export function writeAudit(action: string, entity: string, entityId: string | null = null, details: string | null = null): void {
  const clinicId = getCurrentClinicId()
  if (!clinicId) return
  getDb()
    .insert(auditLog)
    .values({
      id: randomUUID(),
      clinicId,
      staffMemberId: getCurrentStaffMemberId(),
      action,
      entity,
      entityId,
      at: new Date().toISOString(),
      details
    })
    .run()
}

export function currentStaff(): { id: string | null; role: StaffRole | null } {
  return { id: getCurrentStaffMemberId(), role: getCurrentStaffRole() }
}

/**
 * Registra um handler de IPC que devolve { ok, data } ou { ok:false, error },
 * já conferindo o cargo. Evita repetir try/catch em cada handler.
 */
export function handle<A, R>(
  channel: string,
  roles: StaffRole[] | null,
  fn: (arg: A) => R | Promise<R>
): void {
  ipcMain.handle(channel, async (_event, arg: A): Promise<ApiResult<R>> => {
    try {
      if (roles) requireRole(...roles)
      return { ok: true, data: await fn(arg) }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })
}
