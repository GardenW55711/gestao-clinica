import { ipcMain } from 'electron'
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
  fn: (arg: A) => R
): void {
  ipcMain.handle(channel, (_event, arg: A): ApiResult<R> => {
    try {
      if (roles) requireRole(...roles)
      return { ok: true, data: fn(arg) }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })
}
