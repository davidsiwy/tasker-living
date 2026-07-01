import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { ComplaintItem } from '../../lib/types'
import { can } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'

const TYPES = ['Hluk', 'Nepořádek', 'Kouření', 'Parkování', 'Zvířata', 'Jiné']
const czCount = (n: number) => (n === 1 ? 'stížnost' : n < 5 ? 'stížnosti' : 'stížností')

export default function ComplaintsPage() {
  const { user } = useSession(); const role = user?.role
  const toast = useToast()
  const [log, setLog] = useState<Record<string, ComplaintItem[]>>({})
  const [detail, setDetail] = useState<string | null>(null)
  const [unit, setUnit] = useState('')
  const [type, setType] = useState(TYPES[0])
  const [note, setNote] = useState('')
  const showLog = can(role!, 'complaint_log')
  const showForm = can(role!, 'file_complaint')

  useEffect(() => { if (showLog) api.getComplaints().then(setLog) }, [showLog])

  async function file() {
    if (!unit.trim()) { toast('Zadejte číslo bytu'); return }
    const u = unit.trim().toUpperCase()
    await api.fileComplaint(u, type, note)
    toast(`Stížnost zaznamenána k bytu ${u}`)
    setUnit(''); setNote('')
    if (showLog) api.getComplaints().then(setLog)
  }

  const rows = Object.entries(log).sort((a, b) => b[1].length - a[1].length)

  if (!showLog && !showForm) {
    return (
      <div>
        <div className="view-head"><div><h1>Stížnosti</h1><div className="desc">Sousedské spory a jejich řešení</div></div></div>
        <div className="empty"><span className="cf-ic"><Icon name="stiznosti" /></span><p>Stížnosti spravuje výbor SVJ.</p></div>
      </div>
    )
  }

  return (
    <div>
      <div className="view-head"><div><h1>Stížnosti</h1><div className="desc">{showLog ? 'Evidence podle bytů, ne podle osob' : 'Nahlaste rušení, eviduje se k bytu'}</div></div></div>

      {showForm && (
        <div className="stat" style={{ marginBottom: 16 }}>
          <div className="card-h"><h3>Nová stížnost</h3><span className="sub">Anonymní vůči sousedovi</span></div>
          <div className="grid-2">
            <div className="field"><label>Číslo bytu</label><input className="input mono" placeholder="Např. A-101" value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
            <div className="field"><label>Typ</label><select className="input" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div className="field"><label>Popis</label><textarea className="input" placeholder="Co se děje?" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <button className="btn btn-primary btn-sm" onClick={file}><Icon name="send" small /> Odeslat stížnost</button>
        </div>
      )}

      {showLog && (
        <div className="stat">
          <div className="card-h"><h3>Přehled podle bytů</h3><span className="sub">Řazeno podle počtu</span></div>
          {rows.length === 0 && <div className="empty"><span className="cf-ic"><Icon name="check" /></span><p>Žádné stížnosti.</p></div>}
          {rows.map(([u, items]) => (
            <div className="row-card" key={u} style={{ marginTop: 10 }}>
              <div className="lead-col"><b className="mono">{u}</b><span>{items.length} {czCount(items.length)}</span></div>
              <div className="row-metrics">
                <span className={'pill ' + (items.length >= 3 ? 'pill-bad' : items.length === 2 ? 'pill-warn' : 'pill-neutral')}>{items.length}×</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setDetail(u)}>Historie</button>
                <button className="btn btn-soft btn-sm" onClick={() => toast(`Upozornění odesláno bytu ${u}`)}>Upozornit</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setDetail(null) }}>
          <div className="modal">
            <div className="modal-h"><h3>Historie, byt {detail}</h3><button className="btn btn-ghost btn-icon" onClick={() => setDetail(null)}><Icon name="x" small /></button></div>
            <div className="modal-b" style={{ maxHeight: 360, overflowY: 'auto' }}>
              {(log[detail] || []).map((c, i) => (
                <div className="doc-row" key={i}><span className="cf-ic"><Icon name="stiznosti" small /></span><div><b>{c.type} <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontFamily: 'var(--fm)', fontSize: 12 }}>{c.date}</span></b><span>{c.note}</span></div></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
