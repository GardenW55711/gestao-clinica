import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { clinics, procedureTypes, professionals, patients, bookingRequests } from '../db/schema'
import { getCurrentClinicId } from '../session'
import { createAppointment } from './appointments'
import type { ApiResult, ClinicSettings, BookingRequestSummary } from '@shared/types'

function nowIso(): string {
  return new Date().toISOString()
}

function requireClinicId(): string {
  const id = getCurrentClinicId()
  if (!id) throw new Error('Nenhuma clínica logada')
  return id
}

export function registerBookingHandlers(): void {
  ipcMain.handle('clinic:getSettings', (): ApiResult<ClinicSettings> => {
    try {
      const db = getDb()
      const clinic = db.select().from(clinics).get()
      if (!clinic) throw new Error('Clínica não encontrada')
      return {
        ok: true,
        data: { clinicId: clinic.id, clinicName: clinic.name, selfBookingEnabled: clinic.selfBookingEnabled }
      }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('clinic:setSelfBooking', (_e, enabled: boolean): ApiResult<null> => {
    try {
      const db = getDb()
      db.update(clinics).set({ selfBookingEnabled: enabled, updatedAt: nowIso() }).run()
      return { ok: true, data: null }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(
    'procedureTypes:setBookableOnline',
    (_e, params: { id: string; enabled: boolean }): ApiResult<null> => {
      try {
        const db = getDb()
        db.update(procedureTypes)
          .set({ bookableOnline: params.enabled, updatedAt: nowIso(), syncStatus: 'pending' })
          .where(eq(procedureTypes.id, params.id))
          .run()
        return { ok: true, data: null }
      } catch (error) {
        return { ok: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle('bookingRequests:listPending', (): ApiResult<BookingRequestSummary[]> => {
    try {
      const db = getDb()
      const rows = db
        .select()
        .from(bookingRequests)
        .leftJoin(professionals, eq(bookingRequests.professionalId, professionals.id))
        .leftJoin(procedureTypes, eq(bookingRequests.procedureTypeId, procedureTypes.id))
        .where(and(eq(bookingRequests.status, 'pending_review'), isNull(bookingRequests.deletedAt)))
        .all()

      const data: BookingRequestSummary[] = rows.map((row) => ({
        id: row.booking_requests.id,
        patientName: row.booking_requests.patientName,
        patientPhone: row.booking_requests.patientPhone,
        professionalId: row.booking_requests.professionalId,
        professionalName: row.professionals?.name ?? null,
        procedureTypeId: row.booking_requests.procedureTypeId,
        procedureTypeName: row.procedure_types?.name ?? null,
        desiredStartAt: row.booking_requests.desiredStartAt,
        status: row.booking_requests.status
      }))

      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('bookingRequests:approve', (_e, id: string): ApiResult<null> => {
    try {
      const clinicId = requireClinicId()
      const db = getDb()

      const request = db.select().from(bookingRequests).where(eq(bookingRequests.id, id)).get()
      if (!request) throw new Error('Pedido não encontrado')
      if (!request.professionalId || !request.procedureTypeId) {
        throw new Error('Pedido incompleto (faltou profissional ou procedimento)')
      }

      // Tenta achar um paciente já cadastrado com o mesmo telefone; senão,
      // cria um novo cadastro a partir dos dados enviados pelo paciente.
      let patient = db.select().from(patients).where(eq(patients.phone, request.patientPhone)).get()
      const timestamp = nowIso()
      if (!patient) {
        const patientId = randomUUID()
        db.insert(patients)
          .values({
            id: patientId,
            clinicId,
            name: request.patientName,
            phone: request.patientPhone,
            email: null,
            birthDate: null,
            cpf: null,
            notes: null,
            lgpdConsentAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
            syncStatus: 'pending',
            deletedAt: null
          })
          .run()
        patient = db.select().from(patients).where(eq(patients.id, patientId)).get()!
      }

      createAppointment(clinicId, {
        patientId: patient.id,
        professionalId: request.professionalId,
        procedureTypeId: request.procedureTypeId,
        startAt: request.desiredStartAt,
        source: 'patient_self'
      })

      db.update(bookingRequests)
        .set({ status: 'accepted', updatedAt: timestamp, syncStatus: 'pending' })
        .where(eq(bookingRequests.id, id))
        .run()

      return { ok: true, data: null }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('bookingRequests:reject', (_e, id: string): ApiResult<null> => {
    try {
      const db = getDb()
      db.update(bookingRequests)
        .set({ status: 'rejected', updatedAt: nowIso(), syncStatus: 'pending' })
        .where(eq(bookingRequests.id, id))
        .run()
      return { ok: true, data: null }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })
}
