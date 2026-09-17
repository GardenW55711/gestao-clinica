// Guarda qual clínica está logada nesta sessão do programa (um computador =
// uma clínica, mas ainda assim todo registro grava o clinic_id, pronto pra
// nuvem). Módulo simples e compartilhado entre os handlers de IPC.
let clinicId: string | null = null
let staffMemberId: string | null = null

export function setCurrentSession(newClinicId: string | null, newStaffMemberId: string | null = null): void {
  clinicId = newClinicId
  staffMemberId = newStaffMemberId
}

export function setCurrentStaffMember(id: string | null): void {
  staffMemberId = id
}

export function getCurrentClinicId(): string | null {
  return clinicId
}

export function getCurrentStaffMemberId(): string | null {
  return staffMemberId
}
