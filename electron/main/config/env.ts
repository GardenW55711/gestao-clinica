import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

function parseEnvFile(path: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!existsSync(path)) return result
  const content = readFileSync(path, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    result[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
  }
  return result
}

const parsed = parseEnvFile(join(app.getAppPath(), '.env'))

export const SUPABASE_URL = parsed.SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = parsed.SUPABASE_ANON_KEY ?? ''
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
