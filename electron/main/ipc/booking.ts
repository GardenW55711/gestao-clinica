import { ipcMain, app } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { clinics, procedureTypes, professionals, patients, bookingRequests } from '../db/schema'
import { getCurrentClinicId } from '../session'
import { createAppointment } from './appointments'
import { MANAGERS, NOT_PROFESSIONAL, handle, requireRole } from './util'
import type { ApiResult, CardFees, ClinicProfileInput, ClinicSettings, BookingRequestSummary } from '@shared/types'

const LOGO_MIME_BY_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }

function logoFullPath(filename: string): string {
  return join(app.getPath('userData'), filename)
}

/** Nome, endereço, telefone e logo (já em data URL) para o cabeçalho dos documentos em PDF. */
export function loadClinicHeaderInfo(): { name: string; address: string | null; phone: string | null; logoDataUrl: string | null } {
  const clinic = getDb().select().from(clinics).get()
  if (!clinic) throw new Error('Clínica não encontrada')
  let logoDataUrl: string | null = null
  if (clinic.logoPath && existsSync(logoFullPath(clinic.logoPath))) {
    const ext = clinic.logoPath.split('.').pop() ?? ''
    const mime = LOGO_MIME_BY_EXT[ext] ?? 'application/octet-stream'
    logoDataUrl = `data:${mime};base64,${readFileSync(logoFullPath(clinic.logoPath)).toString('base64')}`
  }
  return { name: clinic.name, address: clinic.address, phone: clinic.phone, logoDataUrl }
}

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
        data: {
          clinicId: clinic.id,
          clinicName: clinic.name,
          selfBookingEnabled: clinic.selfBookingEnabled,
          cardFees: {
            debitPercent: clinic.cardFeeDebitPercent,
            creditPercent: clinic.cardFeeCreditPercent,
            creditInstallmentPercent: clinic.cardFeeCreditInstallmentPercent
          },
          address: clinic.address,
          phone: clinic.phone,
          logoPath: clinic.logoPath
        }
      }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  // Endereço e telefone para o cabeçalho dos documentos em PDF (Fase 2).
  handle('clinic:setProfile', MANAGERS, (input: ClinicProfileInput): null => {
    getDb()
      .update(clinics)
      .set({ address: input.address?.trim() || null, phone: input.phone?.trim() || null, updatedAt: nowIso() })
      .run()
    return null
  })

  // Logo opcional da clínica: guardado como arquivo na pasta de dados do app
  // (não é dado sensível de paciente, então não precisa ir pro bucket privado do Storage).
  handle('clinic:setLogo', MANAGERS, (dataUrl: string | null): null => {
    const db = getDb()
    const current = db.select({ logoPath: clinics.logoPath }).from(clinics).get()
    if (current?.logoPath && existsSync(logoFullPath(current.logoPath))) {
      try {
        unlinkSync(logoFullPath(current.logoPath))
      } catch {
        // não é crítico se o arquivo antigo não puder ser apagado agora
      }
    }
    if (!dataUrl) {
      db.update(clinics).set({ logoPath: null, updatedAt: nowIso() }).run()
      return null
    }
    const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl)
    if (!match) throw new Error('Envie uma imagem PNG ou JPG')
    const ext = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase()
    const filename = `clinic-logo-${Date.now()}.${ext}`
    writeFileSync(logoFullPath(filename), Buffer.from(match[2], 'base64'))
    db.update(clinics).set({ logoPath: filename, updatedAt: nowIso() }).run()
    return null
  })

  handle('clinic:getLogoDataUrl', null, (): string | null => {
    const clinic = getDb().select({ logoPath: clinics.logoPath }).from(clinics).get()
    if (!clinic?.logoPath) return null
    const path = logoFullPath(clinic.logoPath)
    if (!existsSync(path)) return null
    const ext = clinic.logoPath.split('.').pop() ?? ''
    const mime = LOGO_MIME_BY_EXT[ext] ?? 'application/octet-stream'
    return `data:${mime};base64,${readFileSync(path).toString('base64')}`
  })

  // Taxas da maquininha (em %): valem para os recebimentos feitos daqui em diante.
  handle('clinic:setCardFees', MANAGERS, (fees: CardFees): null => {
    for (const value of [fees.debitPercent, fees.creditPercent, fees.creditInstallmentPercent]) {
      if (!(value >= 0 && value <= 100)) throw new Error('As taxas devem estar entre 0% e 100%')
    }
    getDb()
      .update(clinics)
      .set({
        cardFeeDebitPercent: fees.debitPercent,
        cardFeeCreditPercent: fees.creditPercent,
        cardFeeCreditInstallmentPercent: fees.creditInstallmentPercent,
        updatedAt: nowIso()
      })
      .run()
    return null
  })

  ipcMain.handle('clinic:setSelfBooking', (_e, enabled: boolean): ApiResult<null> => {
    try {
      requireRole(...MANAGERS)
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
      requireRole(...MANAGERS)
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
      requireRole(...NOT_PROFESSIONAL)
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
      requireRole(...NOT_PROFESSIONAL)
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
