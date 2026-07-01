// Delivery layer for email, SMS and push, plus the automatic reminder schedule.
// Real when VITE_NOTIFY_API_URL points to a backend (an Edge Function calling
// SendGrid, Twilio, web-push). In demo it records everything to an in-app outbox
// so the reminder logic is visible and testable without a server.
export type Channel = 'email' | 'sms' | 'push'
export interface OutboxMsg { id: string; ts: string; channel: Channel; to: string; subject: string; body: string; kind: string; status: 'sent' | 'queued' | 'failed' }

const API = import.meta.env.VITE_NOTIFY_API_URL as string | undefined
export const notifyConfigured = Boolean(API)

// channel preferences gate delivery (wired to Settings toggles)
export const prefs: Record<Channel, boolean> = { email: true, sms: false, push: true }
export function setPref(c: Channel, on: boolean) { prefs[c] = on }

const outbox: OutboxMsg[] = []
const subs = new Set<(o: OutboxMsg[]) => void>()
export function onOutbox(fn: (o: OutboxMsg[]) => void) { subs.add(fn); fn(outbox.slice()); return () => { subs.delete(fn) } }
function emit() { const s = outbox.slice(); subs.forEach((f) => f(s)) }
export function getOutbox() { return outbox.slice() }

const rid = () => 'm-' + Math.random().toString(36).slice(2, 8)
const now = () => new Date().toLocaleString('cs-CZ')

export async function send(m: { channel: Channel; to: string; subject: string; body: string; kind?: string }): Promise<OutboxMsg> {
  const e: OutboxMsg = { id: rid(), ts: now(), channel: m.channel, to: m.to, subject: m.subject, body: m.body, kind: m.kind || 'zprava', status: prefs[m.channel] ? 'sent' : 'queued' }
  if (API && prefs[m.channel]) {
    try { await fetch(API.replace(/\/$/, '') + '/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m) }) }
    catch { e.status = 'failed' }
  }
  outbox.unshift(e); emit(); return e
}

// Reminder schedule: offsets in days relative to the due date. A daily job on the
// backend calls runReminders; here the admin can also trigger it manually.
export interface ReminderRule { id: string; offset: number; label: string; channel: Channel }
export const reminderRules: ReminderRule[] = [
  { id: 'r1', offset: -3, label: '3 dny před splatností (připomenutí)', channel: 'push' },
  { id: 'r2', offset: 0, label: 'V den splatnosti', channel: 'email' },
  { id: 'r3', offset: 3, label: '3 dny po splatnosti (1. upomínka)', channel: 'email' },
  { id: 'r4', offset: 7, label: '7 dní po splatnosti (2. upomínka)', channel: 'sms' },
]

export interface Debtor { unit: string; name: string; amount: number; vs: string; email?: string; phone?: string }
export async function runReminders(debtors: Debtor[], stage: 'nudge' | 'overdue' = 'overdue'): Promise<OutboxMsg[]> {
  const rule = stage === 'nudge' ? reminderRules[0] : reminderRules[2]
  const out: OutboxMsg[] = []
  for (const d of debtors) {
    const to = rule.channel === 'sms' ? (d.phone || '+420 6xx xxx xxx') : (d.email || `${d.unit.toLowerCase().replace(/[^a-z0-9]/g, '')}@vistapark.cz`)
    const subject = stage === 'nudge' ? `Připomenutí platby, jednotka ${d.unit}` : `Upomínka: neuhrazený nájem, jednotka ${d.unit}`
    const body = `Dobrý den, evidujeme ${stage === 'nudge' ? 'blížící se splatnost' : 'neuhrazenou platbu'} za jednotku ${d.unit} ve výši ${d.amount.toLocaleString('cs-CZ')} Kč, variabilní symbol ${d.vs}. Zaplatit můžete QR platbou přímo v aplikaci Tasker Living.`
    out.push(await send({ channel: rule.channel, to, subject, body, kind: 'upominka' }))
  }
  return out
}
