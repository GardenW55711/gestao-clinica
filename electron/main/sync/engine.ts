import { eq } from 'drizzle-orm'
import { getSupabase } from '../supabase/client'
import { getDb } from '../db/client'
import { clinics, staffMembers } from '../db/schema'

/**
 * Motor de sincronização v1: empurra a clínica e os funcionários pendentes
 * pra nuvem. Chamado depois de criar a clínica, depois do login, e por um
 * botão manual. Se não houver internet ou sessão na nuvem, falha em silêncio
 * e tudo continua marcado como "pending" pra tentar de novo depois — o app
 * nunca trava esperando a nuvem.
 */
export async function syncClinicAndStaff(clinicId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'Nuvem não configurada' }

  const db = getDb()

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) console.error('[sync] getSession error:', sessionError.message)
    if (!sessionData.session) return { ok: false, error: 'Sem internet ou sem sessão na nuvem' }

    const clinic = db.select().from(clinics).where(eq(clinics.id, clinicId)).get()
    if (!clinic) throw new Error('Clínica local não encontrada')

    const { error: clinicError } = await supabase.from('clinics').upsert({
      id: clinic.id,
      auth_user_id: sessionData.session.user.id,
      name: clinic.name,
      cnpj: clinic.cnpj,
      owner_email: clinic.ownerEmail,
      self_booking_enabled: clinic.selfBookingEnabled,
      created_at: clinic.createdAt,
      updated_at: clinic.updatedAt
    })
    if (clinicError) throw new Error(clinicError.message)

    const pendingStaff = db.select().from(staffMembers).where(eq(staffMembers.syncStatus, 'pending')).all()

    for (const member of pendingStaff) {
      const { error: staffError } = await supabase.from('staff_members').upsert({
        id: member.id,
        clinic_id: member.clinicId,
        name: member.name,
        role: member.role,
        pin_hash: member.pinHash,
        active: member.active,
        created_at: member.createdAt,
        updated_at: member.updatedAt,
        deleted_at: member.deletedAt
      })
      if (staffError) throw new Error(staffError.message)

      db.update(staffMembers).set({ syncStatus: 'synced' }).where(eq(staffMembers.id, member.id)).run()
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}
