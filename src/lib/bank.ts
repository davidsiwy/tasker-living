// Napojení na banku (Fio) z klienta. Token se jen zapisuje (upsert bez
// returning) — přečíst ho z prohlížeče nejde, RLS na bank_connections nemá
// žádnou SELECT policy. Stav vrací RPC bez tokenu.
import { supabase, isSupabaseConfigured } from './supabase'

export interface BankStatus {
  bank: string; enabled: boolean; lastSync: string | null
  lastResult: { matched?: number; review?: number; unmatched?: number; fresh?: number; at?: string } | null
  reviewCount: number
}
export interface BankTx {
  id: string; date: string; amount: number; vs: string; counter: string; message: string; status: string
}

const FN_URL = ((import.meta.env.VITE_SUPABASE_URL as string) || '') + '/functions/v1/bank-sync'
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''

export const bank = {
  available: isSupabaseConfigured,

  async status(buildingId: string): Promise<BankStatus | null> {
    if (!isSupabaseConfigured) return null
    const { data, error } = await supabase!.rpc('bank_connection_status', { p_building: buildingId })
    if (error) throw error
    const r = Array.isArray(data) ? data[0] : data
    if (!r) return null
    return { bank: r.bank, enabled: r.enabled, lastSync: r.last_sync, lastResult: r.last_result, reviewCount: Number(r.review_count) || 0 }
  },

  async save(buildingId: string, token: string, enabled = true): Promise<void> {
    const { error } = await supabase!.from('bank_connections')
      .upsert({ building_id: buildingId, bank: 'fio', token: token.trim(), enabled }, { onConflict: 'building_id' })
    if (error) throw error
  },

  async setEnabled(buildingId: string, enabled: boolean): Promise<void> {
    const { error } = await supabase!.from('bank_connections').update({ enabled }).eq('building_id', buildingId)
    if (error) throw error
  },

  async disconnect(buildingId: string): Promise<void> {
    const { error } = await supabase!.from('bank_connections').delete().eq('building_id', buildingId)
    if (error) throw error
  },

  async syncNow(buildingId: string): Promise<{ matched: number; review: number; unmatched: number; fresh: number }> {
    const { data } = await supabase!.auth.getSession()
    const token = data.session?.access_token
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + token },
      body: JSON.stringify({ building_id: buildingId }),
    })
    const out = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(out.error || 'Synchronizace selhala')
    return out
  },

  async reviewList(buildingId: string): Promise<BankTx[]> {
    const { data, error } = await supabase!.from('bank_txs')
      .select('id, tx_date, amount, vs, counter_account, message, status')
      .eq('building_id', buildingId).in('status', ['review', 'unmatched'])
      .order('tx_date', { ascending: false }).limit(60)
    if (error) throw error
    return (data || []).map((t: any) => ({
      id: t.id, date: t.tx_date || '', amount: Number(t.amount), vs: t.vs || '',
      counter: t.counter_account || '', message: t.message || '', status: t.status,
    }))
  },

  async resolve(txId: string, chargeId: string): Promise<void> {
    const { error } = await supabase!.rpc('resolve_bank_tx', { p_tx: txId, p_charge: chargeId })
    if (error) throw error
  },

  async dismiss(txId: string): Promise<void> {
    const { error } = await supabase!.rpc('dismiss_bank_tx', { p_tx: txId })
    if (error) throw error
  },
}
