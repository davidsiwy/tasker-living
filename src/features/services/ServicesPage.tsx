import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import * as M from '../../lib/mockData'
import type { Service, Booking } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { SIcon } from '../../components/AppShell'
import { taskerApi } from '../../lib/taskerApi'

// glyph per service category (handoff 4g)
const SG: Record<string, string> = {
  uklid: '<path d="M19 8l-7 7-3-3"/><path d="M4 20l4-9 6 6-9 4z"/>',
  handyman: '<path d="M14.7 6.3a4.6 4.6 0 0 0-6.1 6.1L3 18l3 3 5.6-5.6a4.6 4.6 0 0 0 6.1-6.1L14.5 12 12 9.5z"/>',
  okna: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M4 12h16M12 3v18"/>',
  koberce: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M3 10h18"/>',
  odpad: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  malovani: '<rect x="4" y="3" width="12" height="7" rx="1.5"/><path d="M16 6h3v5h-7v3M12 14v7"/>',
}
const worker = { name: 'Marek P.', ini: 'MP', jobs: 132 }

// Služby Tasker (handoff 4g): moat udělaný konkrétním. Soused objedná ověřeného
// pracovníka přímo z aplikace domu — to nikdo jiný v téhle kategorii nemá.
//
// Katalog služeb (M.services) je sdílený tasker-wide, ne za dům, ale jméno/
// popis v mockData.ts zůstávají česky — id (uklid/handyman/...) je stabilní
// klíč nezávislý na jazyce, takže tady mapujeme na preklad přes services:catalog.<id>
// místo úpravy samotného mockData.ts (to zůstává mimo scope, viz poznámky k i18n).
export default function ServicesPage() {
  const { t } = useTranslation(['services', 'marketing', 'common'])
  const SLOTS = [t('marketing:moat.slotA'), t('marketing:moat.slotB'), t('marketing:moat.slotC')]
  const { user, isDemo } = useSession()
  const toast = useToast()
  const bid = user?.buildingId || ''

  const [services] = useState<Service[]>(M.services)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [pick, setPick] = useState<Service | null>(null)
  const [slotIdx, setSlotIdx] = useState(0)
  const slot = SLOTS[slotIdx]
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const serviceName = (s: Service) => t(`services:catalog.${s.id}.name`, { defaultValue: s.name })
  const serviceDesc = (s: Service) => t(`services:catalog.${s.id}.desc`, { defaultValue: s.desc })

  useEffect(() => { if (bid) api.getBookings(bid).then(setBookings).catch(console.error) }, [bid])

  const active = useMemo(() => bookings.filter((b) => b.status !== 'cancelled'), [bookings])

  async function order() {
    if (!pick || busy) return
    setBusy(true)
    try {
      const b = await api.createBooking(bid, pick.name, `${slot}${note.trim() ? ' · ' + note.trim() : ''}`)
      setBookings((s) => [b, ...s]); setPick(null); setNote('')
      toast(t('services:toastOrdered'))
      if (isDemo) {
        const assigned = await api.demoAssignWorker(b.id)
        if (assigned) { setBookings((s) => s.map((x) => (x.id === b.id ? assigned : x))); toast(t('services:toastAssigned', { worker: assigned.worker })) }
      }
    } catch (e: any) { toast(e.message || t('services:toastOrderFailed')) } finally { setBusy(false) }
  }
  async function cancel(b: Booking) {
    try { await api.cancelBooking(b.id); setBookings((s) => s.map((x) => (x.id === b.id ? { ...x, status: 'cancelled', date: t('services:cancelledDate') } : x))); toast(t('services:toastCancelled')) }
    catch (e: any) { toast(e.message || t('services:toastCancelFailed')) }
  }
  async function pay(name: string) {
    try {
      const r = await taskerApi.createOrder({ service: name, unit: user?.unit || '' })
      if (r.payUrl) window.open(r.payUrl, '_blank')
      else toast(t('services:toastOrderCreated', { id: r.orderId }))
    } catch { toast(t('services:toastPayViaTasker')) }
  }

  if (!user) return null

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>{t('services:title')}</h2>
          <p>{t('services:subtitle')}</p>
        </div>
      </div>

      <div className="sv-hero an">
        <div className="t">
          <div className="k">{t('services:heroTag')}</div>
          <h3>{t('services:heroTitle')}</h3>
          <p>{t('services:heroBody')}</p>
        </div>
        <div className="n"><b>20 000+</b><span>{t('services:heroStat')}</span></div>
      </div>

      {active.length > 0 && (
        <div className="sv-list">
          {active.map((b) => (
            <div className="sv-bk an" key={b.id}>
              <span className="ic"><SIcon n="spark" s={16} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{b.name}</b>
                <span>{b.worker ? `${b.worker}${b.rating ? ' · ★ ' + b.rating : ''} · ${b.date}` : b.date}</span>
              </div>
              {b.status === 'new' && <><span className="s-badge neutral">{t('services:statusSearching')}</span><button className="s-btn s-ghost sm" onClick={() => cancel(b)}>{t('services:cancel')}</button></>}
              {b.status === 'assigned' && <><span className="s-badge ok">{t('services:statusScheduled')}</span><button className="s-btn s-dark sm" onClick={() => pay(b.name)}>{t('services:payViaTasker')}</button></>}
              {b.status === 'done' && <span className="s-badge neutral">{t('services:statusDone')}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="sv-cats">
        {services.map((s, i) => (
          <button className={'sv-cat an' + (pick?.id === s.id ? ' on' : '')} key={s.id}
            style={{ ['--d' as string]: `${Math.min(i, 6) * 0.05}s` }} onClick={() => setPick(s)}>
            <span className="ic">
              <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }} fill="none" stroke="currentColor"
                strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                dangerouslySetInnerHTML={{ __html: SG[s.id] || SG.handyman }} />
            </span>
            <b>{serviceName(s)}</b>
            <span>{serviceDesc(s)}</span>
            <span className="from">{t('services:fromPrice', { from: s.from, unit: s.unit })}</span>
          </button>
        ))}
      </div>

      {pick && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setPick(null) }}>
          <div className="modal">
            <div className="modal-h"><h3>{serviceName(pick)}</h3><button className="s-btn s-ghost sm" onClick={() => setPick(null)}>{t('services:cancel')}</button></div>
            <div className="modal-b">
              <div className="sv-worker">
                <span className="ava">{worker.ini}</span>
                <div style={{ flex: 1 }}>
                  <b>{worker.name}</b>
                  <span>★ {t('services:workerRating', { defaultValue: '4,9' })} · {t('services:jobsCount', { count: worker.jobs })} · {t('services:verified')}</span>
                </div>
                <span className="s-badge ok">{t('services:verifiedBadge')}</span>
              </div>

              <div className="a-f" style={{ marginTop: 14 }}>
                <label>{t('services:when')}</label>
                <div className="sv-slots">
                  {SLOTS.map((s, si) => (
                    <button key={si} className={'sv-slot' + (slotIdx === si ? ' on' : '')} onClick={() => setSlotIdx(si)}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="a-f">
                <label htmlFor="sv-n">{t('services:noteLabel')}</label>
                <textarea id="sv-n" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('services:notePlaceholder')} />
              </div>
              <p className="a-note">{t('services:confirmNote', { from: pick.from, unit: pick.unit })}</p>
            </div>
            <div className="modal-f">
              <button className="s-btn s-ghost" onClick={() => setPick(null)}>{t('services:cancel')}</button>
              <button className="s-btn s-primary" onClick={order} disabled={busy}>
                {busy ? t('services:ordering') : t('services:orderFor', { slot })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
