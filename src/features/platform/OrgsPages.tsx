// Operátor / Organizace: list, creation, and full per organization detail with
// units, members and access codes management.
import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { roleNames } from '../../lib/types'
import type { Role } from '../../lib/types'
import { platformApi, operatorApi } from '../../lib/platformApi'
import type { PlatformBuilding, UnitRow } from '../../lib/platformApi'
import { adminApi } from '../../lib/adminApi'
import type { LiveMember, LiveCode } from '../../lib/adminApi'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'
import { useSession } from '../../state/session'

const codePrefix = (slug: string) =>
  'TL-' + (slug || 'x').split('-').map((w) => (w[0] || '')).join('').toUpperCase().slice(0, 4)

export function OrgsPage() {
  const toast = useToast()
  const [buildings, setBuildings] = useState<PlatformBuilding[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState(''); const [slug, setSlug] = useState(''); const [unitsTxt, setUnitsTxt] = useState('')
  const [busy, setBusy] = useState(false)
  const autoSlug = (n: string) => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  async function reload() { setBuildings(await platformApi.listBuildings()); setLoading(false) }
  useEffect(() => { reload().catch((e: any) => { setLoading(false); toast('Načtení selhalo: ' + (e.message || e)) }) }, [])

  async function create() {
    if (!name) { toast('Zadejte název organizace'); return }
    setBusy(true)
    try {
      await platformApi.createBuilding(name, slug || autoSlug(name), unitsTxt.split(/[\n,]/))
      toast('Organizace založena: ' + name)
      setName(''); setSlug(''); setUnitsTxt('')
      await reload()
    } catch (e: any) { toast('Chyba: ' + (e.message || e)) } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="view-head"><div><h1>Organizace</h1><div className="desc">Domy a společenství na platformě</div></div></div>
      <div className="grid-2">
        <div className="card" style={{ padding: 0 }}>
          <div className="card-h" style={{ padding: '16px 18px 0' }}><h3>Seznam</h3><span className="adm-mini">{buildings.length} organizací</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Název</th><th>Členové</th><th>Jednotky</th><th>Příspěvky</th><th></th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={5} className="adm-mini" style={{ padding: 18 }}>Načítání...</td></tr>}
                {buildings.map((b) => (
                  <tr key={b.id}>
                    <td><b style={{ fontWeight: 600 }}>{b.name}</b><br /><span className="adm-mini mono">{b.slug}</span></td>
                    <td>{b.members}</td><td>{b.units}</td><td>{b.posts}</td>
                    <td style={{ textAlign: 'right' }}><Link className="btn btn-ghost btn-sm" to={'/operator/organizace/' + b.id}>Spravovat</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Nová organizace</h3></div>
          <div className="field"><label>Název</label><input className="input" value={name} onChange={(e) => { setName(e.target.value); setSlug(autoSlug(e.target.value)) }} placeholder="Rezidence Hřebenky" /></div>
          <div className="field"><label>Slug</label><input className="input mono" value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
          <div className="field"><label>Jednotky (oddělené čárkou nebo řádky)</label>
            <textarea className="input" rows={3} value={unitsTxt} onChange={(e) => setUnitsTxt(e.target.value)} placeholder="A-101, A-102, B-201" />
          </div>
          <button className="btn btn-primary" onClick={create} disabled={busy}>{busy ? 'Zakládám...' : 'Založit organizaci'}</button>
          <p className="adm-mini" style={{ marginTop: 10 }}>Po založení otevřete detail a vytvořte v Klientech účet výboru pro tuto organizaci.</p>
        </div>
      </div>
    </div>
  )
}

export function OrgDetailPage() {
  const toast = useToast()
  const nav = useNavigate()
  const { user } = useSession()
  const { id } = useParams<{ id: string }>()
  const bid = id || ''
  const [org, setOrg] = useState<PlatformBuilding | null>(null)
  const [units, setUnits] = useState<UnitRow[]>([])
  const [members, setMembers] = useState<LiveMember[]>([])
  const [codes, setCodes] = useState<LiveCode[]>([])
  const [loading, setLoading] = useState(true)
  const [newUnit, setNewUnit] = useState('')
  const [codeRole, setCodeRole] = useState<Role>('rezident')
  const [codeUnit, setCodeUnit] = useState('')

  async function reload() {
    const [bs, us, ms, cs] = await Promise.all([
      platformApi.listBuildings(), operatorApi.unitsWithCounts(bid),
      adminApi.listMembers(bid), adminApi.listCodes(bid),
    ])
    setOrg(bs.find((b) => b.id === bid) || null)
    setUnits(us); setMembers(ms); setCodes(cs); setLoading(false)
  }
  useEffect(() => { reload().catch((e: any) => { setLoading(false); toast('Načtení selhalo: ' + (e.message || e)) }) }, [bid])

  async function run(fn: () => Promise<void>, ok: string) {
    try { await fn(); toast(ok); await reload() } catch (e: any) { toast('Chyba: ' + (e.message || e)) }
  }

  if (loading) return <div className="card"><p className="adm-mini">Načítání organizace...</p></div>
  if (!org) return <div className="card"><p className="adm-mini">Organizace nenalezena. <Link to="/operator/organizace">Zpět na seznam</Link></p></div>

  const prefix = codePrefix(org.slug)

  function rename() {
    const n = window.prompt('Nový název organizace', org!.name)
    if (n && n !== org!.name) run(() => operatorApi.renameBuilding(bid, n), 'Přejmenováno')
  }
  function addUnit() {
    if (!newUnit.trim()) return
    run(() => operatorApi.addUnit(bid, newUnit.trim()), 'Jednotka přidána').then(() => setNewUnit(''))
  }
  function renameUnit(u: UnitRow) {
    const n = window.prompt('Nové označení jednotky', u.label)
    if (n && n !== u.label) run(() => operatorApi.renameUnit(u.id, n), 'Jednotka přejmenována')
  }
  function delUnit(u: UnitRow) {
    const warn = u.members > 0 ? ` Jednotku má přiřazenou ${u.members} členů, těm se odebere.` : ''
    if (window.confirm(`Smazat jednotku ${u.label}?` + warn)) run(() => operatorApi.deleteUnit(u.id), 'Jednotka smazána')
  }
  function genCode() {
    run(async () => {
      const c = await adminApi.createCode(bid, codeRole, codeRole === 'rezident' && codeUnit ? codeUnit : null, prefix)
      toast('Kód vytvořen: ' + c)
    }, 'Hotovo')
  }

  return (
    <div>
      <div className="view-head">
        <div>
          <h1>{org.name}</h1>
          <div className="desc mono">{org.slug} · {org.members} členů · {org.units} jednotek · {org.posts} příspěvků</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/operator/organizace')}>Zpět</button>
          <button className="btn btn-soft btn-sm" onClick={rename}>Přejmenovat</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-h"><h3>Jednotky</h3><span className="adm-mini">{units.length}</span></div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input className="input" style={{ flex: 1 }} placeholder="Nová jednotka, např. B-301" value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addUnit()} />
            <button className="btn btn-soft btn-sm" onClick={addUnit}><Icon name="plus" small /> Přidat</button>
          </div>
          {units.map((u) => (
            <div className="doc-row" key={u.id}>
              <span className="cf-ic"><Icon name="najmy" small /></span>
              <div style={{ flex: 1, minWidth: 0 }}><b className="mono" style={{ fontSize: 13.5 }}>{u.label}</b><span>{u.members} členů</span></div>
              <button className="btn btn-ghost btn-sm" onClick={() => renameUnit(u)}>Upravit</button>
              <button className="btn btn-ghost btn-sm" onClick={() => delUnit(u)}><Icon name="x" small /></button>
            </div>
          ))}
          {units.length === 0 && <p className="adm-mini">Žádné jednotky.</p>}
        </div>

        <div className="card">
          <div className="card-h"><h3>Přístupové kódy</h3><span className="adm-mini mono">{prefix}-…</span></div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <select className="input" style={{ flex: 1, minWidth: 110 }} value={codeRole} onChange={(e) => setCodeRole(e.target.value as Role)}>
              {(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
            </select>
            {codeRole === 'rezident' && (
              <select className="input" style={{ flex: 1, minWidth: 110 }} value={codeUnit} onChange={(e) => setCodeUnit(e.target.value)}>
                <option value="">Bez jednotky</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            )}
            <button className="btn btn-soft btn-sm" onClick={genCode}><Icon name="plus" small /> Vygenerovat</button>
          </div>
          {codes.map((c) => (
            <div className="doc-row" key={c.code}>
              <span className="cf-ic"><Icon name={c.used ? 'check' : 'clock'} small /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b className="mono" style={{ fontSize: 13.5 }}>{c.code}</b>
                <span>{roleNames[c.role]}{c.unit ? ' · ' + c.unit : ''} · {c.created}</span>
              </div>
              {c.used ? <span className="pill pill-neutral">Použit</span>
                : <button className="btn btn-ghost btn-sm" onClick={() => run(() => adminApi.deleteCode(c.code), 'Kód smazán')}>Smazat</button>}
            </div>
          ))}
          {codes.length === 0 && <p className="adm-mini">Žádné kódy.</p>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, padding: 0 }}>
        <div className="card-h" style={{ padding: '16px 18px 0' }}><h3>Členové</h3><span className="adm-mini">{members.length} osob</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Jméno</th><th>Jednotka</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {members.length === 0 && <tr><td colSpan={4} className="adm-mini" style={{ padding: 18 }}>Zatím nikdo. Založte účet v Klientech nebo pošlete kód.</td></tr>}
              {members.map((m) => (
                <tr key={m.membershipId}>
                  <td><b style={{ fontWeight: 600 }}>{m.name}</b><br /><span className="adm-mini">{m.email || 'bez e-mailu'} · od {m.since}</span></td>
                  <td className="mono">{m.unit || <span className="adm-mini">bez jednotky</span>}</td>
                  <td>
                    <select className="input" style={{ padding: '4px 8px', fontSize: 12.5, width: 'auto' }} value={m.role}
                      onChange={(e) => run(() => platformApi.setMembershipRole(m.membershipId, e.target.value as Role), 'Role změněna')}
                      disabled={m.userId === user?.userId}>
                      {(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {m.userId !== user?.userId && (
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => window.confirm(`Odebrat ${m.name} z organizace?`) && run(() => platformApi.removeMembership(m.membershipId), 'Člen odebrán')}>
                        Odebrat
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
