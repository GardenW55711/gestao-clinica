import Database from 'better-sqlite3-multiple-ciphers'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { app } from 'electron'
import { join } from 'path'
import { scryptSync, randomBytes } from 'crypto'
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import * as schema from './schema'
import { resourcesPath } from '../config/paths'

const MAX_BACKUPS = 10

const KEY_LENGTH = 32 // 256 bits — tamanho de chave recomendado para os cifradores suportados

interface LocalMeta {
  clinicId: string
  ownerEmail: string
  kdfSalt: string // hex — usado para transformar a senha mestra numa chave binária, nunca guardamos a senha em si
}

function metaPath(): string {
  return join(app.getPath('userData'), 'clinic-meta.json')
}

function dbPath(): string {
  return join(app.getPath('userData'), 'clinic.db')
}

function migrationsFolder(): string {
  return join(resourcesPath(), 'drizzle')
}

function backupsFolder(): string {
  return join(app.getPath('userData'), 'backups')
}

/**
 * Guarda uma cópia do banco (ainda criptografado) antes de qualquer operação
 * arriscada, tipo aplicar migrações numa atualização de versão. Mantém só as
 * últimas cópias pra não acumular espaço em disco. Isso é uma rede de
 * segurança local — o backup de verdade continua sendo a nuvem.
 */
function backupDatabaseFile(): void {
  if (!existsSync(dbPath())) return
  const dir = backupsFolder()
  mkdirSync(dir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  try {
    copyFileSync(dbPath(), join(dir, `clinic-${stamp}.db`))
  } catch (err) {
    console.error('[backup] falha ao copiar banco local:', err)
    return
  }

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => ({ name: f, mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)

  for (const old of files.slice(MAX_BACKUPS)) {
    try {
      unlinkSync(join(dir, old.name))
    } catch {
      // não é crítico se uma cópia antiga não puder ser apagada agora
    }
  }
}

export function hasClinicSetup(): boolean {
  return existsSync(metaPath()) && existsSync(dbPath())
}

export function readMeta(): LocalMeta | null {
  if (!existsSync(metaPath())) return null
  return JSON.parse(readFileSync(metaPath(), 'utf-8'))
}

function writeMeta(meta: LocalMeta): void {
  writeFileSync(metaPath(), JSON.stringify(meta, null, 2), 'utf-8')
}

// scrypt transforma a senha mestra digitada pelo usuário numa chave binária
// de 256 bits. É uma função "lenta de propósito", o que dificulta ataques de
// força bruta caso alguém roube o arquivo do banco.
function deriveKey(masterPassword: string, saltHex: string): Buffer {
  const salt = Buffer.from(saltHex, 'hex')
  return scryptSync(masterPassword, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 })
}

let currentDb: BetterSQLite3Database<typeof schema> | null = null
let currentRaw: InstanceType<typeof Database> | null = null

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!currentDb) throw new Error('Banco local ainda não foi aberto (faça login primeiro)')
  return currentDb
}

/** Cria o banco local criptografado pela primeira vez (fluxo de "criar clínica"). */
export function createClinicDatabase(params: {
  clinicId: string
  ownerEmail: string
  masterPassword: string
}): void {
  const saltHex = randomBytes(16).toString('hex')
  const key = deriveKey(params.masterPassword, saltHex)

  const raw = new Database(dbPath())
  raw.key(key)
  raw.pragma('journal_mode = WAL')

  const db = drizzle(raw, { schema })
  migrate(db, { migrationsFolder: migrationsFolder() })

  currentRaw = raw
  currentDb = db

  writeMeta({ clinicId: params.clinicId, ownerEmail: params.ownerEmail, kdfSalt: saltHex })
}

/**
 * Abre o banco já existente usando a senha mestra digitada no login.
 * A própria tentativa de leitura funciona como verificação de senha: se a
 * senha estiver errada, a chave derivada é outra e a leitura falha.
 */
export function openClinicDatabase(masterPassword: string): void {
  const meta = readMeta()
  if (!meta) throw new Error('Nenhuma clínica configurada neste computador ainda')

  const key = deriveKey(masterPassword, meta.kdfSalt)
  const raw = new Database(dbPath())
  raw.key(key)

  try {
    raw.prepare('SELECT COUNT(*) FROM clinics').get()
  } catch {
    raw.close()
    throw new Error('Senha mestra incorreta')
  }

  // Faz uma cópia de segurança antes de mexer no banco (migrações rodam a
  // seguir). Se algo der errado, a cópia mais recente fica em "backups/".
  raw.close()
  backupDatabaseFile()
  const rawAfterBackup = new Database(dbPath())
  rawAfterBackup.key(key)

  const db = drizzle(rawAfterBackup, { schema })
  // Aplica migrações novas (ex: colunas adicionadas em fases mais recentes)
  // em bancos de clínicas que já existiam antes dessas mudanças.
  migrate(db, { migrationsFolder: migrationsFolder() })

  currentRaw = rawAfterBackup
  currentDb = db
}

export function closeClinicDatabase(): void {
  currentRaw?.close()
  currentRaw = null
  currentDb = null
}
