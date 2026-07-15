// Supabase client. If the two env vars are set (see .env.example), the app runs
// against a real backend: real login, real feed, real data. If they are not set,
// the app runs in demo mode with in-memory mock data so it works out of the box.
//
// Forced demo: visitors from the marketing page can try the product on mock
// data even in production. A session flag flips the whole app into demo mode;
// exiting the demo clears it and reloads back into the real app.
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const DEMO_FLAG = 'tl-demo'
const forcedDemo = typeof window !== 'undefined' && (() => {
  try { return window.sessionStorage.getItem(DEMO_FLAG) === '1' } catch { return false }
})()

// true when a real backend exists at all (used to offer the way out of the demo)
export const backendAvailable = Boolean(url && key)
// true when this session should talk to the real backend
export const isSupabaseConfigured = backendAvailable && !forcedDemo
export const isForcedDemo = forcedDemo
export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(url!, key!) : null

export function enterDemo() {
  try { window.sessionStorage.setItem(DEMO_FLAG, '1') } catch { /* private mode */ }
  window.location.hash = '#/prihlaseni'
  window.location.reload()
}

export function exitDemo() {
  try { window.sessionStorage.removeItem(DEMO_FLAG) } catch { /* private mode */ }
  window.location.hash = '#/prihlaseni'
  window.location.reload()
}
