// Karta napojení na banku (Fio) — jedna logika, dva vizuální světy:
// variant 'sh' pro klientskou Správu domu, 'op' pro operátorskou konzoli.
import { useEffect, useState } from 'react'
import { bank } from '../lib/bank'
import type { BankStatus, BankTx } from '../lib/bank'
import { api } from '../lib/api'

interface OpenCharge { id: string; label: string }

export function BankCard({ buildingId, variant, toast }: { buildingId: string; variant: 'sh' | 'op'; toast: (m: string) => void }) {
  const C = variant === 'sh'
    ? { pri: 's-btn s-primary sm', dark: 's-btn s-dark sm', ghost: 's-btn s-ghost sm', ok: 's-badge ok', warn: 's-badge warn', mut: 'a-note' }
    : { pri: 'btn btn-primary btn-sm', dark: 'btn btn-soft btn-sm', ghost: 'btn btn-ghost btn-sm', ok: 'pill pill-ok', warn: 'pill pill-warn', mut: 'adm-mini' }

  const [st, setSt] = useState<BankStatus | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState('')
  const [txs, setTxs] = useState<BankTx[]>([])
  const [showTxs, setShowTxs] = useState(false)
  const [open, setOpen] = useState<OpenCharge[]>([])
  const [pick, setPick] = useState<Record<string, string>>({})

  async function reload() {
    try { setSt(await bank.status(buildingId)) } catch { setSt(null) }
    setLoaded(true)
  }
  useEffect(() => { if (bank.available) reload(); else setLoaded(true) }, [buildingId])

  async function loadTxs() {
    try {
      const [t, cs] = await Promise.all([bank.reviewList(buildingId), api.getOpenCharges(buildingId)])
      setTxs(t); setOpen(cs); setShowTxs(true)
    } catch (e: any) { toast('Chyba: ' + (e.message || e)) }
  }

  async function act(name: string, fn: () => Promise<unknown>, ok?: string) {
    if (busy) return
    setBusy(name)
    try { const r: any = await fn(); if (ok) toast(ok); return r }
    catch (e: any) { toast(e.message || 'Chyba') }
    finally { setBusy(''); await reload() }
  }

  const fmtSync = (s: string | null) => (s ? new Date(s).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'nikdy')

  if (!bank.available) {
    return (
      <div>
        <p className={C.mut} style={{ margin: 0 }}>
          Napojení na Fio banku: platby se párují automaticky podle VS a částky. Dostupné v ostrém provozu,
          v ukázce vypnuto. ČS a KB připravujeme.
        </p>
      </div>
    )
  }
  if (!loaded) return <p className={C.mut}>Načítání…</p>

  if (!st) {
    return (
      <div>
        <p className={C.mut} style={{ marginTop: 0 }}>
          Vygenerujte token v internetbankingu Fio: Nastavení → API → Přidat nový token,
          <b> pouze pro čtení</b>, platnost klidně bez omezení. Token vidí jen server, z aplikace ho zpětně přečíst nejde.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="input mono" type="password" style={{ flex: 1, minWidth: 220 }} placeholder="Fio API token"
            value={token} onChange={(e) => setToken(e.target.value)} />
          <button className={C.pri} disabled={!token.trim() || !!busy}
            onClick={() => act('save', async () => { await bank.save(buildingId, token); setToken(''); const r = await bank.syncNow(buildingId); toast(`Připojeno · spárováno ${r.matched}, ke kontrole ${r.review}`) })}>
            {busy === 'save' ? 'Připojuji…' : 'Připojit Fio'}
          </button>
        </div>
      </div>
    )
  }

  const res = st.lastResult || {}
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className={st.enabled ? C.ok : C.warn}>{st.enabled ? 'Fio připojeno' : 'Fio pozastaveno'}</span>
        <span className={C.mut}>poslední sync {fmtSync(st.lastSync)}
          {res.at ? ` · spárováno ${res.matched ?? 0}, ke kontrole ${res.review ?? 0}, bez shody ${res.unmatched ?? 0}` : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <button className={C.dark} disabled={!!busy}
          onClick={() => act('sync', async () => { const r = await bank.syncNow(buildingId); toast(`Hotovo · nových ${r.fresh}, spárováno ${r.matched}, ke kontrole ${r.review}`) })}>
          {busy === 'sync' ? 'Synchronizuji…' : 'Synchronizovat teď'}
        </button>
        {st.reviewCount > 0 && (
          <button className={C.ghost} onClick={() => (showTxs ? setShowTxs(false) : loadTxs())}>
            {showTxs ? 'Skrýt' : `K ruční kontrole · ${st.reviewCount}`}
          </button>
        )}
        <button className={C.ghost} disabled={!!busy} onClick={() => act('en', () => bank.setEnabled(buildingId, !st.enabled), st.enabled ? 'Pozastaveno' : 'Zapnuto')}>
          {st.enabled ? 'Pozastavit' : 'Zapnout'}
        </button>
        <button className={C.ghost} disabled={!!busy}
          onClick={() => window.confirm('Odpojit banku? Token se smaže, historie pohybů zůstane.') && act('rm', () => bank.disconnect(buildingId), 'Banka odpojena')}>
          Odpojit
        </button>
      </div>

      {showTxs && (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {txs.length === 0 && <p className={C.mut}>Nic ke kontrole.</p>}
          {txs.map((t) => (
            <div key={t.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13.5 }}>{t.amount.toLocaleString('cs-CZ')} Kč</b>
                <span className={C.mut}>{t.date} · VS {t.vs || '—'}{t.counter ? ' · ' + t.counter : ''}</span>
              </div>
              {t.message && <div className={C.mut} style={{ marginTop: 2 }}>{t.message}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <select className="input" style={{ flex: 1, minWidth: 180, fontSize: 13 }} value={pick[t.id] || ''}
                  onChange={(e) => setPick((s) => ({ ...s, [t.id]: e.target.value }))}>
                  <option value="">Vybrat předpis…</option>
                  {open.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <button className={C.dark} disabled={!pick[t.id] || !!busy}
                  onClick={() => act('res' + t.id, async () => { await bank.resolve(t.id, pick[t.id]); setTxs((s) => s.filter((x) => x.id !== t.id)) }, 'Spárováno, předpis zaplacen')}>
                  Spárovat
                </button>
                <button className={C.ghost} disabled={!!busy}
                  onClick={() => act('dis' + t.id, async () => { await bank.dismiss(t.id); setTxs((s) => s.filter((x) => x.id !== t.id)) }, 'Skryto')}>
                  Nepatří sem
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
