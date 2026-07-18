import { useEffect, useMemo, useState } from 'react'
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
const worker = { name: 'Marek P.', ini: 'MP', rating: '4,9', jobs: 132 }
const SLOTS = ['Čt 14:00', 'Pá 9:00', 'Pá 16:00']

// Služby Tasker (handoff 4g): moat udělaný konkrétním. Soused objedná ověřeného
// pracovníka přímo z aplikace domu — to nikdo jiný v téhle kategorii nemá.
export default function ServicesPage() {
  const { user, isDemo } = useSession()
  const toast = useToast()
  const bid = user?.buildingId || ''

  const [services] = useState<Service[]>(M.services)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [pick, setPick] = useState<Service | null>(null)
  const [slot, setSlot] = useState(SLOTS[0])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (bid) api.getBookings(bid).then(setBookings).catch(console.error) }, [bid])

  const active = useMemo(() => bookings.filter((b) => b.status !== 'cancelled'), [bookings])

  async function order() {
    if (!pick || busy) return
    setBusy(true)
    try {
      const b = await api.createBooking(bid, pick.name, `${slot}${note.trim() ? ' · ' + note.trim() : ''}`)
      setBookings((s) => [b, ...s]); setPick(null); setNote('')
      toast('Objednáno. Dispečink potvrdí termín.')
      if (isDemo) {
        const assigned = await api.demoAssignWorker(b.id)
        if (assigned) { setBookings((s) => s.map((x) => (x.id === b.id ? assigned : x))); toast(`${assigned.worker} přiřazen`) }
      }
    } catch (e: any) { toast(e.message || 'Objednávka selhala') } finally { setBusy(false) }
  }
  async function cancel(b: Booking) {
    try { await api.cancelBooking(b.id); setBookings((s) => s.map((x) => (x.id === b.id ? { ...x, status: 'cancelled', date: 'zrušeno' } : x))); toast('Objednávka zrušena') }
    catch (e: any) { toast(e.message || 'Zrušení selhalo') }
  }
  async function pay(name: string) {
    try {
      const r = await taskerApi.createOrder({ service: name, unit: user?.unit || '' })
      if (r.payUrl) window.open(r.payUrl, '_blank')
      else toast(`Objednávka ${r.orderId} vytvořena, platbu dokončíte v aplikaci Tasker`)
    } catch { toast('Platbu služby vyřídíte v aplikaci Tasker') }
  }

  if (!user) return null

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>Služby Tasker</h2>
          <p>Ověřený pracovník k vám domů na pár kliknutí. Bez shánění, s hodnocením.</p>
        </div>
      </div>

      <div className="sv-hero an">
        <div className="t">
          <div className="k">Tohle nikdo jiný v kategorii nemá</div>
          <h3>Ostatní aplikace evidují. My pošleme i ruce.</h3>
          <p>Tasker Living stojí na platformě Tasker, takže objednáte úklid, drobnou opravu nebo mytí oken přímo tady. Termín potvrdí dispečink, platba přes Tasker.</p>
        </div>
        <div className="n"><b>20 000+</b><span>klientů platformy Tasker</span></div>
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
              {b.status === 'new' && <><span className="s-badge neutral">Hledáme pracovníka</span><button className="s-btn s-ghost sm" onClick={() => cancel(b)}>Zrušit</button></>}
              {b.status === 'assigned' && <><span className="s-badge ok">Naplánováno</span><button className="s-btn s-dark sm" onClick={() => pay(b.name)}>Zaplatit přes Tasker</button></>}
              {b.status === 'done' && <span className="s-badge neutral">Dokončeno</span>}
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
            <b>{s.name}</b>
            <span>{s.desc}</span>
            <span className="from">od {s.from} Kč{s.unit}</span>
          </button>
        ))}
      </div>

      {pick && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setPick(null) }}>
          <div className="modal">
            <div className="modal-h"><h3>{pick.name}</h3><button className="s-btn s-ghost sm" onClick={() => setPick(null)}>Zrušit</button></div>
            <div className="modal-b">
              <div className="sv-worker">
                <span className="ava">{worker.ini}</span>
                <div style={{ flex: 1 }}>
                  <b>{worker.name}</b>
                  <span>★ {worker.rating} · {worker.jobs} zakázek · prověřený</span>
                </div>
                <span className="s-badge ok">Ověřený</span>
              </div>

              <div className="a-f" style={{ marginTop: 14 }}>
                <label>Termín</label>
                <div className="sv-slots">
                  {SLOTS.map((s) => (
                    <button key={s} className={'sv-slot' + (slot === s ? ' on' : '')} onClick={() => setSlot(s)}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="a-f">
                <label htmlFor="sv-n">Poznámka pro pracovníka</label>
                <textarea id="sv-n" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Byt v 3. patře, klíč u sousedky…" />
              </div>
              <p className="a-note">Od {pick.from} Kč{pick.unit}. Dispečink potvrdí přesný termín, platbu dokončíte přes Tasker.</p>
            </div>
            <div className="modal-f">
              <button className="s-btn s-ghost" onClick={() => setPick(null)}>Zrušit</button>
              <button className="s-btn s-primary" onClick={order} disabled={busy}>
                {busy ? 'Objednávám…' : `Objednat na ${slot}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
