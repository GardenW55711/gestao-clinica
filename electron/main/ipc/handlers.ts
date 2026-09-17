import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { eq, and, isNull } from 'drizzle-orm'
import {
  createClinicDatabase,
  openClinicDatabase,
  closeClinicDatabase,
  hasClinicSetup,
  readMeta,
  getDb
} from '../db/client'
import { clinics, staffMembers, auditLog } from '../db/schema'
import { signInClinic, signUpClinic } from '../supabase/client'
import { syncClinicAndStaff } from '../sync/engine'
import { setCurrentSession, getCurrentClinicId, setCurrentStaffMember } from '../session'
import type { ApiResult, ClinicLoginResult, ClinicSetupInput, StaffSummary } from '@shared/types'

function nowIso(): string {
  return new Date().toISOString()
}

function writeAudit(clinicId: string, staffMemberId: string | null, action: string, entity: string): void {
  getDb()
    .insert(auditLog)
    .values({
      id: randomUUID(),
      clinicId,
      staffMemberId,
      action,
      entity,
      entityId: null,
      at: nowIso(),
      details: null
    })
    .run()
}

function loadClinicLoginResult(): ClinicLoginResult {
  const db = getDb()
  const clinic = db.select().from(clinics).get()
  if (!clinic) throw new Error('Clínica não encontrada no banco local')

  const staff = db
    .select({ id: staffMembers.id, name: staffMembers.name, role: staffMembers.role })
    .from(staffMembers)
    .where(and(eq(staffMembers.active, true), isNull(staffMembers.deletedAt)))
    .all()

  return { clinicName: clinic.name, staff: staff as StaffSummary[] }
}

const SYNC_INTERVAL_MS = 60_000

export function registerIpcHandlers(): void {
  // Sincronização automática em segundo plano: tenta a cada 1 minuto sempre
  // que houver uma clínica logada. Se estiver offline, falha em silêncio e
  // tenta de novo no próximo ciclo — nunca interrompe o uso do programa.
  setInterval(() => {
    const clinicId = getCurrentClinicId()
    if (clinicId) syncClinicAndStaff(clinicId).catch(() => undefined)
  }, SYNC_INTERVAL_MS)

  ipcMain.handle('clinic:exists', (): boolean => hasClinicSetup())

  ipcMain.handle('clinic:create', (_event, input: ClinicSetupInput): ApiResult<ClinicLoginResult> => {
    try {
      if (hasClinicSetup()) throw new Error('Já existe uma clínica configurada neste computador')
      if (input.masterPassword.length < 8) {
        throw new Error('A senha mestra precisa ter pelo menos 8 caracteres')
      }

      const clinicId = randomUUID()
      const ownerId = randomUUID()
      const timestamp = nowIso()

      createClinicDatabase({
        clinicId,
        ownerEmail: input.ownerEmail,
        masterPassword: input.masterPassword
      })

      const db = getDb()

      db.insert(clinics)
        .values({
          id: clinicId,
          name: input.clinicName,
          cnpj: input.cnpj ?? null,
          ownerEmail: input.ownerEmail,
          selfBookingEnabled: false,
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .run()

      db.insert(staffMembers)
        .values({
          id: ownerId,
          clinicId,
          name: input.ownerName,
          role: 'owner',
          pinHash: bcrypt.hashSync(input.ownerPin, 10),
          active: true,
          createdAt: timestamp,
          updatedAt: timestamp,
          syncStatus: 'pending',
          deletedAt: null
        })
        .run()

      writeAudit(clinicId, ownerId, 'clinic_created', 'clinics')
      setCurrentSession(clinicId)

      // Tenta criar a conta da clínica na nuvem e subir os dados em segundo
      // plano — nunca atrasa nem trava a criação local da clínica.
      signUpClinic(input.ownerEmail, input.masterPassword)
        .then((signedUp) => (signedUp ? syncClinicAndStaff(clinicId) : undefined))
        .catch(() => undefined)

      return { ok: true, data: loadClinicLoginResult() }
    } catch (error) {
      closeClinicDatabase()
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('clinic:login', (_event, masterPassword: string): ApiResult<ClinicLoginResult> => {
    try {
      openClinicDatabase(masterPassword)
      const meta = readMeta()
      setCurrentSession(meta?.clinicId ?? null)

      if (meta) {
        signInClinic(meta.ownerEmail, masterPassword)
          .then((signedIn) => (signedIn ? syncClinicAndStaff(meta.clinicId) : undefined))
          .catch(() => undefined)
      }

      return { ok: true, data: loadClinicLoginResult() }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sync:now', async (): Promise<ApiResult<null>> => {
    const clinicId = getCurrentClinicId()
    if (!clinicId) return { ok: false, error: 'Nenhuma clínica logada' }
    const result = await syncClinicAndStaff(clinicId)
    return { ok: result.ok, error: result.error, data: null }
  })

  ipcMain.handle(
    'staff:verifyPin',
    (_event, params: { staffMemberId: string; pin: string }): ApiResult<StaffSummary> => {
      try {
        const db = getDb()
        const staff = db.select().from(staffMembers).where(eq(staffMembers.id, params.staffMemberId)).get()
        if (!staff) throw new Error('Funcionário não encontrado')

        const valid = bcrypt.compareSync(params.pin, staff.pinHash)
        if (!valid) throw new Error('PIN incorreto')

        writeAudit(staff.clinicId, staff.id, 'staff_login', 'staff_members')
        setCurrentStaffMember(staff.id)

        return { ok: true, data: { id: staff.id, name: staff.name, role: staff.role } }
      } catch (error) {
        return { ok: false, error: (error as Error).message }
      }
    }
  )
}
