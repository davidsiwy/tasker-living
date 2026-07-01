// Operátor: platform console above all buildings. Visible only to accounts in
// platform_admins. Clients (all accounts with actions), organizations, activity.
import { useEffect, useState } from 'react'
import { useSession } from '../../state/session'
import { roleNames } from '../../lib/types'
import type { Role } from '../../lib/types'
import { platformApi } from '../../lib/platformApi'
import type { PlatformUser, PlatformBuilding, ActivityRow, PUnit } from '../../lib/platformApi'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'

const TABS = [
  { id: 'prehled', label: 'Přehled' }, { id: 'klienti', label: 'Klienti' },
  { id: 'organizace', label: 'Organizace' }, { id: 'aktivita', label: 'Aktivita' },
]

const KIND_LABEL: Record<string, string> = {
  registrace: 'Registrace', prihlaseni: 'Přihlášení', prispevek: 'Příspěvek', clenstvi: 'Členství',
}
const KIND_ICON: Record<string, string> = {
  registrace: 'kontakty', prihlaseni: 'check', prispevek: 'nastenka', clenstvi: 'najmy',
}

export default function PlatformAdminPage() {
  const { user, isPlatformAdmin } = useSession()
  const toast = useToast()
  const [tab, setTab] = useState('prehled')
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [buildings, setBuildings] = useState<PlatformBuilding[]>([])
  const [acts, setActs] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)

  async function reload() {
    const [u, b, a] = await Promise.all([platformApi.listUsers(), platformApi.listBuildings(), platformApi.activity()])
    setUsers(u); setBuildings(b); setActs(a); setLoading(false)
  }
  useEffect(() => {
    if (!isPlatformAdmin) { setLoading(false); return }
    reload().catch((e: any) => { setLoading(false); toast('Načtení selhalo: ' + (e.message || e)) })
  }, [isPlatformAdmin])

  if (!isPlatformAdmin) {
    return (
      <div>
        <div className="view-head"><div><h1>Operátor</h1></div></div>
        <div className="card"><p className="adm-mini">Tato sekce je jen pro operátory platformy Tasker Living.</p></div>
      </div>
    )
  }

  return (
    <div>
      <div className="view-head">
        <div><h1>Operátor</h1><div className="desc">Celá platforma, všechny účty, organizace a dění napříč domy</div></div>
      </div>
      <div className="adm-tabs">
        {TABS.map((t) => <button key={t.id} className={'adm-tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      {loading && <div className="card"><p className="adm-mini">Načítání platformy...</p></div>}
      {!loading && tab === 'prehled' && <Overview users={users} buildings={buildings} acts={acts} />}
      {!loading && tab === 'klienti' && <Clients users={users} buildings={buildings} me={user?.userId || ''} toast={toast} onChange={reload} />}
      {!loading && tab === 'organizace' && <Orgs buildings={buildings} toast={toast} onChange={reload} />}
      {!loading && tab === 'aktivita' && <Activity acts={acts} />}
    </div>
  )
}

/* ---------------- Přehled ---------------- */
function Overview({ users, buildings, acts }: { users: PlatformUser[]; buildings: PlatformBuilding[]; acts: ActivityRow[] }) {
  const totalUnits = buildings.reduce((s, b) => s + b.units, 0)
  const stats = [
    { k: 'Účty', v: users.length, ic: 'kontakty' },
    { k: 'Organizace', v: buildings.length, ic: 'bank' },
    { k: 'Jednotky', v: totalUnits, ic: 'najmy' },
    { k: 'Událostí dnes', v: acts.filter((a) => a.at.startsWith(new Date().toLocaleDateString('cs-CZ'))).length, ic: 'clock' },
  ]
  return (
    <>
      <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {stats.map((s) => (
          <div className="card" key={s.k}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="cf-ic"><Icon name={s.ic} small /></span>
              <div><div style={{ fontSize: 24, fontWeight: 700 }}>{s.v}</div><div className="adm-mini">{s.k}</div></div>
            </div>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><h3>Poslední dění</h3></div>
        {acts.slice(0, 8).map((a, i) => <ActRow key={i} a={a} />)}
        {acts.length === 0 && <p className="adm-mini">Zatím žádná aktivita.</p>}
      </div>
    </>
  )
}

/* ---------------- Klienti ---------------- */
function Clients({ users, buildings, me, toast, onChange }: {
  users: PlatformUser[]; buildings: PlatformBuilding[]; me: string; toast: (m: string) => void; onChange: () => Promise<void>
}) {
  const [q, setQ] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [nName, setNName] = useState(''); const [nEmail, setNEmail] = useState(''); const [nPw, setNPw] = useState('')
  const [nBid, setNBid] = useState(''); const [nRole, setNRole] = useState<Role>('rezident'); const [nUnit, setNUnit] = useState('')
  const [units, setUnits] = useState<PUnit[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (nBid && nRole === 'rezident') platformApi.listUnitsOf(nBid).then(setUnits).catch(() => setUnits([]))
    else setUnits([])
    setNUnit('')
  }, [nBid, nRole])

  const filtered = users.filter((u) =>
    !q || u.email.toLowerCase().includes(q.toLowerCase()) || u.name.toLowerCase().includes(q.toLowerCase())
    || u.memberships.some((m) => m.building.toLowerCase().includes(q.toLowerCase())))

  async function run(fn: () => Promise<void>, ok: string) {
    try { await fn(); toast(ok); await onChange() } catch (e: any) { toast('Chyba: ' + (e.message || e)) }
  }

  async function createUser() {
    if (!nEmail || !nPw) { toast('E-mail a heslo jsou povinné'); return }
    setBusy(true)
    try {
      await platformApi.createUser({
        email: nEmail, password: nPw, fullName: nName,
        buildingId: nBid || null, role: nBid ? nRole : null, unitId: nRole === 'rezident' && nUnit ? nUnit : null,
      })
      toast('Účet vytvořen: ' + nEmail)
      setShowNew(false); setNName(''); setNEmail(''); setNPw(''); setNBid(''); setNUnit('')
      await onChange()
    } catch (e: any) { toast('Chyba: ' + (e.message || e)) } finally { setBusy(false) }
  }

  function askPassword(u: PlatformUser) {
    const pw = window.prompt('Nové heslo pro ' + u.email)
    if (pw) run(() => platformApi.setPassword(u.id, pw), 'Heslo změněno')
  }
  function askEmail(u: PlatformUser) {
    const em = window.prompt('Nový e-mail pro ' + (u.name || u.email), u.email)
    if (em && em !== u.email) run(() => platformApi.updateEmail(u.id, em), 'E-mail změněn')
  }
  function toggleBan(u: PlatformUser) {
    if (window.confirm(u.banned ? 'Odblokovat ' + u.email + '?' : 'Zablokovat přístup pro ' + u.email + '?'))
      run(() => platformApi.setBan(u.id, !u.banned), u.banned ? 'Účet odblokován' : 'Účet zablokován')
  }
  function delUser(u: PlatformUser) {
    if (window.confirm('Trvale smazat účet ' + u.email + '? Zmizí i jeho členství a příspěvky.'))
      run(() => platformApi.deleteUser(u.id), 'Účet smazán')
  }
  function addMem(u: PlatformUser) {
    const b = buildings[0]
    if (!b) { toast('Nejdřív založte organizaci'); return }
    const pick = window.prompt('Do které organizace? Napište název.\n' + buildings.map((x) => x.name).join('\n'), b.name)
    const target = buildings.find((x) => x.name.toLowerCase() === (pick || '').toLowerCase())
    if (!target) return
    run(() => platformApi.addMembership(u.id, target.id, 'rezident', null), 'Členství přidáno, roli upravte v řádku')
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Hledat jméno, e-mail nebo organizaci" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew((s) => !s)}><Icon name="plus" small /> Nový účet</button>
        </div>
        {showNew && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginTop: 12 }}>
            <input className="input" placeholder="Jméno a příjmení" value={nName} onChange={(e) => setNName(e.target.value)} />
            <input className="input" type="email" placeholder="E-mail" value={nEmail} onChange={(e) => setNEmail(e.target.value)} />
            <input className="input" placeholder="Heslo" value={nPw} onChange={(e) => setNPw(e.target.value)} />
            <select className="input" value={nBid} onChange={(e) => setNBid(e.target.value)}>
              <option value="">Bez organizace</option>
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {nBid && (
              <select className="input" value={nRole} onChange={(e) => setNRole(e.target.value as Role)}>
                {(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
              </select>
            )}
            {nBid && nRole === 'rezident' && (
              <select className="input" value={nUnit} onChange={(e) => setNUnit(e.target.value)}>
                <option value="">Bez jednotky</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            )}
            <button className="btn btn-primary btn-sm" onClick={createUser} disabled={busy}>{busy ? 'Vytvářím...' : 'Vytvořit účet'}</button>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-h" style={{ padding: '16px 18px 0' }}><h3>Klienti</h3><span className="adm-mini">{filtered.length} účtů</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Účet</th><th>Členství</th><th>Poslední přihlášení</th><th></th></tr></thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b style={{ fontWeight: 600 }}>{u.name || 'Bez jména'}</b>{u.banned && <span className="pill pill-bad" style={{ marginLeft: 6 }}>Blokován</span>}
                    <br /><span className="adm-mini">{u.email} · od {u.created}</span>
                  </td>
                  <td>
                    {u.memberships.length === 0 && <span className="adm-mini">Žádné</span>}
                    {u.memberships.map((m) => (
                      <div key={m.membershipId} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span className="adm-mini" style={{ minWidth: 0 }}>{m.building}{m.unit ? ' · ' + m.unit : ''}</span>
                        <select className="input" style={{ padding: '2px 6px', fontSize: 12, width: 'auto' }} value={m.role}
                          onChange={(e) => run(() => platformApi.setMembershipRole(m.membershipId, e.target.value as Role), 'Role změněna')}>
                          {(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
                        </select>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} title="Odebrat z organizace"
                          onClick={() => window.confirm('Odebrat ' + (u.name || u.email) + ' z ' + m.building + '?') && run(() => platformApi.removeMembership(m.membershipId), 'Členství odebráno')}>
                          <Icon name="x" small />
                        </button>
                      </div>
                    ))}
                    <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => addMem(u)}><Icon name="plus" small /> členství</button>
                  </td>
                  <td className="adm-mini">{u.lastLogin}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => askPassword(u)}>Heslo</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => askEmail(u)}>E-mail</button>
                    {u.id !== me && <button className="btn btn-ghost btn-sm" onClick={() => toggleBan(u)}>{u.banned ? 'Odblokovat' : 'Blokovat'}</button>}
                    {u.id !== me && <button className="btn btn-ghost btn-sm" onClick={() => delUser(u)}>Smazat</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/* ---------------- Organizace ---------------- */
function Orgs({ buildings, toast, onChange }: { buildings: PlatformBuilding[]; toast: (m: string) => void; onChange: () => Promise<void> }) {
  const [name, setName] = useState(''); const [slug, setSlug] = useState(''); const [unitsTxt, setUnitsTxt] = useState('')
  const [busy, setBusy] = useState(false)
  const autoSlug = (n: string) => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  async function create() {
    if (!name) { toast('Zadejte název organizace'); return }
    setBusy(true)
    try {
      await platformApi.createBuilding(name, slug || autoSlug(name), unitsTxt.split(/[\n,]/))
      toast('Organizace založena: ' + name)
      setName(''); setSlug(''); setUnitsTxt('')
      await onChange()
    } catch (e: any) { toast('Chyba: ' + (e.message || e)) } finally { setBusy(false) }
  }

  return (
    <div className="grid-2">
      <div className="card" style={{ padding: 0 }}>
        <div className="card-h" style={{ padding: '16px 18px 0' }}><h3>Organizace</h3><span className="adm-mini">{buildings.length} domů</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Název</th><th>Slug</th><th>Jednotky</th><th>Členové</th></tr></thead>
            <tbody>
              {buildings.map((b) => (
                <tr key={b.id}>
                  <td><b style={{ fontWeight: 600 }}>{b.name}</b></td>
                  <td className="mono">{b.slug}</td>
                  <td>{b.units}</td>
                  <td>{b.members}</td>
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
        <p className="adm-mini" style={{ marginTop: 10 }}>Po založení vytvořte v Klientech účet výboru a přiřaďte ho k organizaci, tím dům ožije.</p>
      </div>
    </div>
  )
}

/* ---------------- Aktivita ---------------- */
function ActRow({ a }: { a: ActivityRow }) {
  return (
    <div className="doc-row">
      <span className="cf-ic"><Icon name={KIND_ICON[a.kind] || 'check'} small /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontWeight: 600 }}>{a.actor || 'Systém'}</b>
        <span>{KIND_LABEL[a.kind] || a.kind}{a.detail ? ' · ' + a.detail : ''}</span>
      </div>
      <span className="adm-mini" style={{ whiteSpace: 'nowrap' }}>{a.at}</span>
    </div>
  )
}

function Activity({ acts }: { acts: ActivityRow[] }) {
  return (
    <div className="card">
      <div className="card-h"><h3>Aktivita platformy</h3><span className="adm-mini">{acts.length} událostí</span></div>
      {acts.map((a, i) => <ActRow key={i} a={a} />)}
      {acts.length === 0 && <p className="adm-mini">Zatím žádná aktivita.</p>}
    </div>
  )
}
