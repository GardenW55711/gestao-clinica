/// <reference types="vite/client" />

import type { ElectronAPI } from '@electron-toolkit/preload'
import type { Api } from '../electron/preload/index'

// O tipo da ponte (window.api) vem direto do preload, para nunca ficar desatualizado.
declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}