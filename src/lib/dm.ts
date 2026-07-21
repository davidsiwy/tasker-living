// Direct messages between neighbours. Real via the messages table with realtime
// delivery when Supabase is configured, in-memory in the public demo.
import { supabase, isSupabaseConfigured } from './supabase'
import i18n from './i18n'

export interface DM { id: string; from: 'me' | 'them'; text: string; at: string }
const rid = () => 'd' + Math.random().toString(36).slice(2, 8)
const fmt = (iso?: string) => new Date(iso || Date.now()).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })

// ---- demo store ----
const store: Record<string, DM[]> = {}
const replies = () => [
  i18n.t('common:dm.reply1'), i18n.t('common:dm.reply2'), i18n.t('common:dm.reply3'),
  i18n.t('common:dm.reply4'), i18n.t('common:dm.reply5'),
]

export const dm = {
  configured: isSupabaseConfigured,

  async thread(otherUserId: string, otherName?: string): Promise<DM[]> {
    if (!isSupabaseConfigured) {
      if (!store[otherUserId]) store[otherUserId] = [{ id: rid(), from: 'them', text: i18n.t('common:dm.greeting', { name: otherName || i18n.t('common:dm.defaultNeighbor') }), at: fmt() }]
      return store[otherUserId].slice()
    }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser(); const me = auth.user?.id
    const { data, error } = await sb.from('messages')
      .select('id, sender_id, body, created_at')
      .or(`and(sender_id.eq.${me},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${me})`)
      .order('created_at', { ascending: true }).limit(200)
    if (error) throw error
    return (data || []).map((m: any) => ({ id: m.id, from: m.sender_id === me ? 'me' : 'them', text: m.body, at: fmt(m.created_at) }))
  },

  async send(buildingId: string, otherUserId: string, text: string): Promise<DM> {
    if (!isSupabaseConfigured) {
      const t = store[otherUserId] || (store[otherUserId] = [])
      const msg: DM = { id: rid(), from: 'me', text, at: fmt() }
      t.push(msg)
      setTimeout(() => { const r = replies(); t.push({ id: rid(), from: 'them', text: r[Math.floor(Math.random() * r.length)], at: fmt() }) }, 800)
      return msg
    }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const { data, error } = await sb.from('messages')
      .insert({ building_id: buildingId, sender_id: auth.user?.id, recipient_id: otherUserId, body: text })
      .select('id, created_at').single()
    if (error) throw error
    return { id: (data as any).id, from: 'me', text, at: fmt((data as any).created_at) }
  },

  // live delivery of incoming messages from one neighbour
  subscribe(myId: string, otherUserId: string, onMsg: (m: DM) => void): () => void {
    if (!isSupabaseConfigured) {
      const iv = setInterval(() => {
        const t = store[otherUserId] || []
        const last = t[t.length - 1]
        if (last && last.from === 'them') { onMsg(last); }
      }, 900)
      return () => clearInterval(iv)
    }
    const sb = supabase!
    const ch = sb.channel('dm-' + myId + '-' + otherUserId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${myId}` }, (payload: any) => {
        const m = payload.new
        if (m.sender_id === otherUserId) onMsg({ id: m.id, from: 'them', text: m.body, at: fmt(m.created_at) })
      })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  },
}
