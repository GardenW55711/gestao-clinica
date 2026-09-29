import { BrowserWindow, app, dialog } from 'electron'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

/**
 * Gera um PDF a partir de HTML usando o próprio Chromium do Electron (sem
 * depender de biblioteca externa de PDF) e pede ao usuário onde salvar.
 * Reaproveitado pela anamnese (Etapa B), pelo orçamento (Etapa D) e pelos
 * documentos — receita, atestado, termos (Etapa H).
 */
export async function saveHtmlAsPdf(html: string, suggestedName: string): Promise<{ ok: boolean; path?: string; error?: string }> {
  const tmpPath = join(app.getPath('temp'), `doc-${randomUUID()}.html`)
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, offscreen: true } })
  try {
    writeFileSync(tmpPath, html, 'utf-8')
    await win.loadFile(tmpPath)
    const buffer = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } })

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Salvar PDF',
      defaultPath: suggestedName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return { ok: false, error: 'Cancelado' }

    writeFileSync(filePath, buffer)
    return { ok: true, path: filePath }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  } finally {
    win.destroy()
    try {
      unlinkSync(tmpPath)
    } catch {
      // arquivo temporário: não é crítico se não puder ser apagado agora
    }
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export interface ClinicHeaderInfo {
  name: string
  address: string | null
  phone: string | null
  logoDataUrl: string | null
}

/** Envolve o conteúdo de um documento com o cabeçalho da clínica e um visual limpo pra impressão. */
export function wrapDocumentHtml(clinic: ClinicHeaderInfo, title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 12.5px; line-height: 1.5; margin: 0; }
  header.doc-header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #2f9e6e; padding-bottom: 10px; margin-bottom: 18px; }
  header.doc-header img { width: 52px; height: 52px; object-fit: contain; border-radius: 8px; }
  header.doc-header .clinic-name { font-size: 17px; font-weight: 700; margin: 0; }
  header.doc-header .clinic-meta { font-size: 11px; color: #555; margin: 2px 0 0; }
  h1.doc-title { font-size: 16px; margin: 0 0 14px; text-transform: uppercase; letter-spacing: 0.03em; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 4px; border-bottom: 1px solid #ddd; font-size: 12px; }
  .doc-signature { margin-top: 48px; text-align: center; }
  .doc-signature .line { border-top: 1px solid #333; width: 280px; margin: 0 auto 6px; }
  .muted { color: #666; }
</style>
</head>
<body>
  <header class="doc-header">
    ${clinic.logoDataUrl ? `<img src="${clinic.logoDataUrl}" alt="" />` : ''}
    <div>
      <p class="clinic-name">${escapeHtml(clinic.name)}</p>
      <p class="clinic-meta">${[clinic.address, clinic.phone].filter((v): v is string => Boolean(v)).map(escapeHtml).join(' · ')}</p>
    </div>
  </header>
  <h1 class="doc-title">${escapeHtml(title)}</h1>
  ${bodyHtml}
</body>
</html>`
}
