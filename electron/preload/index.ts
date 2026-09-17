import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ApiResult, ClinicLoginResult, ClinicSetupInput, StaffSummary } from '@shared/types'

const api = {
  ping: (): Promise<string> => ipcRenderer.invoke('app:ping'),
  clinicExists: (): Promise<boolean> => ipcRenderer.invoke('clinic:exists'),
  clinicCreate: (input: ClinicSetupInput): Promise<ApiResult<ClinicLoginResult>> =>
    ipcRenderer.invoke('clinic:create', input),
  clinicLogin: (masterPassword: string): Promise<ApiResult<ClinicLoginResult>> =>
    ipcRenderer.invoke('clinic:login', masterPassword),
  staffVerifyPin: (staffMemberId: string, pin: string): Promise<ApiResult<StaffSummary>> =>
    ipcRenderer.invoke('staff:verifyPin', { staffMemberId, pin }),
  syncNow: (): Promise<ApiResult<null>> => ipcRenderer.invoke('sync:now')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (fallback quando contextIsolation está desligado, não é o nosso caso)
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}

export type Api = typeof api
