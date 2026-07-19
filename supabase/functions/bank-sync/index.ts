// Bankovní synchronizace (v1: Fio). Volá se s uživatelským JWT; smí výbor,
// developer domu nebo operátor platformy. Token banky čte jen tahle funkce
// přes service role — do prohlížeče nikdy neodchází.
//
// Párování: příchozí platba (objem > 0) se páruje na nezaplacený předpis domu
// se stejným VS a přesnou částkou. Jediná shoda -> předpis zaplacen.
// VS sedí, částka ne (nebo víc kandidátů) -> 'review'. Nic -> 'unmatched'.
// Každý pohyb se zpracuje jen jednou (unikát building_id + tx_id).
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

import { parseFioTransactions, matchPlan } from './matcher.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await caller.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Nepřihlášený požadavek' }, 401)
    const uid = userData.user.id

    const body = await req.json().catch(() => ({}))
    const buildingId = String(body.building_id || '')
    if (!buildingId) return json({ error: 'Chybí building_id' }, 400)

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // práva: operátor, nebo výbor/developer daného domu
    const [{ data: pa }, { data: mem }] = await Promise.all([
      admin.from('platform_admins').select('user_id').eq('user_id', uid).maybeSingle(),
      admin.from('memberships').select('role').eq('user_id', uid).eq('building_id', buildingId).in('role', ['vybor', 'developer']).maybeSingle(),
    ])
    if (!pa && !mem) return json({ error: 'Nedostatečná práva' }, 403)

    const { data: conn } = await admin.from('bank_connections').select('bank, token, enabled, last_sync').eq('building_id', buildingId).maybeSingle()
    if (!conn) return json({ error: 'Banka není napojená' }, 404)
    if (!conn.enabled) return json({ error: 'Napojení je vypnuté' }, 400)

    // okno: od posledního syncu minus 3 dny (jistota), max 60 dní zpět
    const now = new Date()
    const from = conn.last_sync ? new Date(new Date(conn.last_sync).getTime() - 3 * 86400e3) : new Date(now.getTime() - 30 * 86400e3)
    const minFrom = new Date(now.getTime() - 60 * 86400e3)
    const f = (d: Date) => d.toISOString().slice(0, 10)
    const fromS = f(from < minFrom ? minFrom : from)

    const url = `https://fioapi.fio.cz/v1/rest/periods/${conn.token}/${fromS}/${f(now)}/transactions.json`
    const res = await fetch(url)
    if (res.status === 409) return json({ error: 'Fio dovoluje 1 dotaz za 30 s, zkuste to za chvíli' }, 429)
    if (res.status === 500 || res.status === 404) return json({ error: 'Fio odmítlo token. Zkontrolujte, že je platný a jen pro čtení.' }, 400)
    if (!res.ok) return json({ error: 'Fio API vrátilo ' + res.status }, 502)
    const payload = await res.json().catch(() => null)
    if (!payload) return json({ error: 'Neplatná odpověď Fio' }, 502)

    const txs = parseFioTransactions(payload).filter((t) => t.amount > 0)

    // které už známe
    const { data: known } = await admin.from('bank_txs').select('tx_id').eq('building_id', buildingId)
    const knownIds = new Set((known || []).map((k: any) => k.tx_id))
    const fresh = txs.filter((t) => !knownIds.has(t.txId))

    const { data: open } = await admin.from('charges').select('id, vs, amount').eq('building_id', buildingId).neq('status', 'paid')
    const plan = matchPlan(fresh, (open || []) as any)

    let matched = 0, review = 0, unmatched = 0
    for (const t of fresh) {
      const p = plan[t.txId] || { status: 'unmatched' as const }
      if (p.status === 'matched' && p.chargeId) {
        await admin.from('charges').update({ status: 'paid', paid_at: (t.date || f(now)) + 'T12:00:00Z' }).eq('id', p.chargeId)
        matched++
      } else if (p.status === 'review') review++
      else unmatched++
      await admin.from('bank_txs').insert({
        building_id: buildingId, tx_id: t.txId, tx_date: t.date, amount: t.amount, vs: t.vs || null,
        counter_account: t.counter || null, message: t.message || null,
        status: p.status, matched_charge: p.chargeId || null, raw: t.raw,
      })
    }

    const result = { matched, review, unmatched, fetched: txs.length, fresh: fresh.length, at: now.toISOString() }
    await admin.from('bank_connections').update({ last_sync: now.toISOString(), last_result: result }).eq('building_id', buildingId)
    return json({ ok: true, ...result })
  } catch (e) {
    return json({ error: (e as Error).message || 'Chyba serveru' }, 500)
  }
})
