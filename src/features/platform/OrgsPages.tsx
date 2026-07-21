// Operátor / Organizace: list, creation, and full per organization detail with
// units, members and access codes management.
import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { roleNames } from '../../lib/types'
import type { Role, UnitFull } from '../../lib/types'
import { platformApi, operatorApi } from '../../lib/platformApi'
import type { OpCharge, PlatformBuilding, UnitRow } from '../../lib/platformApi'
import { czPlural } from '../../lib/types'
import { adminApi } from '../../lib/adminApi'
import { BankCard } from '../../components/BankCard'
import { api, currentPeriod, periodLabel, prevPeriod, nextPeriod } from '../../lib/api'
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
            <table className="tbl tbl-cards">
              <thead><tr><th>Název</th><th>Členové</th><th>Jednotky</th><th>Příspěvky</th><th></th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={5} className="spin" style={{ padding: 18, display: 'table-cell' }}>Načítání</td></tr>}
                {buildings.map((b) => (
                  <tr key={b.id}>
                    <td data-label="Název"><b style={{ fontWeight: 600 }}>{b.name}</b><br /><span className="adm-mini mono">{b.slug}</span></td>
                    <td data-label="Členové">{b.members}</td><td data-label="Jednotky">{b.units}</td><td data-label="Příspěvky">{b.posts}</td>
                    <td data-label="" style={{ textAlign: 'right' }}><Link className="btn btn-ghost btn-sm" to={'/operator/organizace/' + b.id}>Spravovat</Link></td>
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
  const [period, setPeriod] = useState(currentPeriod())
  const [fullUnits, setFullUnits] = useState<UnitFull[]>([])
  const [editU, setEditU] = useState<UnitFull | null>(null)
  const [acct, setAcct] = useState(''); const [rcpt, setRcpt] = useState(''); const [setBusy, setSetBusy] = useState(false)
  const [charges, setCharges] = useState<OpCharge[]>([])
  const [wipeBusy, setWipeBusy] = useState(false)

  async function reload() {
    const [bs, us, ms, cs, fu, st] = await Promise.all([
      platformApi.listBuildings(), operatorApi.unitsWithCounts(bid),
      adminApi.listMembers(bid), adminApi.listCodes(bid),
      api.getUnitsFull(bid).catch(() => []), api.getBuildingSettings(bid).catch(() => ({ account: '', recipient: '' })),
    ])
    setOrg(bs.find((b) => b.id === bid) || null)
    setUnits(us); setMembers(ms); setCodes(cs); setFullUnits(fu)
    setAcct(st.account); setRcpt(st.recipient)
    setLoading(false)
  }
  useEffect(() => { reload().catch((e: any) => { setLoading(false); toast('Načtení selhalo: ' + (e.message || e)) }) }, [bid])
  useEffect(() => { platformApi.chargesOf(bid, period).then(setCharges).catch(() => setCharges([])) }, [bid, period])

  async function run(fn: () => Promise<void>, ok: string) {
    try { await fn(); toast(ok); await reload() } catch (e: any) { toast('Chyba: ' + (e.message || e)) }
  }

  const czToIso = (v: string) => {
    const m = /^(\d{1,2})\. ?(\d{1,2})\. ?(\d{4})$/.exec(v.trim())
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : ''
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
    <div className="op-orgdetail">
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
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl tbl-cards">
              <thead><tr><th>Jednotka</th><th>Nájemník</th><th>Nájem</th><th>Členů</th><th></th></tr></thead>
              <tbody>
                {fullUnits.map((fu) => {
                  const cnt = units.find((x) => x.id === fu.id)?.members || 0
                  return (
                    <tr key={fu.id}>
                      <td data-label="Jednotka" className="mono" style={{ fontWeight: 600 }}>{fu.label}</td>
                      <td data-label="Nájemník">{fu.tenant || <span className="adm-mini">volné</span>}</td>
                      <td data-label="Nájem" className="mono">{fu.rent ? fu.rent.toLocaleString('cs-CZ') + ' Kč' : ''}</td>
                      <td data-label="Členů" className="adm-mini">{cnt}</td>
                      <td data-label="" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditU({ ...fu })}>Upravit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => delUnit({ id: fu.id, label: fu.label, members: cnt })}><Icon name="x" small /></button>
                      </td>
                    </tr>
                  )
                })}
                {fullUnits.length === 0 && <tr><td colSpan={5} className="adm-mini" style={{ padding: 12 }}>Žádné jednotky.</td></tr>}
              </tbody>
            </table>
          </div>
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
        <div className="card-h" style={{ padding: '16px 18px 0' }}><h3>Členové</h3><span className="adm-mini">{members.length} {czPlural(members.length, 'osoba', 'osoby', 'osob')}</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl tbl-cards">
            <thead><tr><th>Jméno</th><th>Jednotka</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {members.length === 0 && <tr><td colSpan={4} className="adm-mini" style={{ padding: 18 }}>Zatím nikdo. Založte účet v Klientech nebo pošlete kód.</td></tr>}
              {members.map((m) => (
                <tr key={m.membershipId}>
                  <td data-label="Jméno"><b style={{ fontWeight: 600 }}>{m.name}</b><br /><span className="adm-mini">{m.email || 'bez e-mailu'} · od {m.since}</span></td>
                  <td data-label="Jednotka" className="mono">{m.unit || <span className="adm-mini">bez jednotky</span>}</td>
                  <td data-label="Role">
                    <select className="input" style={{ padding: '4px 8px', fontSize: 12.5, width: 'auto' }} value={m.role}
                      onChange={(e) => run(() => platformApi.setMembershipRole(m.membershipId, e.target.value as Role), 'Role změněna')}
                      disabled={m.userId === user?.userId}>
                      {(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
                    </select>
                  </td>
                  <td data-label="" style={{ textAlign: 'right' }}>
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

      <div className="card" style={{ marginTop: 16, padding: 0 }}>
        <div className="card-h op-pay-head" style={{ padding: '16px 18px 0', flexWrap: 'wrap', gap: 10 }}>
          <h3>Platby</h3>
          <div className="op-pay-nav" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPeriod(prevPeriod(period))}>‹</button>
            <span className="mono" style={{ fontSize: 12.5, minWidth: 110, textAlign: 'center' }}>{periodLabel(period)}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPeriod(nextPeriod(period))}>›</button>
            <button className="btn btn-soft btn-sm" onClick={() => run(async () => { const n = await platformApi.generateCharges(bid, period); setCharges(await platformApi.chargesOf(bid, period)); toast(n > 0 ? `Vystaveno ${n} předpisů` : 'Předpisy už existují nebo nejsou nájmy') }, 'Hotovo')}>Vygenerovat předpisy</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl tbl-cards">
            <thead><tr><th>Jednotka</th><th>Položka</th><th>Částka</th><th>VS</th><th>Splatnost</th><th>Stav</th><th></th></tr></thead>
            <tbody>
              {charges.map((c) => (
                <tr key={c.id}>
                  <td data-label="Jednotka" className="mono">{c.unit}</td>
                  <td data-label="Položka">{c.label}</td>
                  <td data-label="Částka">{c.amount.toLocaleString('cs-CZ')} Kč</td>
                  <td data-label="VS" className="mono">{c.vs}</td>
                  <td data-label="Splatnost">{c.due}</td>
                  <td data-label="Stav">
                    <select className="input" style={{ padding: '4px 8px', fontSize: 12.5, width: 'auto' }} value={c.status}
                      onChange={(e) => run(async () => { await platformApi.setChargeStatus(c.id, e.target.value as any); setCharges(await platformApi.chargesOf(bid, period)) }, 'Stav platby upraven')}>
                      <option value="unpaid">Nezaplaceno</option>
                      <option value="awaiting">Čeká na potvrzení</option>
                      <option value="paid">Zaplaceno</option>
                    </select>
                  </td>
                  <td data-label="" style={{ textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm" title="Smazat chybný předpis"
                      onClick={() => window.confirm(`Smazat předpis ${c.label} pro ${c.unit} (${c.amount.toLocaleString('cs-CZ')} Kč)?`) && run(async () => { await platformApi.deleteCharge(c.id); setCharges(await platformApi.chargesOf(bid, period)) }, 'Předpis smazán')}>
                      <Icon name="x" small />
                    </button>
                  </td>
                </tr>
              ))}
              {charges.length === 0 && <tr><td colSpan={7} className="adm-mini" style={{ padding: 16 }}>Za {periodLabel(period)} nejsou žádné předpisy.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="adm-mini" style={{ padding: '10px 18px 14px' }}>Změna stavu je okamžitá a klient ji uvidí. Mazání používejte jen na chybně vystavené předpisy.</p>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><h3>Nastavení domu</h3><span className="adm-mini">účet pro QR platby</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          <input className="input" placeholder="Číslo účtu, např. 123456789/0100" value={acct} onChange={(e) => setAcct(e.target.value)} />
          <input className="input" placeholder="Příjemce, např. SVJ Vista Park" value={rcpt} onChange={(e) => setRcpt(e.target.value)} />
          <button className="btn btn-soft btn-sm" disabled={setBusy}
            onClick={async () => { setSetBusy(true); try { await api.saveBuildingSettings(bid, { account: acct.trim(), recipient: rcpt.trim() }); toast('Nastavení uloženo') } catch (e: any) { toast('Chyba: ' + (e.message || e)) } finally { setSetBusy(false) } }}>
            {setBusy ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
        <p className="adm-mini" style={{ marginTop: 8 }}>Z tohoto účtu se generují QR kódy plateb pro rezidenty. Bez vyplnění QR nefunguje.</p>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><h3>Napojení na banku</h3><span className="adm-mini">Fio · automatické párování</span></div>
        <BankCard buildingId={bid} variant="op" toast={toast} />
      </div>

      <div className="card" style={{ marginTop: 16, borderColor: '#F3C1B8' }}>
        <div className="card-h"><h3 style={{ color: '#C0392B' }}>Nebezpečná zóna</h3></div>
        <p className="adm-mini" style={{ marginBottom: 10 }}>
          Smaže celý dům a všechna jeho data (jednotky, členy, platby, oznámení, hlasování, závady…) podle
          offboarding slibu. Před smazáním si klient může stáhnout export v aplikaci (Správa domu → Nastavení).
          Soubory v úložišti (dokumenty, fotky závad) je potřeba smazat zvlášť ve Storage.
        </p>
        <button className="btn btn-ghost btn-sm" style={{ color: '#C0392B', borderColor: '#F3C1B8' }} disabled={wipeBusy}
          onClick={async () => {
            const typed = window.prompt(`Trvale smazat „${org.name}" a všechna data? Napište přesný název domu pro potvrzení:`)
            if (typed !== org.name) { if (typed !== null) toast('Název nesouhlasí, nic se nesmazalo'); return }
            if (!window.confirm('Opravdu? Tohle nejde vrátit.')) return
            setWipeBusy(true)
            try {
              const counts = await platformApi.wipeBuilding(bid)
              const total = Object.values(counts).reduce((a, b) => a + (b || 0), 0)
              toast(`Dům smazán, odstraněno ${total} záznamů`)
              nav('/operator/organizace')
            } catch (e: any) { toast('Chyba: ' + (e.message || e)) } finally { setWipeBusy(false) }
          }}>
          {wipeBusy ? 'Mažu…' : 'Smazat dům a všechna data'}
        </button>
      </div>

      {editU && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditU(null) }}>
          <div className="modal">
            <div className="modal-h"><h3>Jednotka {editU.label}</h3><button className="btn btn-ghost btn-sm" onClick={() => setEditU(null)}>Zrušit</button></div>
            <div className="modal-b">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label className="adm-mini">Označení</label><input className="input mono" value={editU.label} onChange={(e) => setEditU({ ...editU, label: e.target.value })} /></div>
                <div><label className="adm-mini">Patro</label><input className="input" value={editU.floor} onChange={(e) => setEditU({ ...editU, floor: e.target.value })} /></div>
              </div>
              <div style={{ marginTop: 10 }}><label className="adm-mini">Nájemník / vlastník</label><input className="input" placeholder="Prázdné = volné" value={editU.tenant} onChange={(e) => setEditU({ ...editU, tenant: e.target.value })} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <div><label className="adm-mini">Nájem (Kč / měsíc)</label><input className="input mono" type="number" value={editU.rent || ''} onChange={(e) => setEditU({ ...editU, rent: Number(e.target.value) || 0 })} /></div>
                <div><label className="adm-mini">Variabilní symbol</label><input className="input mono" value={editU.vs} onChange={(e) => setEditU({ ...editU, vs: e.target.value })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <div><label className="adm-mini">Vlastnický podíl (%)</label><input className="input mono" type="number" step="0.1" value={editU.share || ''} onChange={(e) => setEditU({ ...editU, share: Number(e.target.value) || 0 })} /></div>
                <div><label className="adm-mini">Konec smlouvy</label><input className="input" type="date" value={czToIso(editU.leaseEnd)} onChange={(e) => setEditU({ ...editU, leaseEnd: e.target.value })} /></div>
              </div>
            </div>
            <div className="modal-f">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditU(null)}>Zrušit</button>
              <button className="btn btn-primary btn-sm" onClick={() => { const eu = editU; run(async () => { await api.saveUnit(eu.id, { label: eu.label.trim(), floor: eu.floor.trim(), tenant: eu.tenant.trim(), rent: eu.rent, vs: eu.vs.trim(), share: eu.share, leaseEnd: czToIso(eu.leaseEnd) }); setEditU(null) }, 'Jednotka uložena') }}>Uložit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
