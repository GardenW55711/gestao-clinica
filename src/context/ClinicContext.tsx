import { createContext, useContext } from 'react'
import type { StaffSummary } from '@shared/types'

interface ClinicContextValue {
  clinicName: string
  staff: StaffSummary
}

export const ClinicContext = createContext<ClinicContextValue | null>(null)

export function useClinic(): ClinicContextValue {
  const ctx = useContext(ClinicContext)
  if (!ctx) throw new Error('useClinic precisa ser usado dentro do ClinicContext.Provider')
  return ctx
}
