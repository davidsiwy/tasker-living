// Direct messages between neighbours. In-memory for the demo session; becomes
// real once wired to Supabase (a `messages` table keyed by the two units).
export interface DM { id: string; from: 'me' | 'them'; text: string; at: string }
const store: Record<string, DM[]> = {}
const rid = () => 'd' + Math.random().toString(36).slice(2, 8)
const now = () => new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })

export function thread(unit: string, name?: string): DM[] {
  if (!store[unit]) store[unit] = [{ id: rid(), from: 'them', text: `Dobrý den, tady ${name || 'soused'}. Klidně napište.`, at: now() }]
  return store[unit].slice()
}
export function sendDM(unit: string, text: string): DM[] {
  const t = store[unit] || (store[unit] = [])
  t.push({ id: rid(), from: 'me', text, at: now() })
  return t.slice()
}
const REPLIES = ['Díky za zprávu, ozvu se.', 'Jasně, dám vědět.', 'Super, díky!', 'Rozumím, mrknu na to.', 'OK, uvidíme se.']
export function replyDM(unit: string): DM[] {
  const t = store[unit]; if (!t) return []
  t.push({ id: rid(), from: 'them', text: REPLIES[Math.floor(Math.random() * REPLIES.length)], at: now() })
  return t.slice()
}
