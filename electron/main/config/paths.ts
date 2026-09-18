import { app } from 'electron'

/**
 * Pasta onde ficam arquivos extras que não fazem parte do código empacotado
 * (o .env com a chave do Supabase, as migrations do banco). Em
 * desenvolvimento é a raiz do projeto; já instalado no computador do
 * usuário, é a pasta "resources" ao lado do .exe (definida pelo
 * "extraResources" do electron-builder).
 */
export function resourcesPath(): string {
  return app.isPackaged ? process.resourcesPath : app.getAppPath()
}
