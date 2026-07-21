import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import type { Fault, FaultStatus } from '../../lib/types'
import { can, faultStatusLabel, faultEventLabel, catLabel } from '../../lib/types'
import * as A from '../../lib/adminData'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { SIcon } from '../../components/AppShell'
import { uploadFile } from '../../lib/storage'

const CATS = ['Osvětlení', 'Výtah', 'Voda', 'Topení', 'Dveře a zámky', 'Úklid', 'Jiné']
const COLS: { s: FaultStatus; dot: string }[] = [
  { s: 'Nahlášeno', dot: 'n1' }, { s: 'V řešení', dot: 'n2' }, { s: 'Vyřešeno', dot: 'n3' },
]
const badge = (s: FaultStatus) => (s === 'Vyřešeno' ? 'ok' : s === 'V řešení' ? 'warn' : 'neutral')

// Závady (handoff 4d): kanban, protože výbor potřebuje vidět, co visí a na kom.
// Detail (6c) je modal s fotkou, průběhem a přiřazením — ohlašovatel vidí každý krok.
export default function FaultsPage() {
  const { t } = useTranslation(['faults', 'common'])
  const { user } = useSession()
  const toast = useToast()
  const role = user?.role
  const bid = user?.buildingId || ''
  const unit = user?.unit ?? ''
  const manage = role ? can(role, 'manage_faults') : false

  const [faults, setFaults] = useState<Fault[]>([])
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<Fault | null>(null)
  const [cat, setCat] = useState(CATS[0])
  const [loc, setLoc] = useState(''); const [desc, setDesc] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [vendorText, setVendorText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    if (!bid) return
    const list = await api.getFaults(bid)
    setFaults(list)
    setDetail((d) => (d ? list.find((f) => f.id === d.id) || null : null))
  }
  useEffect(() => { refresh().catch(console.error) }, [bid])

  const cols = useMemo(
    () => COLS.map((c) => ({ ...c, items: faults.filter((f) => f.status === c.s) })),
    [faults],
  )
  const unassigned = faults.filter((f) => f.status !== 'Vyřešeno' && !f.vendor).length

  async function pickPhotos(files: FileList | null) {
    if (!files || !files.length) return
    setBusy(true)
    try { for (const f of Array.from(files)) { const s = await uploadFile(f, 'faults'); setPhotos((p) => [...p, s.url]) } }
    finally { setBusy(false) }
  }
  async function submit() {
    if (!loc.trim() || !desc.trim()) { toast(t('faults:toastFillRequired')); return }
    if (busy) return
    setBusy(true)
    try {
      const by = role === 'rezident' && unit ? unit : 'Správa'
      await api.reportFault({ buildingId: bid, cat, loc: loc.trim(), desc: desc.trim(), by, photos })
      setOpen(false); setLoc(''); setDesc(''); setPhotos([]); await refresh()
      toast(t('faults:toastReported'))
    } catch (e: any) { toast(e.message || t('faults:toastReportFailed')) } finally { setBusy(false) }
  }
  async function advance(id: string, status: FaultStatus) {
    try { await api.advanceFault(id, status, note.trim() || undefined); setNote(''); await refresh(); toast(t('faults:toastStatusUpdated')) }
    catch (e: any) { toast(e.message || t('faults:toastUpdateFailed')) }
  }
  async function assign(id: string) {
    if (!vendorText.trim()) { toast(t('faults:toastSelectVendor')); return }
    try { await api.assignVendor(id, vendorText.trim()); setVendorText(''); await refresh(); toast(t('faults:toastVendorAssigned')) }
    catch (e: any) { toast(e.message || t('faults:toastAssignFailed')) }
  }

  if (!user) return null

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>{t('faults:title')}</h2>
          <p>
            {manage
              ? unassigned > 0
                ? t('faults:subtitleUnassigned', { count: unassigned })
                : t('faults:subtitleManageOk')
              : t('faults:subtitleResident')}
          </p>
        </div>
        <button className="s-btn s-primary" onClick={() => setOpen(true)}>{t('faults:report')}</button>
      </div>

      <div className="f-kan">
        {cols.map((c) => (
          <div className="f-col an" key={c.s}>
            <div className="f-ch">
              <i className={c.dot} />
              <b>{faultStatusLabel(c.s, t)}</b>
              <span className="n">{c.items.length}</span>
            </div>
            {c.items.length === 0 && (
              <div className="f-none">
                {c.s === 'Vyřešeno' ? t('faults:colEmptyResolved') : c.s === 'Nahlášeno' ? t('faults:colEmptyReported') : t('faults:colEmptyInProgress')}
              </div>
            )}
            {c.items.map((f) => (
              <button className="f-card" key={f.id} onClick={() => setDetail(f)}>
                <div className="t">
                  <b>{f.desc}</b>
                  <span className="cat">{catLabel(f.cat, t)}</span>
                </div>
                <p>{f.loc}</p>
                <div className="f-b">
                  {f.photos && f.photos[0] && <img src={f.photos[0]} alt="" />}
                  <div className="m">
                    <b>{f.by}</b>
                    {f.date}{f.vendor ? ` · ${f.vendor}` : f.status !== 'Vyřešeno' ? ' · ' + t('faults:unassignedTag') : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>

      {faults.length === 0 && (
        <div className="d-empty" style={{ background: '#fff', border: '1px solid var(--s-line)', borderRadius: 14, marginTop: 14 }}>
          {t('faults:emptyAll')}
        </div>
      )}

      {/* nahlásit */}
      {open && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="modal">
            <div className="modal-h"><h3>{t('faults:modal.title')}</h3><button className="s-btn s-ghost sm" onClick={() => setOpen(false)}>{t('faults:modal.cancel')}</button></div>
            <div className="modal-b">
              <div className="a-f">
                <label>{t('faults:modal.category')}</label>
                <div className="a-chips">
                  {CATS.map((c) => (
                    <button key={c} className={'a-chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{catLabel(c, t)}</button>
                  ))}
                </div>
              </div>
              <div className="a-f"><label htmlFor="f-l">{t('faults:modal.where')}</label><input id="f-l" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder={t('faults:modal.wherePlaceholder')} /></div>
              <div className="a-f"><label htmlFor="f-d">{t('faults:modal.what')}</label><textarea id="f-d" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('faults:modal.whatPlaceholder')} /></div>
              <div className="a-f">
                <label>{t('faults:modal.photos')}</label>
                <div className="f-photos">
                  {photos.map((p, i) => <img key={i} src={p} alt="" />)}
                  <button className="s-btn s-ghost sm" onClick={() => fileRef.current?.click()} disabled={busy}>
                    {busy ? t('faults:modal.uploading') : t('faults:modal.addPhoto')}
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={(e) => pickPhotos(e.target.files)} />
              </div>
            </div>
            <div className="modal-f">
              <button className="s-btn s-ghost" onClick={() => setOpen(false)}>{t('faults:modal.cancel')}</button>
              <button className="s-btn s-primary" onClick={submit} disabled={busy}>{t('faults:modal.submit')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 6c detail */}
      {detail && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setDetail(null) }}>
          <div className="modal">
            <div className="modal-h"><h3>{detail.desc}</h3><button className="s-btn s-ghost sm" onClick={() => setDetail(null)}>{t('faults:detail.close')}</button></div>
            <div className="modal-b">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <b style={{ fontSize: 13.5, fontWeight: 800 }}>{detail.loc}</b>
                  <div className="s-mono" style={{ fontSize: 11, color: 'var(--s-muted)', marginTop: 2 }}>
                    {catLabel(detail.cat, t)} · {t('faults:detail.reportedBy', { by: detail.by })} · {detail.date}
                  </div>
                </div>
                <span className={'s-badge ' + badge(detail.status)}>{faultStatusLabel(detail.status, t)}</span>
              </div>

              {detail.photos && detail.photos.length > 0 && (
                <div className="f-photos">{detail.photos.map((p, i) => <img key={i} src={p} alt="" />)}</div>
              )}

              <div className="f-vend">
                <span className="ic"><SIcon n="wrench" s={15} /></span>
                <div style={{ flex: 1 }}>
                  <b>{detail.vendor || t('faults:detail.vendorNotAssigned')}</b>
                  <span>{detail.vendor ? t('faults:detail.vendorProgress') : t('faults:detail.vendorWaiting')}</span>
                </div>
              </div>

              <div className="f-tl">
                {(detail.timeline || [{ status: detail.status, at: detail.date }]).map((e, i, arr) => (
                  <div className={'f-step ' + (i === arr.length - 1 ? 'cur' : 'done')} key={i}>
                    <b>{faultEventLabel(e.status, t)}</b>
                    <span>{e.at}</span>
                    {e.note && <div className="note">{e.note}</div>}
                  </div>
                ))}
              </div>

              {manage && (
                <div className="f-manage">
                  <div className="row">
                    <div className="a-f">
                      <label htmlFor="f-v">{t('faults:detail.assignVendor')}</label>
                      <input id="f-v" list="vendor-list" value={vendorText} onChange={(e) => setVendorText(e.target.value)} placeholder={t('faults:detail.vendorPlaceholder')} />
                      <datalist id="vendor-list">
                        {A.vendors.map((v) => <option key={v.name} value={v.name}>{v.field}</option>)}
                      </datalist>
                    </div>
                    <button className="s-btn s-dark" onClick={() => assign(detail.id)}>{t('faults:detail.assign')}</button>
                  </div>
                  <div className="a-f">
                    <label htmlFor="f-n">{t('faults:detail.noteLabel')}</label>
                    <input id="f-n" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('faults:detail.notePlaceholder')} />
                  </div>
                  <div className="a-acts">
                    {COLS.map((c) => c.s).filter((s) => s !== detail.status).map((s) => (
                      <button key={s} className="s-btn s-ghost sm" onClick={() => advance(detail.id, s)}>{t('faults:detail.advanceTo', { status: faultStatusLabel(s, t) })}</button>
                    ))}
                  </div>
                  <p className="a-note" style={{ marginTop: 8 }}>
                    {t('faults:detail.notifyNote')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
