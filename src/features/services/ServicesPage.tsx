import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Service, Booking } from '../../lib/types'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'

export default function ServicesPage() {
  const toast = useToast()
  const [services, setServices] = useState<Service[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [pick, setPick] = useState<Service | null>(null)
  const [note, setNote] = useState('')
  useEffect(() => { api.getServices().then(setServices); api.getBookings().then(setBookings) }, [])

  // Order flow: create the booking, then Tasker assigns a vetted worker.
  async function order() {
    if (!pick) return
    const b = await api.createBooking(pick.name)
    setBookings((s) => [b, ...s]); setPick(null); setNote('')
    toast('Objednáno, hledáme pracovníka')
    const assigned = await api.assignWorker(b.id)
    if (assigned) { setBookings((s) => s.map((x) => (x.id === b.id ? assigned : x))); toast(`${assigned.worker} přiřazen`) }
  }

  return (
    <div>
      <div className="view-head"><div><h1>Služby Tasker</h1><div className="desc">Ověření pracovníci, objednáte na pár kliknutí</div></div></div>

      {bookings.length > 0 && (
        <div className="stat" style={{ marginBottom: 16 }}>
          <div className="card-h"><h3>Moje objednávky</h3></div>
          {bookings.map((b) => (
            <div className="row-card" key={b.id} style={{ marginTop: 10 }}>
              <div className="lead-col"><b>{b.name}</b><span>{b.date}</span></div>
              <div className="row-metrics">
                {b.status === 'new' && <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-3)', fontSize: 13 }}><span className="spin" style={{ width: 20, height: 20, margin: 0 }} /> přiřazujeme pracovníka</span>}
                {b.status !== 'new' && b.worker && <div className="worker"><span className="cf-ic"><Icon name="check" small /></span><div style={{ fontSize: 13 }}><b>{b.worker}</b> <span style={{ color: 'var(--gold)' }}>★ {b.rating}</span></div></div>}
                {b.status === 'assigned' && <span className="pill pill-ok">Naplánováno</span>}
                {b.status === 'done' && <span className="pill pill-neutral">Dokončeno</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid-3">
        {services.map((s) => (
          <div className="svc-card" key={s.id}>
            <div className="svc-ic"><Icon name={s.icon} /></div>
            <h4>{s.name}</h4><p>{s.desc}</p>
            <div className="svc-price">od {s.from} Kč<small>{s.unit}</small></div>
            <button className="btn btn-soft btn-sm" onClick={() => setPick(s)}>Objednat</button>
          </div>
        ))}
      </div>

      {pick && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setPick(null) }}>
          <div className="modal">
            <div className="modal-h"><h3>{pick.name}</h3><button className="btn btn-ghost btn-icon" onClick={() => setPick(null)}><Icon name="x" small /></button></div>
            <div className="modal-b">
              <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 14 }}>Od {pick.from} Kč{pick.unit}. Po objednání přiřadíme ověřeného pracovníka Tasker.</p>
              <div className="field"><label>Poznámka</label><textarea className="input" placeholder="Termín, detaily..." value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
            <div className="modal-f"><button className="btn btn-ghost" onClick={() => setPick(null)}>Zrušit</button><button className="btn btn-gold" onClick={order}>Objednat</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
