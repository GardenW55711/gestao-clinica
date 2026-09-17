import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { and, eq, isNull, gte, gt, lt, ne } from 'drizzle-orm'
import { getDb } from '../db/client'
import { appointments, patients, professionals, rooms, procedureTypes } from '../db/schema'
import { getCurrentClinicId } from '../session'
import type { ApiResult, Appointment, AppointmentInput, AppointmentStatus } from '@shared/types'

function requireClinicId(): string {
  const id = getCurrentClinicId()
  if (!id) throw new Error('Nenhuma clínica logada')
  return id
}

function nowIso(): string {
  return new Date().toISOString()
}

function dayRange(dateIso: string): { start: string; end: string } {
  // dateIso no formato "AAAA-MM-DD". Usa o fuso horário local do computador
  // (o mesmo que a tela usa pra montar o horário do agendamento), não UTC —
  // senão agendamentos no fim do dia apareceriam no dia errado.
  const [y, m, d] = dateIso.split('-').map(Number)
  const start = new Date(y, m - 1, d, 0, 0, 0, 0)
  const end = new Date(y, m - 1, d, 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

/**
 * Verifica se o horário pedido bate com algum agendamento já existente do
 * mesmo profissional (e da mesma sala, se informada). Cancelados não contam.
 * Isso roda no código, não só na tela — é a garantia de verdade contra
 * agenda duplicada.
 */
function findConflict(params: {
  professionalId: string
  roomId?: string
  startAt: string
  endAt: string
  excludeId?: string
}): string | null {
  const db = getDb()
  const overlaps = and(
    lt(appointments.startAt, params.endAt),
    gt(appointments.endAt, params.startAt),
    ne(appointments.status, 'cancelled'),
    isNull(appointments.deletedAt),
    params.excludeId ? ne(appointments.id, params.excludeId) : undefined
  )

  const professionalConflict = db
    .select()
    .from(appointments)
    .where(and(eq(appointments.professionalId, params.professionalId), overlaps))
    .get()
  if (professionalConflict) return 'Este profissional já tem um agendamento nesse horário'

  if (params.roomId) {
    const roomConflict = db
      .select()
      .from(appointments)
      .where(and(eq(appointments.roomId, params.roomId), overlaps))
      .get()
    if (roomConflict) return 'Esta sala já está ocupada nesse horário'
  }

  return null
}

/**
 * Cria um agendamento de verdade (com checagem de conflito). Usada tanto
 * pelo handler de IPC normal quanto pela aprovação de pedidos vindos do
 * autoagendamento online — mesma regra de negócio nos dois casos.
 */
export function createAppointment(
  clinicId: string,
  input: AppointmentInput & { source?: 'staff' | 'patient_self' }
): Appointment {
  const db = getDb()

  const procedureType = db.select().from(procedureTypes).where(eq(procedureTypes.id, input.procedureTypeId)).get()
  if (!procedureType) throw new Error('Tipo de procedimento não encontrado')

  if (procedureType.requiresRoom && !input.roomId) {
    throw new Error('Este procedimento exige escolher uma sala')
  }

  const startAt = new Date(input.startAt)
  const endAt = new Date(startAt.getTime() + procedureType.durationMinutes * 60_000)

  const conflict = findConflict({
    professionalId: input.professionalId,
    roomId: input.roomId,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString()
  })
  if (conflict) throw new Error(conflict)

  const id = randomUUID()
  const timestamp = nowIso()

  db.insert(appointments)
    .values({
      id,
      clinicId,
      patientId: input.patientId,
      professionalId: input.professionalId,
      roomId: input.roomId ?? null,
      procedureTypeId: input.procedureTypeId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      status: 'scheduled',
      source: input.source ?? 'staff',
      notes: input.notes ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
      deletedAt: null
    })
    .run()

  const row = db
    .select()
    .from(appointments)
    .leftJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(professionals, eq(appointments.professionalId, professionals.id))
    .leftJoin(rooms, eq(appointments.roomId, rooms.id))
    .leftJoin(procedureTypes, eq(appointments.procedureTypeId, procedureTypes.id))
    .where(eq(appointments.id, id))
    .get()!

  return toAppointmentDto(row)
}

function toAppointmentDto(row: {
  appointments: typeof appointments.$inferSelect
  patients: typeof patients.$inferSelect | null
  professionals: typeof professionals.$inferSelect | null
  rooms: typeof rooms.$inferSelect | null
  procedure_types: typeof procedureTypes.$inferSelect | null
}): Appointment {
  return {
    id: row.appointments.id,
    patientId: row.appointments.patientId,
    patientName: row.patients?.name ?? '(paciente removido)',
    professionalId: row.appointments.professionalId,
    professionalName: row.professionals?.name ?? '(profissional removido)',
    roomId: row.appointments.roomId,
    roomName: row.rooms?.name ?? null,
    procedureTypeId: row.appointments.procedureTypeId,
    procedureTypeName: row.procedure_types?.name ?? '(procedimento removido)',
    startAt: row.appointments.startAt,
    endAt: row.appointments.endAt,
    status: row.appointments.status as AppointmentStatus,
    notes: row.appointments.notes
  }
}

export function registerAppointmentHandlers(): void {
  ipcMain.handle('appointments:listByDate', (_e, dateIso: string): ApiResult<Appointment[]> => {
    try {
      const db = getDb()
      const { start, end } = dayRange(dateIso)
      const rows = db
        .select()
        .from(appointments)
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(professionals, eq(appointments.professionalId, professionals.id))
        .leftJoin(rooms, eq(appointments.roomId, rooms.id))
        .leftJoin(procedureTypes, eq(appointments.procedureTypeId, procedureTypes.id))
        .where(and(gte(appointments.startAt, start), lt(appointments.startAt, end), isNull(appointments.deletedAt)))
        .all()
      return { ok: true, data: rows.map(toAppointmentDto) }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('appointments:create', (_e, input: AppointmentInput): ApiResult<Appointment> => {
    try {
      const clinicId = requireClinicId()
      return { ok: true, data: createAppointment(clinicId, input) }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(
    'appointments:setStatus',
    (_e, params: { id: string; status: AppointmentStatus }): ApiResult<null> => {
      try {
        const db = getDb()
        db.update(appointments)
          .set({ status: params.status, updatedAt: nowIso(), syncStatus: 'pending' })
          .where(eq(appointments.id, params.id))
          .run()
        return { ok: true, data: null }
      } catch (error) {
        return { ok: false, error: (error as Error).message }
      }
    }
  )
}
