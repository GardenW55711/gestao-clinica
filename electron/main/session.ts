// Guarda qual clínica está logada nesta sessão do programa (um computador =
// uma clínica, mas ainda assim todo registro grava o clinic_id, pronto pra
// nuvem) e QUEM está usando (funcionário e cargo, escolhidos pelo PIN).
// Módulo simples e compartilhado entre os handlers de IPC.
import type { StaffRole } from '@shared/types'

let clinicId: string | null = null
let staffMemberId: string | null = null
let staffRole: StaffRole | null = null

export function setCurrentSession(newClinicId: string | null, newStaffMemberId: string | null = null): void {
  clinicId = newClinicId
  staffMemberId = newStaffMemberId
  staffRole = null
}

export function setCurrentStaffMember(id: string | null, role: StaffRole | null = null): void {
  staffMemberId = id
  staffRole = role
}

export function getCurrentClinicId(): string | null {
  return clinicId
}

export function getCurrentStaffMemberId(): string | null {
  return staffMemberId
}

export function getCurrentStaffRole(): StaffRole | null {
  return staffRole
}