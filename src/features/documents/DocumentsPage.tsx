import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { DocItem, Role } from '../../lib/types'
import { can } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { SIcon } from '../../components/AppShell'

const CATS = ['Stanovy a právní', 'Zápisy', 'Vyúčtování', 'Revize', 'Smlouvy', 'Schůze', 'Ostatní']
const VIS: { k: Role; l: string }[] = [
  { k: 'rezident', l: 'Rezidenti' }, { k: 'vybor', l: 'Výbor' },
  { k: 'developer', l: 'Developer' }, { k: 'investor', l: 'Investor' },
]

// Dokumenty (handoff 4e): stanovy, zápisy, vyúčtování na jednom místě,
// viditelnost po rolích. Rezident vidí jen to, co má; výbor spravuje práva.
export default function DocumentsPage() {
  const { user } = useSession()
  const toast = useToast()
  const role = user?.role
  const bid = user?.buildingId || ''
  const manage = role ? can(role, 'manage_meetings') : false

  const [docs, setDocs] = useState<DocItem[]>([])
  const [active, setActive] = useState('Vše')
  const [cat, setCat] = useState(CATS[0])
  const [vis, setVis] = useState<Role[]>(['rezident', 'vybor', 'developer', 'investor'])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = () => { if (bid && role) api.getDocuments(bid, role).then(setDocs).catch(console.error) }
  useEffect(() => { reload() }, [bid, role])

  const cats = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const d of docs) counts[d.cat || 'Ostatní'] = (counts[d.cat || 'Ostatní'] || 0) + 1
    return [{ name: 'Vše', n: docs.length }, ...CATS.filter((c) => counts[c]).map((c) => ({ name: c, n: counts[c] }))]
  }, [docs])
  const shown = useMemo(() => (active === 'Vše' ? docs : docs.filter((d) => (d.cat || 'Ostatní') === active)), [docs, active])

  async function upload(files: FileList | null) {
    if (!files || !files.length || busy) return
    setBusy(true)
    try { await api.uploadDocument(bid, files[0], { cat, vis }); reload(); toast('Dokument nahrán') }
    catch (e: any) { toast(e.message || 'Nahrání selhalo') } finally { setBusy(false) }
  }
  async function toggleVis(d: DocItem, r: Role) {
    const cur = d.vis || []
    const next = cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]
    if (!next.includes('vybor')) next.push('vybor')
    try { await api.setDocVisibility(d.id!, next); reload() } catch (e: any) { toast(e.message || 'Uložení selhalo') }
  }
  async function open(d: DocItem) {
    try { const url = await api.openDocument(d); if (url) window.open(url, '_blank'); else toast('Dokument je ukázkový') }
    catch (e: any) { toast(e.message || 'Otevření selhalo') }
  }
  async function del(d: DocItem) {
    if (!window.confirm(`Smazat ${d.name}?`)) return
    try { await api.deleteDocument(d); reload(); toast('Dokument smazán') } catch (e: any) { toast(e.message || 'Smazání selhalo') }
  }

  if (!user) return null

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>Dokumenty</h2>
          <p>{manage ? 'Stanovy, zápisy a vyúčtování na jednom místě. Viditelnost řídíte po rolích.' : 'Vše důležité k domu na jednom místě. Vidíte to, co je pro vaši roli.'}</p>
        </div>
        {manage && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="s-btn s-ghost sm" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategorie">
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={(e) => upload(e.target.files)} />
            <button className="s-btn s-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? 'Nahrávám…' : 'Nahrát dokument'}
            </button>
          </div>
        )}
      </div>

      <div className="dc-grid" style={{ marginTop: 18 }}>
        <div className="dc-cats an">
          {cats.map((c) => (
            <button key={c.name} className={'dc-cat' + (active === c.name ? ' on' : '')} onClick={() => setActive(c.name)}>
              <SIcon n="doc" s={15} /><span>{c.name}</span><span className="n">{c.n}</span>
            </button>
          ))}
        </div>

        <div className="s-card an" style={{ overflow: 'hidden', ['--d' as string]: '.06s' }}>
          {shown.length === 0 && (
            <div className="d-empty">
              {manage ? 'Zatím tu nic není. Nahrajte stanovy, poslední zápis nebo vyúčtování.' : 'Pro vaši roli tu zatím nejsou žádné dokumenty.'}
            </div>
          )}
          {shown.map((d) => (
            <div className="dc-file" key={d.id || d.name}>
              <span className="ic">{(d.kind || 'PDF').slice(0, 4).toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{d.name}</b>
                <span>{d.cat ? d.cat + ' · ' : ''}{d.date}</span>
                {manage && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
                    {VIS.map((r) => (
                      <button key={r.k} className={'a-chip' + ((d.vis || []).includes(r.k) ? ' on' : '')}
                        style={{ fontSize: 10.5, padding: '4px 9px' }} onClick={() => toggleVis(d, r.k)}>{r.l}</button>
                    ))}
                  </div>
                )}
              </div>
              {!manage && <span className="dc-vis">viditelné</span>}
              <button className="s-btn s-ghost sm" onClick={() => open(d)}>Otevřít</button>
              {manage && <button className="s-btn s-ghost sm" onClick={() => del(d)}>Smazat</button>}
            </div>
          ))}
          {manage && shown.length > 0 && (
            <div className="d-foot"><span className="m">Zelené role dokument vidí. Výbor má vždy přístup. Odkaz na otevření je podepsaný a časově omezený.</span></div>
          )}
        </div>
      </div>
    </>
  )
}
