import { useEffect, useState } from 'react'
import { api, feed } from '../../lib/api'
import type { AccessCode, Resident } from '../../lib/types'
import { can } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'

export default function AdminPage() {
  const { user } = useSession()
  const toast = useToast()
  const [codes, setCodes] = useState<AccessCode[]>([])
  const [residents, setResidents] = useState<Resident[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const allowed = user ? can(user.role, 'admin') : false
  useEffect(() => { if (allowed) { api.getCodes().then(setCodes); api.getResidents().then(setResidents) } }, [allowed])

  if (!user || !allowed) {
    return (
      <div>
        <div className="view-head"><div><h1>Správa domu</h1></div></div>
        <div className="empty"><span className="cf-ic"><Icon name="sprava" /></span><p>Správa je dostupná jen výboru a developerovi.</p></div>
      </div>
    )
  }
  async function gen() { const c = await api.generateCode(); setCodes((s) => [c, ...s]); toast(`Kód vytvořen: ${c.code}`) }
  async function announce() {
    if (!title.trim()) { toast('Zadejte nadpis'); return }
    const text = body.trim() ? `${title}\n\n${body}` : title
    await feed.createPost({ buildingId: user!.buildingId, author: { name: 'Výbor SVJ', handle: 'vybor', role: user!.role }, kind: 'ozn', body: text })
    setTitle(''); setBody(''); toast('Oznámení publikováno na nástěnku')
  }

  return (
    <div>
      <div className="view-head"><div><h1>Správa domu</h1><div className="desc">Přístupové kódy, oznámení a obyvatelé</div></div></div>
      <div className="grid-2">
        <div className="stat">
          <div className="card-h"><h3>Přístupové kódy</h3><button className="btn btn-soft btn-sm" onClick={gen}><Icon name="plus" small /> Vygenerovat</button></div>
          {codes.map((c) => (
            <div className="doc-row" key={c.code}><span className="cf-ic"><Icon name="check" small /></span><div style={{ flex: 1 }}><b className="mono">{c.code}</b><span>{c.unit}</span></div>{c.used ? <span className="pill pill-neutral">Použit</span> : <span className="pill pill-ok">Aktivní</span>}</div>
          ))}
        </div>
        <div className="stat">
          <div className="card-h"><h3>Rychlé oznámení</h3></div>
          <div className="field"><label>Nadpis</label><input className="input" placeholder="Např. Odstávka výtahu" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field"><label>Text</label><textarea className="input" placeholder="Detaily oznámení..." value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <button className="btn btn-primary btn-sm" onClick={announce}><Icon name="send" small /> Publikovat na nástěnku</button>
        </div>
      </div>
      <div className="stat" style={{ marginTop: 16 }}>
        <div className="card-h"><h3>Obyvatelé</h3><span className="sub">{residents.length} v domě</span></div>
        <div className="tbl-scroll">
        <table className="tbl">
          <thead><tr><th>Jméno</th><th>Jednotka</th><th>Role</th></tr></thead>
          <tbody>{residents.map((r) => (<tr key={r.name}><td>{r.name}</td><td className="mono">{r.unit}</td><td>{r.role}</td></tr>))}</tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
