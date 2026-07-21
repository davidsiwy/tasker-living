// Karta napojení na banku (Fio) — jedna logika, dva vizuální světy:
// variant 'sh' pro klientskou Správu domu, 'op' pro operátorskou konzoli.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bank } from '../lib/bank'
import type { BankStatus, BankTx } from '../lib/bank'
import { api } from '../lib/api'

interface OpenCharge { id: string; label: string }

export function BankCard({ buildingId, variant, toast }: { buildingId: string; variant: 'sh' | 'op'; toast: (m: string) => void }) {
  const { t, i18n } = useTranslation('bank')
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
      const [tx, cs] = await Promise.all([bank.reviewList(buildingId), api.getOpenCharges(buildingId)])
      setTxs(tx); setOpen(cs); setShowTxs(true)
    } catch (e: any) { toast(t('genericError', { err: e.message || e })) }
  }

  async function act(name: string, fn: () => Promise<unknown>, ok?: string) {
    if (busy) return
    setBusy(name)
    try { const r: any = await fn(); if (ok) toast(ok); return r }
    catch (e: any) { toast(e.message || t('genericError', { err: '' })) }
    finally { setBusy(''); await reload() }
  }

  const fmtSync = (s: string | null) => (s ? new Date(s).toLocaleString(i18n.language, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : t('never'))

  if (!bank.available) {
    return (
      <div>
        <p className={C.mut} style={{ margin: 0 }}>{t('unavailable')}</p>
      </div>
    )
  }
  if (!loaded) return <p className={C.mut}>{t('loading')}</p>

  if (!st) {
    return (
      <div>
        <p className={C.mut} style={{ marginTop: 0 }}>
          {t('connectHint')}
          <b> {t('connectHintBold')}</b>{t('connectHintEnd')}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="input mono" type="password" style={{ flex: 1, minWidth: 220 }} placeholder={t('tokenPlaceholder')}
            value={token} onChange={(e) => setToken(e.target.value)} />
          <button className={C.pri} disabled={!token.trim() || !!busy}
            onClick={() => act('save', async () => { await bank.save(buildingId, token); setToken(''); const r = await bank.syncNow(buildingId); toast(t('toastConnected', { matched: r.matched, review: r.review })) })}>
            {busy === 'save' ? t('connecting') : t('connect')}
          </button>
        </div>
      </div>
    )
  }

  const res = st.lastResult || {}
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className={st.enabled ? C.ok : C.warn}>{st.enabled ? t('connected') : t('paused')}</span>
        <span className={C.mut}>{t('lastSync', { time: fmtSync(st.lastSync) })}
          {res.at ? t('syncSummary', { matched: res.matched ?? 0, review: res.review ?? 0, unmatched: res.unmatched ?? 0 }) : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <button className={C.dark} disabled={!!busy}
          onClick={() => act('sync', async () => { const r = await bank.syncNow(buildingId); toast(t('toastSyncDone', { fresh: r.fresh, matched: r.matched, review: r.review })) })}>
          {busy === 'sync' ? t('syncing') : t('syncNow')}
        </button>
        {st.reviewCount > 0 && (
          <button className={C.ghost} onClick={() => (showTxs ? setShowTxs(false) : loadTxs())}>
            {showTxs ? t('hide') : t('reviewCount', { count: st.reviewCount })}
          </button>
        )}
        <button className={C.ghost} disabled={!!busy} onClick={() => act('en', () => bank.setEnabled(buildingId, !st.enabled), st.enabled ? t('toastPaused') : t('toastResumed'))}>
          {st.enabled ? t('pause') : t('resume')}
        </button>
        <button className={C.ghost} disabled={!!busy}
          onClick={() => window.confirm(t('confirmDisconnect')) && act('rm', () => bank.disconnect(buildingId), t('toastDisconnected'))}>
          {t('disconnect')}
        </button>
      </div>

      {showTxs && (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {txs.length === 0 && <p className={C.mut}>{t('nothingToReview')}</p>}
          {txs.map((tx) => (
            <div key={tx.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13.5 }}>{tx.amount.toLocaleString(i18n.language)} Kč</b>
                <span className={C.mut}>{tx.date} · VS {tx.vs || '—'}{tx.counter ? ' · ' + tx.counter : ''}</span>
              </div>
              {tx.message && <div className={C.mut} style={{ marginTop: 2 }}>{tx.message}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <select className="input" style={{ flex: 1, minWidth: 180, fontSize: 13 }} value={pick[tx.id] || ''}
                  onChange={(e) => setPick((s) => ({ ...s, [tx.id]: e.target.value }))}>
                  <option value="">{t('selectCharge')}</option>
                  {open.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <button className={C.dark} disabled={!pick[tx.id] || !!busy}
                  onClick={() => act('res' + tx.id, async () => { await bank.resolve(tx.id, pick[tx.id]); setTxs((s) => s.filter((x) => x.id !== tx.id)) }, t('toastMatched'))}>
                  {t('match')}
                </button>
                <button className={C.ghost} disabled={!!busy}
                  onClick={() => act('dis' + tx.id, async () => { await bank.dismiss(tx.id); setTxs((s) => s.filter((x) => x.id !== tx.id)) }, t('toastDismissed'))}>
                  {t('notMine')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
