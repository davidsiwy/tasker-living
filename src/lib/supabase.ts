// Supabase client. If the two env vars are set (see .env.example), the app runs
// against a real backend: real login, real feed, real data. If they are not set,
// the app runs in demo mode with in-memory mock data so it works out of the box.
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && key)
export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(url!, key!) : null
