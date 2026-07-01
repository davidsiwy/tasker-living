import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Fault, FaultStatus } from '../../lib/types'
import { can } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'

const CATS = ['Osvětlení', 'Výtah', 'Voda', 'Topení', 'Dveře a zámky', 'Úklid', 'Jiné']
const STATUSES: FaultStatus[] = ['Nahlášeno', 'V řešení', 'Vyřešeno']
const pillOf = (s: FaultStatus) => s === 'Vyřešeno' ? 'pill-ok' : s === 'V řešení' ? 'pill-warn' : 'pill-neutral'

export default function FaultsPage() {
  const { user } = useSession(); const role = user?.role; const unit = user?.unit ?? ''
  const toast = useToast()
  const [faults, setFaults] = useState<Fault[]>([])
  const [open, setOpen] = useState(false)
  const [cat, setCat] = useState(CATS[0])
  const [loc, setLoc] = useState('')
  const [desc, setDesc] = useState('')
  const manage = can(role!, 'manage_faults')

  useEffect(() => { api.getFaults().then(setFaults) }, [])

  async function submit() {
    if (!loc.trim() || !desc.trim()) { toast('Vyplňte místo a popis'); return }
    const by = role === 'rezident' ? unit : 'Správa'
    const f = await api.reportFault({ cat, loc, desc, by })
    setFaults((s) => [f, ...s]); setOpen(false); setLoc(''); setDesc(''); toast('Závada nahlášena')
  }
  async function change(id: number, status: FaultStatus) {
    await api.setFaultStatus(id, status)
    setFaults((s) => s.map((f) => (f.id === id ? { ...f, status } : f)))
    toast('Stav upraven')
  }

  return (
    <div>
      <div className="view-head">
        <div><h1>Závady</h1><div className="desc">Nahlášení a sledování oprav ve společných prostorách</div></div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Icon name="plus" small /> Nahlásit závadu</button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {faults.map((f) => (
          <div className="row-card" key={f.id}>
            <div className="lead-col"><b>{f.cat}</b><span>{f.loc}</span></div>
            <div style={{ flex: 1, minWidth: 180, fontSize: 14, color: 'var(--ink-2)' }}>{f.desc}<div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, fontFamily: 'var(--fm)' }}>{f.by} · {f.date}</div></div>
            <div className="row-metrics">
              {manage ? (
                <select className="input" style={{ width: 'auto', padding: '7px 10px' }} value={f.status} onChange={(e) => change(f.id, e.target.value as FaultStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <span className={'pill ' + pillOf(f.status)}>{f.status}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="modal">
            <div className="modal-h"><h3>Nahlásit závadu</h3><button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)}><Icon name="x" small /></button></div>
            <div className="modal-b">
              <div className="field"><label>Kategorie</label><select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="field"><label>Místo</label><input className="input" placeholder="Např. Chodba, 3. patro" value={loc} onChange={(e) => setLoc(e.target.value)} /></div>
              <div className="field"><label>Popis</label><textarea className="input" placeholder="Co je špatně?" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            </div>
            <div className="modal-f"><button className="btn btn-ghost" onClick={() => setOpen(false)}>Zrušit</button><button className="btn btn-primary" onClick={submit}>Odeslat</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
