import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import type { DocItem, Role } from '../../lib/types'
import { can, docCatLabel } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { SIcon } from '../../components/AppShell'

const CATS = ['Stanovy a právní', 'Zápisy', 'Vyúčtování', 'Revize', 'Smlouvy', 'Schůze', 'Ostatní']
const ALL = '__all__' // interní sentinel filtru, nikdy se neporovnává s daty dokumentu

// Dokumenty (handoff 4e): stanovy, zápisy, vyúčtování na jednom místě,
// viditelnost po rolích. Rezident vidí jen to, co má; výbor spravuje práva.
export default function DocumentsPage() {
  const { t } = useTranslation(['documents', 'common'])
  const VIS: { k: Role; l: string }[] = [
    { k: 'rezident', l: t('documents:visResidents') }, { k: 'vybor', l: t('documents:visCommittee') },
    { k: 'developer', l: t('documents:visDeveloper') }, { k: 'investor', l: t('documents:visInvestor') },
  ]
  const { user } = useSession()
  const toast = useToast()
  const role = user?.role
  const bid = user?.buildingId || ''
  const manage = role ? can(role, 'manage_meetings') : false

  const [docs, setDocs] = useState<DocItem[]>([])
  const [active, setActive] = useState(ALL)
  const [cat, setCat] = useState(CATS[0])
  const [vis, setVis] = useState<Role[]>(['rezident', 'vybor', 'developer', 'investor'])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = () => { if (bid && role) api.getDocuments(bid, role).then(setDocs).catch(console.error) }
  useEffect(() => { reload() }, [bid, role])

  const cats = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const d of docs) counts[d.cat || 'Ostatní'] = (counts[d.cat || 'Ostatní'] || 0) + 1
    return [{ name: ALL, label: t('documents:all'), n: docs.length }, ...CATS.filter((c) => counts[c]).map((c) => ({ name: c, label: docCatLabel(c, t), n: counts[c] }))]
  }, [docs, t])
  const shown = useMemo(() => (active === ALL ? docs : docs.filter((d) => (d.cat || 'Ostatní') === active)), [docs, active])

  async function upload(files: FileList | null) {
    if (!files || !files.length || busy) return
    setBusy(true)
    try { await api.uploadDocument(bid, files[0], { cat, vis }); reload(); toast(t('documents:toastUploaded')) }
    catch (e: any) { toast(e.message || t('documents:toastUploadFailed')) } finally { setBusy(false) }
  }
  async function toggleVis(d: DocItem, r: Role) {
    const cur = d.vis || []
    const next = cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]
    if (!next.includes('vybor')) next.push('vybor')
    try { await api.setDocVisibility(d.id!, next); reload() } catch (e: any) { toast(e.message || t('documents:toastSaveFailed')) }
  }
  async function open(d: DocItem) {
    try { const url = await api.openDocument(d); if (url) window.open(url, '_blank'); else toast(t('documents:toastDemoDoc')) }
    catch (e: any) { toast(e.message || t('documents:toastOpenFailed')) }
  }
  async function del(d: DocItem) {
    if (!window.confirm(t('documents:confirmDelete', { name: d.name }))) return
    try { await api.deleteDocument(d); reload(); toast(t('documents:toastDeleted')) } catch (e: any) { toast(e.message || t('documents:toastDeleteFailed')) }
  }

  if (!user) return null

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>{t('documents:title')}</h2>
          <p>{manage ? t('documents:subtitleManage') : t('documents:subtitleResident')}</p>
        </div>
        {manage && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="s-btn s-ghost sm" value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('documents:categoryAria')}>
              {CATS.map((c) => <option key={c} value={c}>{docCatLabel(c, t)}</option>)}
            </select>
            <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={(e) => upload(e.target.files)} />
            <button className="s-btn s-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? t('documents:uploading') : t('documents:upload')}
            </button>
          </div>
        )}
      </div>

      <div className="dc-grid" style={{ marginTop: 18 }}>
        <div className="dc-cats an">
          {cats.map((c) => (
            <button key={c.name} className={'dc-cat' + (active === c.name ? ' on' : '')} onClick={() => setActive(c.name)}>
              <SIcon n="doc" s={15} /><span>{c.label}</span><span className="n">{c.n}</span>
            </button>
          ))}
        </div>

        <div className="s-card an" style={{ overflow: 'hidden', ['--d' as string]: '.06s' }}>
          {shown.length === 0 && (
            <div className="d-empty">
              {manage ? t('documents:emptyManage') : t('documents:emptyResident')}
            </div>
          )}
          {shown.map((d) => (
            <div className="dc-file" key={d.id || d.name}>
              <span className="ic">{(d.kind || 'PDF').slice(0, 4).toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{d.name}</b>
                <span>{d.cat ? docCatLabel(d.cat, t) + ' · ' : ''}{d.date}</span>
                {manage && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
                    {VIS.map((r) => (
                      <button key={r.k} className={'a-chip' + ((d.vis || []).includes(r.k) ? ' on' : '')}
                        style={{ fontSize: 10.5, padding: '4px 9px' }} onClick={() => toggleVis(d, r.k)}>{r.l}</button>
                    ))}
                  </div>
                )}
              </div>
              {!manage && <span className="dc-vis">{t('documents:visible')}</span>}
              <button className="s-btn s-ghost sm" onClick={() => open(d)}>{t('documents:open')}</button>
              {manage && <button className="s-btn s-ghost sm" onClick={() => del(d)}>{t('documents:delete')}</button>}
            </div>
          ))}
          {manage && shown.length > 0 && (
            <div className="d-foot"><span className="m">{t('documents:visLegend')}</span></div>
          )}
        </div>
      </div>
    </>
  )
}
