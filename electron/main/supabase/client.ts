import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from '../config/env'

// O processo principal do Electron não tem um WebSocket global (isso só
// existe no navegador/renderer), mas a biblioteca do Supabase tenta criar um
// internamente mesmo sem usarmos "realtime". Este polyfill evita o erro.
if (typeof globalThis.WebSocket === 'undefined') {
  ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocket
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null
  if (!client) {
    // Sem persistSession: cada login local já garante a senha mestra, então
    // autenticamos de novo na nuvem a cada sessão em vez de guardar token.
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  }
  return client
}

/**
 * Tenta autenticar a clínica na nuvem com o mesmo e-mail/senha mestra.
 * Nunca lança erro — se estiver offline ou a nuvem não estiver configurada,
 * simplesmente retorna null e o app continua funcionando só localmente.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout após ${ms}ms`)), ms))
  ])
}

export async function signInClinic(email: string, password: string): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false
  try {
    const { data, error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }), 10000)
    if (error) console.error('[supabase] signIn error:', error.message)
    return Boolean(!error && data.session)
  } catch (err) {
    console.error('[supabase] signIn exception:', (err as Error).message)
    return false
  }
}

export async function signUpClinic(email: string, password: string): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false
  try {
    const { data, error } = await withTimeout(supabase.auth.signUp({ email, password }), 10000)
    if (error) {
      console.error('[supabase] signUp error:', error.message)
      // Se a conta já existe (ex: tentativa anterior que falhou no meio do
      // caminho), tenta logar em vez de desistir.
      return signInClinic(email, password)
    }
    if (data.session) return true
    // Sem sessão = provavelmente exige confirmação por e-mail; tenta logar
    // direto (funciona se "Confirm email" estiver desativado no projeto).
    return signInClinic(email, password)
  } catch (err) {
    console.error('[supabase] signUp exception:', (err as Error).message)
    return false
  }
}
