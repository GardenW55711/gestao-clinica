/// <reference types="vite/client" />

import type { ElectronAPI } from '@electron-toolkit/preload'
import type { ApiResult, ClinicLoginResult, ClinicSetupInput, StaffSummary } from '@shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ping: () => Promise<string>
      clinicExists: () => Promise<boolean>
      clinicCreate: (input: ClinicSetupInput) => Promise<ApiResult<ClinicLoginResult>>
      clinicLogin: (masterPassword: string) => Promise<ApiResult<ClinicLoginResult>>
      staffVerifyPin: (staffMemberId: string, pin: string) => Promise<ApiResult<StaffSummary>>
      syncNow: () => Promise<ApiResult<null>>
    }
  }
}
