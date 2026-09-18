import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import electronUpdater from 'electron-updater'
const { autoUpdater } = electronUpdater
import { registerIpcHandlers } from './ipc/handlers'
import { registerCatalogHandlers } from './ipc/catalog'
import { registerAppointmentHandlers } from './ipc/appointments'
import { registerInventoryHandlers } from './ipc/inventory'
import { registerSalesHandlers } from './ipc/sales'
import { registerBookingHandlers } from './ipc/booking'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.gestaoclinica.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('app:ping', () => 'pong')
  registerIpcHandlers()
  registerCatalogHandlers()
  registerAppointmentHandlers()
  registerInventoryHandlers()
  registerSalesHandlers()
  registerBookingHandlers()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Só faz sentido checar atualização na versão instalada de verdade — em
  // desenvolvimento não existe nenhuma versão publicada pra comparar.
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('[auto-update] falha ao checar atualização:', err)
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
