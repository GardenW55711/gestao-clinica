import { randomUUID } from 'crypto'
import { and, eq, gt, isNull, lt } from 'drizzle-orm'
import { getDb } from '../db/client'
import { professionalWorkingHours, professionals, scheduleBlocks } from '../db/schema'
import { EVERYONE, MANAGERS, handle, nowIso, requireClinicId } from './util'
import type {
  ProfessionalWorkingHours,
  ScheduleBlock,
  ScheduleBlockInput,
  WorkingHoursDay
} from '@shared/types'

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function isTime(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

/**
 * Confere se um atendimento cabe na agenda: fora de bloqueios (do profissional
 * ou de todos) e, quando o profissional tem horário de trabalho cadastrado,
 * dentro dele e fora do intervalo. Devolve a mensagem de erro, ou null se puder.
 * Roda no processo principal, então vale também para o autoagendamento aprovado.
 */
export function checkScheduleAllowed(professionalId: string, startIso: string, endIso: string): string | null {
  const db = getDb()

  const block = db
    .select()
    .from(scheduleBlocks)
    .where(
      and(
        isNull(scheduleBlocks.deletedAt),
        lt(scheduleBlocks.startAt, endIso),
        gt(scheduleBlocks.endAt, startIso)
      )
    )
    .all()
    .find((b) => b.professionalId === null || b.professionalId === professionalId)
  if (block) return `Horário bloqueado${block.reason ? `: ${block.reason}` : ''}`

  const days = db
    .select()
    .from(professionalWorkingHours)
    .where(and(eq(professionalWorkingHours.professionalId, professionalId), isNull(professionalWorkingHours.deletedAt)))
    .all()
  if (days.length === 0) return null // sem horário cadastrado: não restringe

  const start = new Date(startIso)
  const end = new Date(endIso)
  const day = days.find((d) => d.weekday === start.getDay())
  if (!day) return 'O profissional não atende nesse dia da semana'

  const startMin = start.getHours() * 60 + start.getMinutes()
  const endMin = end.getHours() * 60 + end.getMinutes()
  const sameDay = start.toDateString() === end.toDateString()
  if (!sameDay || startMin < toMinutes(day.startTime) || endMin > toMinutes(day.endTime)) {
    return `Fora do horário de trabalho do profissional (${day.startTime} às ${day.endTime})`
  }
  if (day.breakStart && day.breakEnd && startMin < toMinutes(day.breakEnd) && endMin > toMinutes(day.breakStart)) {
    return `Cai no intervalo do profissional (${day.breakStart} às ${day.breakEnd})`
  }
  return null
}

function dayDto(row: typeof professionalWorkingHours.$inferSelect): WorkingHoursDay {
  return {
    weekday: row.weekday,
    startTime: row.startTime,
    endTime: row.endTime,
    breakStart: row.breakStart,
    breakEnd: row.breakEnd
  }
}

export function registerScheduleHandlers(): void {
  // Horários de todos os profissionais (a agenda usa para sombrear o que está fora do expediente).
  handle('workingHours:listAll', EVERYONE, (): ProfessionalWorkingHours[] => {
    const rows = getDb()
      .select()
      .from(professionalWorkingHours)
      .where(isNull(professionalWorkingHours.deletedAt))
      .all()
    const byProfessional = new Map<string, WorkingHoursDay[]>()
    for (const row of rows) {
      const list = byProfessional.get(row.professionalId) ?? []
      list.push(dayDto(row))
      byProfessional.set(row.professionalId, list)
    }
    return [...byProfessional.entries()].map(([professionalId, days]) => ({
      professionalId,
      days: days.sort((a, b) => a.weekday - b.weekday)
    }))
  })

  // Substitui o horário semanal de um profissional (só os dias enviados ficam ativos).
  handle('workingHours:set', MANAGERS, (input: ProfessionalWorkingHours): null => {
    const clinicId = requireClinicId()
    const db = getDb()
    for (const d of input.days) {
      if (d.weekday < 0 || d.weekday > 6) throw new Error('Dia da semana inválido')
      if (!isTime(d.startTime) || !isTime(d.endTime)) throw new Error('Informe início e fim no formato HH:MM')
      if (toMinutes(d.endTime) <= toMinutes(d.startTime)) throw new Error('O fim precisa ser depois do início')
      if ((d.breakStart && !isTime(d.breakStart)) || (d.breakEnd && !isTime(d.breakEnd))) {
        throw new Error('Intervalo inválido')
      }
      if (Boolean(d.breakStart) !== Boolean(d.breakEnd)) throw new Error('Informe o início e o fim do intervalo')
      if (d.breakStart && d.breakEnd) {
        if (toMinutes(d.breakEnd) <= toMinutes(d.breakStart)) throw new Error('O fim do intervalo precisa ser depois do início')
        if (toMinutes(d.breakStart) < toMinutes(d.startTime) || toMinutes(d.breakEnd) > toMinutes(d.endTime)) {
          throw new Error('O intervalo precisa estar dentro do horário de trabalho')
        }
      }
    }

    const timestamp = nowIso()
    db.transaction((tx) => {
      const existing = tx
        .select()
        .from(professionalWorkingHours)
        .where(eq(professionalWorkingHours.professionalId, input.professionalId))
        .all()
      for (let weekday = 0; weekday <= 6; weekday++) {
        const wanted = input.days.find((d) => d.weekday === weekday)
        const row = existing.find((r) => r.weekday === weekday)
        if (wanted) {
          const values = {
            startTime: wanted.startTime,
            endTime: wanted.endTime,
            breakStart: wanted.breakStart || null,
            breakEnd: wanted.breakEnd || null,
            deletedAt: null,
            updatedAt: timestamp,
            syncStatus: 'pending'
          }
          if (row) {
            tx.update(professionalWorkingHours).set(values).where(eq(professionalWorkingHours.id, row.id)).run()
          } else {
            tx.insert(professionalWorkingHours)
              .values({
                id: randomUUID(),
                clinicId,
                professionalId: input.professionalId,
                weekday,
                createdAt: timestamp,
                ...values
              })
              .run()
          }
        } else if (row && !row.deletedAt) {
          tx.update(professionalWorkingHours)
            .set({ deletedAt: timestamp, updatedAt: timestamp, syncStatus: 'pending' })
            .where(eq(professionalWorkingHours.id, row.id))
            .run()
        }
      }
    })
    return null
  })

  handle('scheduleBlocks:list', EVERYONE, (params: { from: string; to: string } | undefined): ScheduleBlock[] => {
    const db = getDb()
    const conditions = [isNull(scheduleBlocks.deletedAt)]
    if (params) conditions.push(lt(scheduleBlocks.startAt, params.to), gt(scheduleBlocks.endAt, params.from))
    return db
      .select()
      .from(scheduleBlocks)
      .leftJoin(professionals, eq(scheduleBlocks.professionalId, professionals.id))
      .where(and(...conditions))
      .all()
      .map((row) => ({
        id: row.schedule_blocks.id,
        professionalId: row.schedule_blocks.professionalId,
        professionalName: row.professionals?.name ?? null,
        startAt: row.schedule_blocks.startAt,
        endAt: row.schedule_blocks.endAt,
        reason: row.schedule_blocks.reason
      }))
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
  })

  function validateBlock(input: ScheduleBlockInput): void {
    if (!input.startAt || !input.endAt || new Date(input.endAt) <= new Date(input.startAt)) {
      throw new Error('O fim do bloqueio precisa ser depois do início')
    }
  }

  handle('scheduleBlocks:create', MANAGERS, (input: ScheduleBlockInput): string => {
    validateBlock(input)
    const clinicId = requireClinicId()
    const id = randomUUID()
    const timestamp = nowIso()
    getDb()
      .insert(scheduleBlocks)
      .values({
        id,
        clinicId,
        professionalId: input.professionalId,
        startAt: new Date(input.startAt).toISOString(),
        endAt: new Date(input.endAt).toISOString(),
        reason: input.reason?.trim() || null,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
        deletedAt: null
      })
      .run()
    return id
  })

  handle('scheduleBlocks:remove', MANAGERS, (id: string): null => {
    getDb()
      .update(scheduleBlocks)
      .set({ deletedAt: nowIso(), updatedAt: nowIso(), syncStatus: 'pending' })
      .where(eq(scheduleBlocks.id, id))
      .run()
    return null
  })
}
