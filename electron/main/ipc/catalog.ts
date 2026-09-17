import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { eq, isNull } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { getDb } from '../db/client'
import { patients, professionals, rooms, procedureTypes } from '../db/schema'
import { getCurrentClinicId } from '../session'
import type {
  ApiResult,
  Patient,
  PatientInput,
  Professional,
  ProfessionalInput,
  Room,
  RoomInput,
  ProcedureType,
  ProcedureTypeInput
} from '@shared/types'

function nowIso(): string {
  return new Date().toISOString()
}

function requireClinicId(): string {
  const id = getCurrentClinicId()
  if (!id) throw new Error('Nenhuma clínica logada')
  return id
}

/**
 * As 4 tabelas desta fase (pacientes, profissionais, salas, tipos de
 * procedimento) seguem exatamente o mesmo formato de cadastro: criar, listar
 * (só os não-excluídos), atualizar e excluir de forma "suave". Em vez de
 * repetir os 4 handlers de IPC quatro vezes, essa função registra o padrão
 * uma vez e cada entidade só passa como transformar os dados.
 */
function registerCrud<Row extends Record<string, unknown>, Dto, Input>(opts: {
  prefix: string
  table: SQLiteTable
  toDto: (row: Row) => Dto
  toInsertValues: (id: string, clinicId: string, timestamp: string, input: Input) => Record<string, unknown>
  toUpdateValues: (timestamp: string, input: Input) => Record<string, unknown>
}): void {
  const { prefix, table, toDto, toInsertValues, toUpdateValues } = opts
  const t = table as unknown as Record<string, never> & {
    id: never
    deletedAt: never
  }

  ipcMain.handle(`${prefix}:list`, (): ApiResult<Dto[]> => {
    try {
      const db = getDb()
      const rows = db.select().from(table as never).where(isNull(t.deletedAt)).all() as Row[]
      return { ok: true, data: rows.map(toDto) }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(`${prefix}:create`, (_e, input: Input): ApiResult<Dto> => {
    try {
      const clinicId = requireClinicId()
      const db = getDb()
      const id = randomUUID()
      const timestamp = nowIso()
      db.insert(table as never)
        .values(toInsertValues(id, clinicId, timestamp, input) as never)
        .run()
      const row = db.select().from(table as never).where(eq(t.id, id)).get() as Row
      return { ok: true, data: toDto(row) }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(`${prefix}:update`, (_e, params: { id: string; input: Input }): ApiResult<Dto> => {
    try {
      const db = getDb()
      db.update(table as never)
        .set(toUpdateValues(nowIso(), params.input) as never)
        .where(eq(t.id, params.id))
        .run()
      const row = db.select().from(table as never).where(eq(t.id, params.id)).get() as Row
      return { ok: true, data: toDto(row) }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(`${prefix}:remove`, (_e, id: string): ApiResult<null> => {
    try {
      const db = getDb()
      db.update(table as never)
        .set({ deletedAt: nowIso(), updatedAt: nowIso(), syncStatus: 'pending' } as never)
        .where(eq(t.id, id))
        .run()
      return { ok: true, data: null }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })
}

export function registerCatalogHandlers(): void {
  registerCrud<typeof patients.$inferSelect, Patient, PatientInput>({
    prefix: 'patients',
    table: patients,
    toDto: (row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      birthDate: row.birthDate,
      cpf: row.cpf,
      notes: row.notes,
      lgpdConsentAt: row.lgpdConsentAt
    }),
    toInsertValues: (id, clinicId, timestamp, input) => {
      if (!input.lgpdConsent) throw new Error('É necessário registrar o aceite de uso de dados (LGPD)')
      return {
        id,
        clinicId,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        birthDate: input.birthDate ?? null,
        cpf: input.cpf ?? null,
        notes: input.notes ?? null,
        lgpdConsentAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
        deletedAt: null
      }
    },
    toUpdateValues: (timestamp, input) => ({
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      birthDate: input.birthDate ?? null,
      cpf: input.cpf ?? null,
      notes: input.notes ?? null,
      updatedAt: timestamp,
      syncStatus: 'pending'
    })
  })

  registerCrud<typeof professionals.$inferSelect, Professional, ProfessionalInput>({
    prefix: 'professionals',
    table: professionals,
    toDto: (row) => ({ id: row.id, name: row.name, specialty: row.specialty, color: row.color, active: row.active }),
    toInsertValues: (id, clinicId, timestamp, input) => ({
      id,
      clinicId,
      name: input.name,
      specialty: input.specialty ?? null,
      color: input.color ?? null,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
      deletedAt: null
    }),
    toUpdateValues: (timestamp, input) => ({
      name: input.name,
      specialty: input.specialty ?? null,
      color: input.color ?? null,
      updatedAt: timestamp,
      syncStatus: 'pending'
    })
  })

  registerCrud<typeof rooms.$inferSelect, Room, RoomInput>({
    prefix: 'rooms',
    table: rooms,
    toDto: (row) => ({ id: row.id, name: row.name, description: row.description, active: row.active }),
    toInsertValues: (id, clinicId, timestamp, input) => ({
      id,
      clinicId,
      name: input.name,
      description: input.description ?? null,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
      deletedAt: null
    }),
    toUpdateValues: (timestamp, input) => ({
      name: input.name,
      description: input.description ?? null,
      updatedAt: timestamp,
      syncStatus: 'pending'
    })
  })

  registerCrud<typeof procedureTypes.$inferSelect, ProcedureType, ProcedureTypeInput>({
    prefix: 'procedureTypes',
    table: procedureTypes,
    toDto: (row) => ({
      id: row.id,
      name: row.name,
      durationMinutes: row.durationMinutes,
      defaultPrice: row.defaultPrice,
      requiresRoom: row.requiresRoom,
      bookableOnline: row.bookableOnline,
      active: row.active
    }),
    toInsertValues: (id, clinicId, timestamp, input) => ({
      id,
      clinicId,
      name: input.name,
      durationMinutes: input.durationMinutes,
      defaultPrice: input.defaultPrice,
      requiresRoom: input.requiresRoom,
      bookableOnline: false,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
      deletedAt: null
    }),
    toUpdateValues: (timestamp, input) => ({
      name: input.name,
      durationMinutes: input.durationMinutes,
      defaultPrice: input.defaultPrice,
      requiresRoom: input.requiresRoom,
      updatedAt: timestamp,
      syncStatus: 'pending'
    })
  })
}
