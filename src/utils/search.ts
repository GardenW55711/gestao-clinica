import type { Patient } from '@shared/types'

/** Minúsculas e sem acentos: "João" combina com "joao". */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export const onlyDigits = (text: string | null | undefined): string => (text ?? '').replace(/\D/g, '')

/** Busca de paciente por nome, CPF ou telefone (ignora pontos, traços, parênteses e acentos). */
export function matchesPatient(patient: Patient, query: string): boolean {
  const q = query.trim()
  if (!q) return true
  if (normalizeText(patient.name).includes(normalizeText(q))) return true
  const digits = onlyDigits(q)
  if (digits.length >= 2) {
    return onlyDigits(patient.cpf).includes(digits) || onlyDigits(patient.phone).includes(digits)
  }
  return false
}
