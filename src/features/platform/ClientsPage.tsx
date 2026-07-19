// Operátor / Klienti: all platform accounts with filters and full management.
import { useEffect, useState } from 'react'
import { roleNames } from '../../lib/types'
import type { Role } from '../../lib/types'
import { platformApi } from '../../lib/platformApi'
import type { PlatformUser, PlatformBuilding, PUnit } from '../../lib/platformApi'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'
import { useSession } from '../../state/session'

export default function ClientsPage() {
  const toast = useToast()
  const { user } = useSession()
  const me = user?.userId || ''
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [buildings, setBuildings] = useState<PlatformBuilding[]>([])
  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState('')
  const [fOrg, setFOrg] = useState('')
  const [fStatus, setFStatus] = useState('vse')

  const [showNew, setShowNew] = useState(false)
  const [nName, setNName] = useState(''); const [nEmail, setNEmail] = useState(''); const [nPw, setNPw] = useState('')
  const [nBid, setNBid] = useState(''); const [nRole, setNRole] = useState<Role>('rezident'); const [nUnit, setNUnit] = useState('')
  const [units, setUnits] = useState<PUnit[]>([])
  const [busy, setBusy] = useState(false)
  const [unitsByB, setUnitsByB] = useState<Record<string, PUnit[]>>({})
  const [addFor, setAddFor] = useState('')
  const [aBid, setABid] = useState(''); const [aRole, setARole] = useState<Role>('rezident'); const [aUnit, setAUnit] = useState('')

  async function reload() {
    const [u, b, ub] = await Promise.all([platformApi.listUsers(), platformApi.listBuildings(), platformApi.allUnits().catch(() => ({}))])
    setUsers(u); setBuildings(b); setUnitsByB(ub); setLoading(false)
  }
  useEffect(() => { reload().catch((e: any) => { setLoading(false); toast('Načtení selhalo: ' + (e.message || e)) }) }, [])

  useEffect(() => {
    if (nBid && nRole === 'rezident') platformApi.listUnitsOf(nBid).then(setUnits).catch(() => setUnits([]))
    else setUnits([])
    setNUnit('')
  }, [nBid, nRole])

  const filtered = users.filter((u) => {
    if (q && !(u.email.toLowerCase().includes(q.toLowerCase()) || u.name.toLowerCase().includes(q.toLowerCase()))) return false
    if (fOrg && !u.memberships.some((m) => m.buildingId === fOrg)) return false
    if (fStatus === 'blokovani' && !u.banned) return false
    if (fStatus === 'aktivni' && u.banned) return false
    if (fStatus === 'bez' && u.memberships.length > 0) return false
    return true
  })

  async function run(fn: () => Promise<void>, ok: string) {
    try { await fn(); toast(ok); await reload() } catch (e: any) { toast('Chyba: ' + (e.message || e)) }
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
      await reload()
    } catch (e: any) { toast('Chyba: ' + (e.message || e)) } finally { setBusy(false) }
  }

  function askName(u: PlatformUser) {
    const n = window.prompt('Jméno a příjmení pro ' + u.email, u.name)
    if (n !== null && n.trim() && n !== u.name) run(() => platformApi.updateProfile(u.id, n.trim()), 'Jméno změněno')
  }
  async function submitAdd(u: PlatformUser) {
    if (!aBid) { toast('Vyberte dům'); return }
    try {
      await platformApi.addMembership(u.id, aBid, aRole, aUnit || null)
      toast('Přidán do domu')
      setAddFor(''); setABid(''); setARole('rezident'); setAUnit('')
      await reload()
    } catch (e: any) { toast('Chyba: ' + (e.message || e)) }
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

  return (
    <div>
      <div className="view-head">
        <div><h1>Klienti</h1><div className="desc">Všechny účty na platformě, jejich přístupy a členství</div></div>
        <button className="btn btn-primary" onClick={() => setShowNew((s) => !s)}><Icon name="plus" small /> Nový účet</button>
      </div>

      {showNew && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h"><h3>Nový účet</h3></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
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
            <button className="btn btn-primary" onClick={createUser} disabled={busy}>{busy ? 'Vytvářím...' : 'Vytvořit účet'}</button>
          </div>
          <p className="adm-mini" style={{ marginTop: 8 }}>Účet je hned aktivní, pošlete člověku e-mail a heslo. Heslo si pak může změnit v Nastavení.</p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 2, minWidth: 180 }} placeholder="Hledat jméno nebo e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" style={{ flex: 1, minWidth: 140 }} value={fOrg} onChange={(e) => setFOrg(e.target.value)}>
            <option value="">Všechny organizace</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className="input" style={{ flex: 1, minWidth: 130 }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="vse">Všichni</option>
            <option value="aktivni">Aktivní</option>
            <option value="blokovani">Blokovaní</option>
            <option value="bez">Bez organizace</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-h" style={{ padding: '16px 18px 0' }}><h3>Účty</h3><span className="adm-mini">{filtered.length} z {users.length}</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Účet</th><th>Členství</th><th>Poslední přihlášení</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="spin" style={{ padding: 18, display: 'table-cell' }}>Načítání</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={4} className="adm-mini" style={{ padding: 18 }}>Nic nenalezeno.</td></tr>}
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b style={{ fontWeight: 600 }}>{u.name || 'Bez jména'}</b>
                    {u.banned && <span className="pill pill-bad" style={{ marginLeft: 6 }}>Blokován</span>}
                    {u.id === me && <span className="pill pill-ok" style={{ marginLeft: 6 }}>Vy</span>}
                    <br /><span className="adm-mini">{u.email} · od {u.created}</span>
                  </td>
                  <td>
                    {u.memberships.length === 0 && <span className="adm-mini">Žádné</span>}
                    {u.memberships.map((m) => (
                      <div key={m.membershipId} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span className="adm-mini">{m.building}</span>
                        <select className="input" style={{ padding: '2px 6px', fontSize: 12, width: 'auto' }} value={m.unitId || ''}
                          title="Jednotka"
                          onChange={(e) => run(() => platformApi.setMembershipUnit(m.membershipId, e.target.value || null), 'Jednotka změněna')}>
                          <option value="">Bez jednotky</option>
                          {(unitsByB[m.buildingId] || []).map((un) => <option key={un.id} value={un.id}>{un.label}</option>)}
                        </select>
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
                    {addFor === u.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        <select className="input" style={{ padding: '2px 6px', fontSize: 12, width: 'auto' }} value={aBid} onChange={(e) => { setABid(e.target.value); setAUnit('') }}>
                          <option value="">Vyberte dům…</option>
                          {buildings.filter((b) => !u.memberships.some((m) => m.buildingId === b.id)).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <select className="input" style={{ padding: '2px 6px', fontSize: 12, width: 'auto' }} value={aRole} onChange={(e) => setARole(e.target.value as Role)}>
                          {(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
                        </select>
                        {aBid && (
                          <select className="input" style={{ padding: '2px 6px', fontSize: 12, width: 'auto' }} value={aUnit} onChange={(e) => setAUnit(e.target.value)}>
                            <option value="">Bez jednotky</option>
                            {(unitsByB[aBid] || []).map((un) => <option key={un.id} value={un.id}>{un.label}</option>)}
                          </select>
                        )}
                        <button className="btn btn-soft btn-sm" style={{ padding: '2px 10px' }} onClick={() => submitAdd(u)}>Přidat</button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => setAddFor('')}>Zrušit</button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', marginTop: 2 }} onClick={() => { setAddFor(u.id); setABid(''); setARole('rezident'); setAUnit('') }}>
                        <Icon name="plus" small /> Přidat do domu
                      </button>
                    )}
                  </td>
                  <td className="adm-mini">{u.lastLogin}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => askName(u)}>Jméno</button>
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
    </div>
  )
}
