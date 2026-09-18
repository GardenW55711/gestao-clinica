import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateStatus } from '@shared/types'

const { autoUpdater } = electronUpdater

const CHECK_EVERY_MS = 30 * 60 * 1000

let status: UpdateStatus = { state: 'idle' }

function setStatus(next: UpdateStatus): void {
  status = next
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('update:status', next)
}

async function check(): Promise<void> {
  if (!app.isPackaged) {
    setStatus({ state: 'error', message: 'Atualização automática só funciona no programa instalado' })
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    setStatus({ state: 'error', message: (err as Error).message })
  }
}

export function setupUpdater(): void {
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('update:getStatus', () => status)
  ipcMain.handle('update:check', () => check())
  ipcMain.handle('update:installNow', () => autoUpdater.quitAndInstall(false, true))

  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => setStatus({ state: 'downloading', version: info.version, percent: 0 }))
  autoUpdater.on('download-progress', (p) =>
    setStatus({ state: 'downloading', version: status.version, percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-not-available', () => setStatus({ state: 'uptodate' }))
  autoUpdater.on('update-downloaded', (info) => setStatus({ state: 'ready', version: info.version }))
  autoUpdater.on('error', (err) => setStatus({ state: 'error', message: err.message }))

  // O programa costuma ficar aberto o dia todo, então checa de tempos em tempos
  // e não só ao abrir.
  check()
  setInterval(check, CHECK_EVERY_MS)
}
