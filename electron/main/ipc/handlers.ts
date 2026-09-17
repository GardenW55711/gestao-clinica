import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { eq, and, isNull } from 'drizzle-orm'
import {
  createClinicDatabase,
  openClinicDatabase,
  closeClinicDatabase,
  hasClinicSetup,
  getDb
} from '../db/client'
import { clinics, staffMembers, auditLog } from '../db/schema'
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

export function registerIpcHandlers(): void {
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

      return { ok: true, data: loadClinicLoginResult() }
    } catch (error) {
      closeClinicDatabase()
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('clinic:login', (_event, masterPassword: string): ApiResult<ClinicLoginResult> => {
    try {
      openClinicDatabase(masterPassword)
      return { ok: true, data: loadClinicLoginResult() }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
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

        return { ok: true, data: { id: staff.id, name: staff.name, role: staff.role } }
      } catch (error) {
        return { ok: false, error: (error as Error).message }
      }
    }
  )
}
