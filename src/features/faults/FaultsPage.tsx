import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { Fault, FaultStatus } from '../../lib/types'
import { can } from '../../lib/types'
import * as A from '../../lib/adminData'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'
import { uploadFile } from '../../lib/storage'

const CATS = ['Osvětlení', 'Výtah', 'Voda', 'Topení', 'Dveře a zámky', 'Úklid', 'Jiné']
const STEPS: FaultStatus[] = ['Nahlášeno', 'V řešení', 'Vyřešeno']
const pillOf = (s: FaultStatus) => s === 'Vyřešeno' ? 'pill-ok' : s === 'V řešení' ? 'pill-warn' : 'pill-neutral'

export default function FaultsPage() {
  const { user } = useSession(); const role = user?.role; const unit = user?.unit ?? ''
  const toast = useToast()
  const [faults, setFaults] = useState<Fault[]>([])
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<Fault | null>(null)
  const [cat, setCat] = useState(CATS[0]); const [loc, setLoc] = useState(''); const [desc, setDesc] = useState('')
  const [photos, setPhotos] = useState<string[]>([]); const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const manage = can(role!, 'manage_faults')

  useEffect(() => { api.getFaults().then(setFaults) }, [])
  const refresh = async () => { const list = await api.getFaults(); setFaults(list); setDetail((d) => d ? list.find((f) => f.id === d.id) || null : null) }

  async function pickPhotos(files: FileList | null) {
    if (!files || !files.length) return
    setBusy(true)
    for (const f of Array.from(files)) { const s = await uploadFile(f, 'faults'); setPhotos((p) => [...p, s.url]) }
    setBusy(false)
  }
  async function submit() {
    if (!loc.trim() || !desc.trim()) { toast('Vyplňte místo a popis'); return }
    const by = role === 'rezident' ? unit : 'Správa'
    const f = await api.reportFault({ cat, loc, desc, by })
    for (const url of photos) await api.addFaultPhoto(f.id, url)
    setOpen(false); setLoc(''); setDesc(''); setPhotos([]); await refresh(); toast('Závada nahlášena')
  }
  async function advance(id: number, status: FaultStatus) { await api.advanceFault(id, status, note.trim() || undefined); setNote(''); await refresh(); toast('Stav aktualizován') }
  async function assign(id: number, vendor: string) { if (!vendor) return; await api.assignVendor(id, vendor); await refresh(); toast('Dodavatel přiřazen') }

  return (
    <div>
      <div className="view-head">
        <div><h1>Závady</h1><div className="desc">Nahlášení, fotky a sledování průběhu oprav</div></div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Icon name="plus" small /> Nahlásit závadu</button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {faults.map((f) => (
          <button className="row-card" key={f.id} onClick={() => setDetail(f)} style={{ textAlign: 'left', cursor: 'pointer', width: '100%', background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <div className="lead-col"><b>{f.cat}</b><span>{f.loc}</span></div>
            <div style={{ flex: 1, minWidth: 160, fontSize: 14, color: 'var(--ink-2)' }}>{f.desc}
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                <span className="mono">{f.by} · {f.date}</span>
                {f.photos && f.photos.length > 0 && <span style={{ marginLeft: 8 }}><Icon name="doc" small /> {f.photos.length}</span>}
                {f.vendor && <span style={{ marginLeft: 8 }}>· {f.vendor}</span>}
              </div>
            </div>
            <div className="row-metrics"><span className={'pill ' + pillOf(f.status)}>{f.status}</span><Icon name="chevron" small /></div>
          </button>
        ))}
      </div>

      {/* report modal */}
      {open && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="modal">
            <div className="modal-h"><h3>Nahlásit závadu</h3><button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)}><Icon name="x" small /></button></div>
            <div className="modal-b">
              <div className="field"><label>Kategorie</label><select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="field"><label>Místo</label><input className="input" placeholder="Např. Chodba, 3. patro" value={loc} onChange={(e) => setLoc(e.target.value)} /></div>
              <div className="field"><label>Popis</label><textarea className="input" placeholder="Co je špatně?" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
              <div className="field"><label>Fotky</label>
                <div className="thumbs">
                  {photos.map((p, i) => <img key={i} className="thumb" src={p} alt="" />)}
                  <div className="thumb-add" onClick={() => fileRef.current?.click()}>{busy ? <span className="spin" style={{ width: 20, height: 20, margin: 0 }} /> : <Icon name="plus" />}</div>
                </div>
                <input ref={fileRef} className="file-in" type="file" accept="image/*" multiple onChange={(e) => pickPhotos(e.target.files)} />
              </div>
            </div>
            <div className="modal-f"><button className="btn btn-ghost" onClick={() => setOpen(false)}>Zrušit</button><button className="btn btn-primary" onClick={submit}>Odeslat</button></div>
          </div>
        </div>
      )}

      {/* detail modal */}
      {detail && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setDetail(null) }}>
          <div className="modal">
            <div className="modal-h"><h3>{detail.cat}</h3><button className="btn btn-ghost btn-icon" onClick={() => setDetail(null)}><Icon name="x" small /></button></div>
            <div className="modal-b">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div><b>{detail.loc}</b><div style={{ fontSize: 12.5, color: 'var(--ink-3)' }} className="mono">{detail.by} · {detail.date}</div></div>
                <span className={'pill ' + pillOf(detail.status)}>{detail.status}</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 12 }}>{detail.desc}</p>

              {detail.photos && detail.photos.length > 0 && <div className="thumbs">{detail.photos.map((p, i) => <img key={i} className="thumb" src={p} alt="" />)}</div>}

              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '14px 0 2px' }}>Průběh</div>
              <div className="tl">
                {(detail.timeline || [{ status: detail.status, at: detail.date }]).map((e, i, arr) => (
                  <div className={'tl-item ' + (i === arr.length - 1 ? 'cur' : 'done')} key={i}>
                    <span className="tl-dot" /><div className="tl-s">{e.status}</div><div className="tl-m">{e.at}</div>{e.note && <div className="tl-n">{e.note}</div>}
                  </div>
                ))}
              </div>

              <div className="doc-row" style={{ marginTop: 10 }}><span className="cf-ic"><Icon name="sluzby" small /></span><div><b>Dodavatel</b><span>{detail.vendor || 'zatím nepřiřazen'}</span></div></div>

              {manage && (
                <div className="card" style={{ marginTop: 12, background: 'var(--paper)' }}>
                  <div className="card-h"><h3 style={{ fontSize: 14 }}>Správa závady</h3></div>
                  <div className="field"><label>Přiřadit dodavatele</label>
                    <select className="input" value={detail.vendor || ''} onChange={(e) => assign(detail.id, e.target.value)}>
                      <option value="">Vyberte dodavatele</option>{A.vendors.map((v) => <option key={v.name} value={v.name}>{v.name} · {v.field}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Poznámka k aktualizaci</label><input className="input" placeholder="Např. Objednán díl" value={note} onChange={(e) => setNote(e.target.value)} /></div>
                  <div className="cta-row">{STEPS.filter((s) => s !== detail.status).map((s) => <button key={s} className="btn btn-soft btn-sm" onClick={() => advance(detail.id, s)}>{s}</button>)}</div>
                </div>
              )}
            </div>
            <div className="modal-f"><button className="btn btn-ghost" onClick={() => setDetail(null)}>Zavřít</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
