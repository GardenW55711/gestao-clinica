import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { professionals, staffMembers } from '../db/schema'
import { getCurrentStaffMemberId, getCurrentStaffRole } from '../session'
import { EVERYONE, MANAGERS, handle, nowIso, requireClinicId } from './util'
import { ownProfessionalId } from './sales'
import type { StaffInput, StaffMember, StaffRole } from '@shared/types'

const PIN_RX = /^\d{4,8}$/

function professionalLinkOf(staffId: string): string | null {
  const row = getDb()
    .select({ id: professionals.id })
    .from(professionals)
    .where(and(eq(professionals.staffMemberId, staffId), isNull(professionals.deletedAt)))
    .get()
  return row?.id ?? null
}

function toDto(row: typeof staffMembers.$inferSelect): StaffMember {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    active: row.active,
    professionalId: professionalLinkOf(row.id)
  }
}

/** Liga (ou desliga) o funcionário a um profissional da agenda. Um profissional só tem um usuário. */
function linkProfessional(staffId: string, professionalId: string | null | undefined): void {
  if (professionalId === undefined) return
  const db = getDb()
  const timestamp = nowIso()
  db.update(professionals)
    .set({ staffMemberId: null, updatedAt: timestamp, syncStatus: 'pending' })
    .where(eq(professionals.staffMemberId, staffId))
    .run()
  if (professionalId) {
    db.update(professionals)
      .set({ staffMemberId: staffId, updatedAt: timestamp, syncStatus: 'pending' })
      .where(eq(professionals.id, professionalId))
      .run()
  }
}

// Só o dono cria ou altera administradores; o dono em si não pode ser criado nem rebaixado por aqui.
function assertCanAssign(role: StaffRole): void {
  if (role === 'owner') throw new Error('A clínica tem um único dono')
  if (role === 'admin' && getCurrentStaffRole() !== 'owner') {
    throw new Error('Só o dono pode cadastrar administradores')
  }
}

export function registerStaffHandlers(): void {
  // Profissional da agenda ligado a quem está usando o programa (nulo se não houver).
  handle('staff:myProfessionalId', EVERYONE, (): string | null => ownProfessionalId())

  handle('staff:list', MANAGERS, (): StaffMember[] =>
    getDb()
      .select()
      .from(staffMembers)
      .where(isNull(staffMembers.deletedAt))
      .all()
      .map(toDto)
  )

  handle('staff:create', MANAGERS, (input: StaffInput): StaffMember => {
    const clinicId = requireClinicId()
    if (!input.name.trim()) throw new Error('Informe o nome')
    assertCanAssign(input.role)
    if (!input.pin || !PIN_RX.test(input.pin)) throw new Error('O PIN deve ter de 4 a 8 números')
    const id = randomUUID()
    const timestamp = nowIso()
    getDb()
      .insert(staffMembers)
      .values({
        id,
        clinicId,
        name: input.name.trim(),
        role: input.role,
        pinHash: bcrypt.hashSync(input.pin, 10),
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
        deletedAt: null
      })
      .run()
    linkProfessional(id, input.professionalId ?? null)
    return toDto(getDb().select().from(staffMembers).where(eq(staffMembers.id, id)).get()!)
  })

  handle('staff:update', MANAGERS, (params: { id: string; input: StaffInput }): StaffMember => {
    const db = getDb()
    const current = db.select().from(staffMembers).where(eq(staffMembers.id, params.id)).get()
    if (!current) throw new Error('Funcionário não encontrado')
    const input = params.input
    if (!input.name.trim()) throw new Error('Informe o nome')

    const isOwner = current.role === 'owner'
    if (isOwner && (input.role !== 'owner' || input.active === false)) {
      throw new Error('O dono não pode ser rebaixado nem desativado')
    }
    if (!isOwner) assertCanAssign(input.role)
    if (current.id === getCurrentStaffMemberId() && input.active === false) {
      throw new Error('Você não pode desativar o próprio usuário')
    }
    if (current.role === 'admin' && getCurrentStaffRole() !== 'owner') {
      throw new Error('Só o dono pode alterar administradores')
    }
    if (input.pin && !PIN_RX.test(input.pin)) throw new Error('O PIN deve ter de 4 a 8 números')

    db.update(staffMembers)
      .set({
        name: input.name.trim(),
        role: isOwner ? 'owner' : input.role,
        active: input.active ?? current.active,
        ...(input.pin ? { pinHash: bcrypt.hashSync(input.pin, 10) } : {}),
        updatedAt: nowIso(),
        syncStatus: 'pending'
      })
      .where(eq(staffMembers.id, params.id))
      .run()
    linkProfessional(params.id, input.professionalId)
    return toDto(db.select().from(staffMembers).where(eq(staffMembers.id, params.id)).get()!)
  })
}
