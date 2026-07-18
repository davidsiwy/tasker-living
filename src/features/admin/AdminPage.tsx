import { useEffect, useState } from 'react'
import { feed, api, currentPeriod, periodLabel } from '../../lib/api'
import { can, roleNames } from '../../lib/types'
import type { Role, DocItem, Fault, FaultStatus, UnitFull, Charge, VoteData, FeedPost } from '../../lib/types'
import { adminApi } from '../../lib/adminApi'
import type { LiveMember, LiveCode, LiveUnit } from '../../lib/adminApi'
import * as A from '../../lib/adminData'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'
import { SIcon } from '../../components/AppShell'

const money = (n: number) => n.toLocaleString('cs-CZ') + ' Kč'
type Toast = (m: string) => void

const TABS = [
  { id: 'prehled', label: 'Přehled' }, { id: 'jednotky', label: 'Jednotky' }, { id: 'lide', label: 'Lidé' },
  { id: 'finance', label: 'Finance' }, { id: 'udrzba', label: 'Údržba' }, { id: 'schuze', label: 'Schůze' },
  { id: 'nastenka', label: 'Nástěnka' }, { id: 'dokumenty', label: 'Dokumenty' }, { id: 'nastaveni', label: 'Nastavení' },
]

export default function AdminPage() {
  const { user, isDemo } = useSession()
  const toast = useToast()
  const [tab, setTab] = useState('prehled')

  if (!user || !can(user.role as Role, 'admin')) {
    return (
      <div className="d-mini an" style={{ maxWidth: 520 }}>
        <div className="h"><b>Správa domu</b></div>
        <p style={{ fontSize: 12.5, color: 'var(--s-ink-2)', marginTop: 8, lineHeight: 1.55 }}>
          Správa je dostupná jen výboru SVJ a developerovi.
        </p>
      </div>
    )
  }
  const bid = user.buildingId

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>Správa domu</h2>
          <p>Nastavení, které jinde nenajdete: jednotky, přístupy členů a účet domu.</p>
        </div>
        <span className="s-badge neutral">{user.buildingName}</span>
      </div>

      <div className="ad-tabs">
        {TABS.map((t) => <button key={t.id} className={'ad-tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      <div className="ad-wrap">
        {tab === 'prehled' && <Overview toast={toast} bid={bid} />}
        {tab === 'jednotky' && <Units toast={toast} bid={bid} />}
        {tab === 'lide' && <People toast={toast} />}
        {tab === 'finance' && <Finance toast={toast} bid={bid} />}
        {tab === 'udrzba' && <Maintenance toast={toast} bid={bid} isDemo={isDemo} />}
        {tab === 'schuze' && <MeetingsAdmin toast={toast} bid={bid} />}
        {tab === 'nastenka' && <Board toast={toast} user={{ role: user.role, buildingId: bid, name: user.name, handle: user.handle }} />}
        {tab === 'dokumenty' && <Documents toast={toast} bid={bid} role={user.role} />}
        {tab === 'nastaveni' && <BuildingSettingsTab toast={toast} bid={bid} isDemo={isDemo} buildingName={user.buildingName} />}
      </div>
    </>
  )
}

/* ---------------- Přehled ---------------- */
function Overview({ toast, bid }: { toast: Toast; bid: string }) {
  const [units, setUnits] = useState<UnitFull[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [faults, setFaults] = useState<Fault[]>([])
  const [complaints, setComplaints] = useState(0)
  const [codes, setCodes] = useState<LiveCode[]>([])
  const period = currentPeriod()

  useEffect(() => {
    Promise.all([
      api.getUnitsFull(bid), api.getCharges(bid, period), api.getFaults(bid),
      api.getComplaintsCount(bid), adminApi.listCodes(bid),
    ]).then(([u, c, f, cc, cd]) => { setUnits(u); setCharges(c); setFaults(f); setComplaints(cc); setCodes(cd) })
      .catch((e: any) => toast('Načtení přehledu selhalo: ' + (e.message || e)))
  }, [bid])

  const occupied = units.filter((u) => u.tenant)
  const rentRoll = charges.reduce((s, c) => s + c.amount, 0)
  const collected = charges.filter((c) => c.status === 'paid').reduce((s, c) => s + c.amount, 0)
  const unpaid = charges.filter((c) => c.status !== 'paid')
  const faultsOpen = faults.filter((f) => f.status !== 'Vyřešeno')
  const noVendor = faultsOpen.filter((f) => !f.vendor)
  const codesFree = codes.filter((c) => !c.used).length
  const soon = (d: string) => { if (!d) return false; const p = d.split('. '); if (p.length < 3) return false; const dt = new Date(+p[2], +p[1] - 1, +p[0]); const diff = dt.getTime() - Date.now(); return diff > 0 && diff < 60 * 86400000 }
  const ending = units.filter((u) => soon(u.leaseEnd))

  const kpis = [
    { l: 'Obsazenost', v: `${occupied.length}/${units.length}`, i: 'nastenka' },
    { l: 'Výběr ' + periodLabel(period), v: rentRoll ? `${Math.round((collected / rentRoll) * 100)} %` : 'bez předpisů', i: 'bank' },
    { l: 'Měsíční předpis', v: money(rentRoll), i: 'najmy' },
    { l: 'Otevřené závady', v: String(faultsOpen.length), i: 'zavady' },
    { l: 'Stížnosti celkem', v: String(complaints), i: 'stiznosti' },
    { l: 'Volné kódy', v: String(codesFree), i: 'kontakty' },
  ]
  const alerts: { c: string; t: string; s: string }[] = []
  if (unpaid.length) alerts.push({ c: 'var(--bad)', t: `${unpaid.length} předpisů nezaplaceno`, s: unpaid.map((c) => c.unitLabel).join(', ') })
  if (noVendor.length) alerts.push({ c: 'var(--warn)', t: `${noVendor.length} závad bez dodavatele`, s: noVendor.map((f) => f.cat).join(', ') })
  if (ending.length) alerts.push({ c: 'var(--warn)', t: `Končící smlouvy do 60 dní`, s: ending.map((u) => `${u.label} (${u.leaseEnd})`).join(', ') })
  if (!charges.length && occupied.some((u) => u.rent > 0)) alerts.push({ c: 'var(--warn)', t: 'Předpisy za tento měsíc nejsou vystavené', s: 'Vygenerujte je v záložce Finance' })
  if (codesFree) alerts.push({ c: 'var(--ok)', t: `${codesFree} přístupových kódů čeká na použití`, s: 'Rozešlete je rezidentům, záložka Lidé' })

  return (
    <div>
      <div className="adm-kpis">
        {kpis.map((k) => (
          <div className="stat" key={k.l}><div className="l"><Icon name={k.i} small /> {k.l}</div><div className="v">{k.v}</div></div>
        ))}
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-h"><h3>Vyžaduje pozornost</h3><span className={'pill ' + (alerts.length ? 'pill-warn' : 'pill-ok')}>{alerts.length || 'vše v pořádku'}</span></div>
          {alerts.length === 0 && <p className="adm-mini">Nic nehoří. Dům běží.</p>}
          {alerts.map((al, i) => (
            <div className="adm-alert" key={i}>
              <span className="adm-dot" style={{ background: al.c }} />
              <div className="a-main"><b>{al.t}</b><span>{al.s}</span></div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-h"><h3>Poslední závady</h3><span className="adm-mini">{faults.length} celkem</span></div>
          {faults.slice(0, 6).map((f) => (
            <div className="doc-row" key={f.id}>
              <span className="cf-ic"><Icon name="zavady" small /></span>
              <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontWeight: 600 }}>{f.cat}</b><span>{f.loc} · {f.by} · {f.date}</span></div>
              <span className={'pill ' + (f.status === 'Vyřešeno' ? 'pill-ok' : f.status === 'V řešení' ? 'pill-warn' : 'pill-neutral')}>{f.status}</span>
            </div>
          ))}
          {faults.length === 0 && <p className="adm-mini">Žádné závady zatím nikdo nenahlásil.</p>}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Jednotky ---------------- */
function Units({ toast, bid }: { toast: Toast; bid: string }) {
  const [units, setUnits] = useState<UnitFull[]>([])
  const [edit, setEdit] = useState<UnitFull | null>(null)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = () => api.getUnitsFull(bid).then(setUnits).catch((e: any) => toast('Načtení selhalo: ' + (e.message || e)))
  useEffect(() => { reload() }, [bid])

  async function add() {
    if (!newLabel.trim() || busy) return
    setBusy(true)
    try { await api.addUnit(bid, newLabel.trim().toUpperCase()); setNewLabel(''); setAdding(false); await reload(); toast('Jednotka přidána') }
    catch (e: any) { toast(e.message || 'Přidání selhalo') } finally { setBusy(false) }
  }
  async function save() {
    if (!edit || busy) return
    setBusy(true)
    try {
      await api.saveUnit(edit.id, {
        label: edit.label, floor: edit.floor, tenant: edit.tenant, rent: edit.rent, vs: edit.vs, share: edit.share,
        leaseEnd: edit.leaseEnd ? toIso(edit.leaseEnd) : '',
      })
      setEdit(null); await reload(); toast('Jednotka uložena')
    } catch (e: any) { toast(e.message || 'Uložení selhalo') } finally { setBusy(false) }
  }
  async function del(u: UnitFull) {
    if (!window.confirm(`Smazat jednotku ${u.label}? Smaže se i historie plateb a hlasování.`)) return
    try { await api.deleteUnit(u.id); await reload(); toast('Jednotka smazána') }
    catch (e: any) { toast(e.message || 'Smazání selhalo') }
  }
  const toIso = (cz: string) => {
    const m = cz.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return cz
    const p = cz.split('.').map((x) => x.trim()).filter(Boolean)
    if (p.length === 3) return `${p[2]}-${String(+p[1]).padStart(2, '0')}-${String(+p[0]).padStart(2, '0')}`
    return ''
  }
  const totalShare = units.reduce((s, u) => s + u.share, 0)

  return (
    <>
      <div className="s-card" style={{ overflow: 'hidden' }}>
        <div className="ad-hd">
          <b>Jednotky domu</b>
          <button className="s-btn s-primary sm" onClick={() => setAdding(true)}>Přidat jednotku</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ad-tbl">
            <thead><tr><th>Jednotka</th><th>Patro</th><th>Nájemník / vlastník</th><th>Nájem</th><th>VS</th><th>Podíl %</th><th>Konec smlouvy</th><th></th></tr></thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td className="mono" style={{ fontWeight: 700 }}>{u.label}</td>
                  <td>{u.floor}</td>
                  <td>{u.tenant || <span className="sub">volné</span>}</td>
                  <td className="mono">{u.rent ? money(u.rent) : ''}</td>
                  <td className="mono">{u.vs}</td>
                  <td className="mono">{u.share || ''}</td>
                  <td>{u.leaseEnd}</td>
                  <td className="rt">
                    <button className="s-btn s-ghost sm" onClick={() => setEdit({ ...u })}>Upravit</button>{' '}
                    <button className="s-btn s-ghost sm" onClick={() => del(u)}>Smazat</button>
                  </td>
                </tr>
              ))}
              {units.length === 0 && <tr><td colSpan={8} className="ad-empty">Zatím žádné jednotky. Přidejte první — od nich se odvíjí platby i hlasování.</td></tr>}
            </tbody>
          </table>
        </div>
        {units.length > 0 && <div className="ad-tot">Součet podílů: {totalShare.toFixed(1)} %. Podíly určují váhu hlasů vlastníků.</div>}
      </div>

      {adding && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setAdding(false) }}>
          <div className="modal">
            <div className="modal-h"><h3>Nová jednotka</h3><button className="s-btn s-ghost sm" onClick={() => setAdding(false)}>Zrušit</button></div>
            <div className="modal-b">
              <div className="a-f"><label>Označení</label><input className="s-mono" placeholder="Např. A-103" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} autoFocus /></div>
            </div>
            <div className="modal-f"><button className="s-btn s-ghost" onClick={() => setAdding(false)}>Zrušit</button><button className="s-btn s-primary" onClick={add} disabled={busy}>Přidat</button></div>
          </div>
        </div>
      )}

      {edit && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setEdit(null) }}>
          <div className="modal">
            <div className="modal-h"><h3>Jednotka {edit.label}</h3><button className="s-btn s-ghost sm" onClick={() => setEdit(null)}>Zrušit</button></div>
            <div className="modal-b">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="a-f"><label>Označení</label><input className="s-mono" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></div>
                <div className="a-f"><label>Patro</label><input value={edit.floor} onChange={(e) => setEdit({ ...edit, floor: e.target.value })} /></div>
              </div>
              <div className="a-f"><label>Nájemník / vlastník</label><input placeholder="Prázdné = volné" value={edit.tenant} onChange={(e) => setEdit({ ...edit, tenant: e.target.value })} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="a-f"><label>Nájem (Kč / měsíc)</label><input type="number" value={edit.rent || ''} onChange={(e) => setEdit({ ...edit, rent: Number(e.target.value) || 0 })} /></div>
                <div className="a-f"><label>Variabilní symbol</label><input className="s-mono" value={edit.vs} onChange={(e) => setEdit({ ...edit, vs: e.target.value })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="a-f"><label>Vlastnický podíl (%)</label><input type="number" step="0.1" value={edit.share || ''} onChange={(e) => setEdit({ ...edit, share: Number(e.target.value) || 0 })} /></div>
                <div className="a-f"><label>Konec smlouvy</label><input placeholder="DD. MM. RRRR" value={edit.leaseEnd} onChange={(e) => setEdit({ ...edit, leaseEnd: e.target.value })} /></div>
              </div>
            </div>
            <div className="modal-f"><button className="s-btn s-ghost" onClick={() => setEdit(null)}>Zrušit</button><button className="s-btn s-primary" onClick={save} disabled={busy}>Uložit</button></div>
          </div>
        </div>
      )}
    </>
  )
}

/* ---------------- Lidé (live) ---------------- */
function People({ toast }: { toast: Toast }) {
  const { user } = useSession()
  const bid = user?.buildingId || 'demo'
  const [members, setMembers] = useState<LiveMember[]>([])
  const [codes, setCodes] = useState<LiveCode[]>([])
  const [units, setUnits] = useState<LiveUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [newRole, setNewRole] = useState<Role>('rezident')
  const [newUnit, setNewUnit] = useState('')
  const [busy, setBusy] = useState(false)

  async function reload() {
    const [m, c, u] = await Promise.all([adminApi.listMembers(bid), adminApi.listCodes(bid), adminApi.listUnits(bid)])
    setMembers(m); setCodes(c); setUnits(u); setLoading(false)
  }
  useEffect(() => { reload().catch((e: any) => { setLoading(false); toast('Nepodařilo se načíst data: ' + (e.message || e)) }) }, [bid])

  async function gen() {
    setBusy(true)
    try {
      const code = await adminApi.createCode(bid, newRole, newRole === 'rezident' && newUnit ? newUnit : null, 'TLV')
      toast(`Kód vytvořen: ${code}`); await reload()
    } catch (e: any) { toast('Chyba: ' + (e.message || e)) } finally { setBusy(false) }
  }
  async function del(code: string) {
    try { await adminApi.deleteCode(code); toast('Kód smazán'); await reload() }
    catch (e: any) { toast('Chyba: ' + (e.message || e)) }
  }
  async function changeRole(m: LiveMember, role: Role) {
    try { await adminApi.setRole(m.membershipId, role); toast(`${m.name} je nyní ${roleNames[role]}`); await reload() }
    catch (e: any) { toast('Chyba: ' + (e.message || e)) }
  }
  async function remove(m: LiveMember) {
    if (!window.confirm(`Odebrat ${m.name} z domu? Přijde o přístup do aplikace.`)) return
    try { await adminApi.removeMember(m.membershipId); toast('Člen odebrán'); await reload() }
    catch (e: any) { toast('Chyba: ' + (e.message || e)) }
  }

  return (
    <div className="ad-2">
      <div className="s-card" style={{ overflow: 'hidden' }}>
        <div className="ad-hd"><b>Obyvatelé a členové</b><span className="s-mono" style={{ fontSize: 11, color: 'var(--s-muted)' }}>{members.length} osob</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ad-tbl">
            <thead><tr><th>Jméno</th><th>Jednotka</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="ad-empty">Načítání…</td></tr>}
              {!loading && members.length === 0 && (
                <tr><td colSpan={4} className="ad-empty">Zatím se nikdo neregistroval. Vygenerujte kód vpravo a pošlete ho sousedům — tím dům ožije.</td></tr>
              )}
              {members.map((m) => (
                <tr key={m.membershipId}>
                  <td><b style={{ fontWeight: 700 }}>{m.name}</b><div className="sub">{m.email || 'bez e-mailu'} · od {m.since}</div></td>
                  <td className="mono">{m.unit || <span className="sub">—</span>}</td>
                  <td>
                    <select className="ad-mini-sel" value={m.role} onChange={(e) => changeRole(m, e.target.value as Role)} disabled={m.userId === user?.userId}>
                      {(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
                    </select>
                  </td>
                  <td className="rt">
                    {m.userId !== user?.userId && <button className="s-btn s-ghost sm" onClick={() => remove(m)}>Odebrat</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="s-card" style={{ overflow: 'hidden' }}>
        <div className="ad-hd"><b>Přístupové kódy</b></div>
        <div className="ad-gen">
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
            {(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
          </select>
          {newRole === 'rezident' && (
            <select value={newUnit} onChange={(e) => setNewUnit(e.target.value)}>
              <option value="">bez jednotky</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          )}
          <button className="s-btn s-primary sm" onClick={gen} disabled={busy}>Vygenerovat</button>
        </div>
        {!loading && codes.length === 0 && <div className="ad-empty">Žádné kódy. Vygenerujte první nahoře.</div>}
        {codes.map((c) => (
          <div className="ad-code" key={c.code}>
            <span className={'ic ' + (c.used ? 'used' : 'open')}><SIcon n={c.used ? 'vote' : 'people'} s={15} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{c.code}</b>
              <span>{roleNames[c.role]}{c.unit ? ' · ' + c.unit : ''} · {c.created}</span>
            </div>
            {c.used ? <span className="s-badge ok">Použit</span> : <button className="s-btn s-ghost sm" onClick={() => del(c.code)}>Smazat</button>}
          </div>
        ))}
        <div className="ad-hint">
          <SIcon n="shield" s={15} />
          <span>Kód pošlete sousedovi, při registraci ho připojí ke svému bytu se správnou rolí. Nepoužité smažete, použité zůstávají v historii.</span>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Finance ---------------- */
function Finance({ toast, bid }: { toast: Toast; bid: string }) {
  const [period, setPeriod] = useState(currentPeriod())
  const [charges, setCharges] = useState<Charge[]>([])
  const [busy, setBusy] = useState(false)

  const reload = (p = period) => api.getCharges(bid, p).then(setCharges).catch((e: any) => toast('Načtení selhalo: ' + (e.message || e)))
  useEffect(() => { reload(period) }, [bid, period])

  const periods = (() => {
    const out: string[] = []
    const d = new Date()
    for (let i = -1; i < 6; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')) }
    return out
  })()

  async function generate() {
    if (busy) return
    setBusy(true)
    try {
      const n = await api.generateCharges(bid, period)
      await reload()
      toast(n ? `Vystaveno ${n} předpisů za ${periodLabel(period)}` : 'Žádné jednotky s nastaveným nájmem. Doplňte je v záložce Jednotky.')
    } catch (e: any) { toast(e.message || 'Generování selhalo') } finally { setBusy(false) }
  }
  async function setStatus(c: Charge, status: 'paid' | 'unpaid') {
    try { await api.setChargeStatus(c.id, status); await reload(); toast(status === 'paid' ? `${c.unitLabel} označeno jako zaplaceno` : 'Vráceno na nezaplaceno') }
    catch (e: any) { toast(e.message || 'Uložení selhalo') }
  }
  async function remind(c: Charge) {
    try { const n = await api.remindCharge(c.id); toast(n > 0 ? `Upomínka odeslána (${c.unitLabel})` : `Jednotka ${c.unitLabel} nemá v aplikaci žádného člena`) }
    catch (e: any) { toast(e.message || 'Upomínka selhala') }
  }

  const total = charges.reduce((s, c) => s + c.amount, 0)
  const paid = charges.filter((c) => c.status === 'paid').reduce((s, c) => s + c.amount, 0)
  const awaiting = charges.filter((c) => c.status === 'awaiting')
  const unpaid = charges.filter((c) => c.status === 'unpaid')

  return (
    <div>
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="stat"><div className="l"><Icon name="najmy" small /> Předpis {periodLabel(period)}</div><div className="v">{money(total)}</div></div>
        <div className="stat"><div className="l"><Icon name="check" small /> Uhrazeno</div><div className="v">{money(paid)}</div></div>
        <div className="stat"><div className="l"><Icon name="zavady" small /> Dluží</div><div className="v">{unpaid.length + awaiting.length}</div></div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-h" style={{ padding: '16px 18px 0', flexWrap: 'wrap', gap: 10 }}>
          <h3>Předpisy plateb</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} value={period} onChange={(e) => setPeriod(e.target.value)}>
              {periods.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
            </select>
            <button className="btn btn-soft btn-sm" onClick={generate} disabled={busy}><Icon name="plus" small /> Vygenerovat předpisy</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Jednotka</th><th>Předpis</th><th>Částka</th><th>VS</th><th>Splatnost</th><th>Stav</th><th></th></tr></thead>
            <tbody>
              {charges.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.unitLabel}</td>
                  <td>{c.label}</td>
                  <td>{money(c.amount)}</td>
                  <td className="mono">{c.vs}</td>
                  <td>{c.due}</td>
                  <td>{c.status === 'paid' ? <span className="pill pill-ok">Zaplaceno</span> : c.status === 'awaiting' ? <span className="pill pill-warn">Čeká na potvrzení</span> : <span className="pill pill-bad">Nezaplaceno</span>}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {c.status !== 'paid' && <button className="btn btn-soft btn-sm" onClick={() => setStatus(c, 'paid')}>Potvrdit platbu</button>}
                    {c.status === 'unpaid' && <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={() => remind(c)}>Upomenout</button>}
                    {c.status === 'paid' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(c, 'unpaid')}>Vrátit</button>}
                  </td>
                </tr>
              ))}
              {charges.length === 0 && <tr><td colSpan={7} className="adm-mini" style={{ padding: 18 }}>Za {periodLabel(period)} nejsou vystavené předpisy. Vygenerujte je tlačítkem nahoře, vychází z nájmů u jednotek.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="adm-mini" style={{ padding: '0 18px 14px' }}>Upomínka pošle notifikaci členům jednotky v aplikaci. Automatické párování z banky připravujeme.</p>
      </div>
    </div>
  )
}

/* ---------------- Údržba ---------------- */
function Maintenance({ toast, bid, isDemo }: { toast: Toast; bid: string; isDemo: boolean }) {
  const [faults, setFaults] = useState<Fault[]>([])
  const [note, setNote] = useState<Record<string, string>>({})
  const [vendor, setVendor] = useState<Record<string, string>>({})
  const STEPS: FaultStatus[] = ['Nahlášeno', 'V řešení', 'Vyřešeno']

  const reload = () => api.getFaults(bid).then(setFaults).catch((e: any) => toast('Načtení selhalo: ' + (e.message || e)))
  useEffect(() => { reload() }, [bid])

  async function assign(f: Fault) {
    const v = (vendor[f.id] || '').trim(); if (!v) return
    try { await api.assignVendor(f.id, v); setVendor((s) => ({ ...s, [f.id]: '' })); await reload(); toast('Dodavatel přiřazen') }
    catch (e: any) { toast(e.message || 'Přiřazení selhalo') }
  }
  async function advance(f: Fault, status: FaultStatus) {
    try { await api.advanceFault(f.id, status, (note[f.id] || '').trim() || undefined); setNote((s) => ({ ...s, [f.id]: '' })); await reload(); toast('Stav aktualizován, ohlašovatel dostal notifikaci') }
    catch (e: any) { toast(e.message || 'Aktualizace selhala') }
  }

  return (
    <div>
      <div className="card">
        <div className="card-h"><h3>Závady k řešení</h3><span className="adm-mini">{faults.filter((f) => f.status !== 'Vyřešeno').length} otevřených</span></div>
        {faults.map((f) => (
          <div className="row-card" key={f.id} style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <div className="lead-col"><b>{f.cat}</b><span>{f.loc} · {f.by} · {f.date}</span></div>
            <div style={{ flex: 1, minWidth: 220, fontSize: 13.5, color: 'var(--ink-2)' }}>{f.desc}
              {f.vendor && <div className="adm-mini" style={{ marginTop: 4 }}>Dodavatel: {f.vendor}</div>}
            </div>
            <div style={{ display: 'grid', gap: 6, minWidth: 240 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="input" style={{ fontSize: 12.5, padding: '6px 8px' }} list="adm-vendors" placeholder="Dodavatel" value={vendor[f.id] || ''} onChange={(e) => setVendor((s) => ({ ...s, [f.id]: e.target.value }))} />
                <button className="btn btn-ghost btn-sm" onClick={() => assign(f)}>Přiřadit</button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="input" style={{ fontSize: 12.5, padding: '6px 8px' }} placeholder="Poznámka" value={note[f.id] || ''} onChange={(e) => setNote((s) => ({ ...s, [f.id]: e.target.value }))} />
                {STEPS.filter((s) => s !== f.status).map((s) => <button key={s} className="btn btn-soft btn-sm" onClick={() => advance(f, s)}>{s}</button>)}
              </div>
            </div>
          </div>
        ))}
        {faults.length === 0 && <p className="adm-mini">Žádné závady. Až rezidenti něco nahlásí, objeví se tady.</p>}
        <datalist id="adm-vendors">{A.vendors.map((v) => <option key={v.name} value={v.name}>{v.field}</option>)}</datalist>
      </div>

      {isDemo && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h"><h3>Revize a kontroly</h3><span className="pill pill-neutral">Ukázka, připravujeme</span></div>
          {A.revize.map((r) => (
            <div className="doc-row" key={r.type}><span className="cf-ic"><Icon name="sprava" small /></span><div style={{ flex: 1 }}><b>{r.type}</b><span>{r.provider} · další {r.next}</span></div><span className={'pill ' + (r.status === 'Platná' ? 'pill-ok' : r.status === 'Blíží se' ? 'pill-warn' : 'pill-bad')}>{r.status}</span></div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- Schůze a hlasování ---------------- */
function MeetingsAdmin({ toast, bid }: { toast: Toast; bid: string }) {
  const [meetings, setMeetings] = useState<{ id: string; date: string; place: string; agenda: string[]; going?: number; rsvp: boolean }[]>([])
  const [vote, setVote] = useState<VoteData | null>(null)
  const [mDate, setMDate] = useState(''); const [mPlace, setMPlace] = useState(''); const [mAgenda, setMAgenda] = useState('')
  const [q, setQ] = useState(''); const [quorum, setQuorum] = useState(50)
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    const [ms, v] = await Promise.all([api.getMeetings(bid), api.getVote(bid)])
    setMeetings(ms); setVote(v)
  }
  useEffect(() => { reload().catch((e: any) => toast('Načtení selhalo: ' + (e.message || e))) }, [bid])

  async function createMeeting() {
    if (!mDate || !mPlace.trim() || busy) { if (!mDate || !mPlace.trim()) toast('Vyplňte termín a místo'); return }
    setBusy(true)
    try {
      await api.createMeeting(bid, new Date(mDate).toISOString(), mPlace.trim(), mAgenda.split('\n').map((a) => a.trim()).filter(Boolean))
      setMDate(''); setMPlace(''); setMAgenda(''); await reload(); toast('Schůze vytvořena, členové dostali notifikaci')
    } catch (e: any) { toast(e.message || 'Vytvoření selhalo') } finally { setBusy(false) }
  }
  async function createPoll() {
    if (!q.trim() || busy) { if (!q.trim()) toast('Zadejte otázku'); return }
    setBusy(true)
    try { await api.createPoll(bid, q.trim(), quorum); setQ(''); await reload(); toast('Hlasování vypsáno, členové dostali notifikaci') }
    catch (e: any) { toast(e.message || 'Vypsání selhalo') } finally { setBusy(false) }
  }
  async function close() {
    if (!vote?.pollId) return
    try { await api.closePoll(vote.pollId); await reload(); toast('Hlasování uzavřeno') }
    catch (e: any) { toast(e.message || 'Uzavření selhalo') }
  }

  const voted = vote ? Object.keys(vote.ballots).length + Object.keys(vote.proxies).length : 0

  return (
    <div className="grid-2">
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="card">
          <div className="card-h"><h3>Nová schůze</h3></div>
          <div className="field"><label>Termín</label><input className="input" type="datetime-local" value={mDate} onChange={(e) => setMDate(e.target.value)} /></div>
          <div className="field"><label>Místo</label><input className="input" placeholder="Např. Společenská místnost" value={mPlace} onChange={(e) => setMPlace(e.target.value)} /></div>
          <div className="field"><label>Program (bod na řádek)</label><textarea className="input" rows={3} value={mAgenda} onChange={(e) => setMAgenda(e.target.value)} /></div>
          <button className="btn btn-primary btn-sm" onClick={createMeeting} disabled={busy}><Icon name="plus" small /> Vytvořit a oznámit</button>
        </div>
        <div className="card">
          <div className="card-h"><h3>Naplánované schůze</h3></div>
          {meetings.map((m) => (
            <div className="doc-row" key={m.id}><span className="cf-ic"><Icon name="schuze" small /></span><div style={{ flex: 1 }}><b>{m.date}</b><span>{m.place}{typeof m.going === 'number' ? ` · ${m.going} přijde` : ''}</span></div></div>
          ))}
          {meetings.length === 0 && <p className="adm-mini">Žádná schůze v plánu.</p>}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, alignSelf: 'start' }}>
        <div className="card">
          <div className="card-h"><h3>Hlasování per rollam</h3>{vote?.pollId && (vote.open ? <span className="pill pill-ok">Běží</span> : <span className="pill pill-neutral">Uzavřeno</span>)}</div>
          {vote?.pollId ? (
            <>
              <p style={{ fontSize: 14, marginBottom: 8 }}>{vote.q}</p>
              <p className="adm-mini">Kvórum {vote.quorum} % · hlasovalo nebo zmocnilo {voted} z {vote.roster.length} jednotek</p>
              {vote.open && <button className="btn btn-soft btn-sm" style={{ marginTop: 10 }} onClick={close}>Uzavřít hlasování</button>}
            </>
          ) : <p className="adm-mini">Žádné hlasování neběží.</p>}
        </div>
        <div className="card">
          <div className="card-h"><h3>Vypsat nové hlasování</h3></div>
          <div className="field"><label>Otázka</label><textarea className="input" rows={2} placeholder="Souhlasíte s ...?" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="field"><label>Kvórum (% podílů)</label><input className="input" type="number" min={1} max={100} value={quorum} onChange={(e) => setQuorum(Number(e.target.value) || 50)} /></div>
          <button className="btn btn-primary btn-sm" onClick={createPoll} disabled={busy}><Icon name="send" small /> Vypsat a oznámit</button>
          <p className="adm-mini" style={{ marginTop: 10 }}>Nové hlasování nahradí předchozí jako aktivní. Hlasuje se podíly jednotek, spravujete je v záložce Jednotky.</p>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Nástěnka ---------------- */
function Board({ toast, user }: { toast: Toast; user: { role: Role; buildingId: string; name: string; handle: string } }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [busy, setBusy] = useState(false)

  const reload = () => feed.list(user.buildingId).then(setPosts).catch(() => {})
  useEffect(() => { reload() }, [user.buildingId])

  async function publish() {
    if (!title.trim() || busy) { if (!title.trim()) toast('Zadejte nadpis'); return }
    setBusy(true)
    try {
      const text = body.trim() ? `${title.trim()}\n\n${body.trim()}` : title.trim()
      await feed.createPost({ buildingId: user.buildingId, author: { name: user.name, handle: user.handle, role: user.role }, kind: 'ozn', body: text })
      setTitle(''); setBody(''); await reload(); toast('Oznámení publikováno, členové dostali notifikaci')
    } catch (e: any) { toast(e.message || 'Publikování selhalo') } finally { setBusy(false) }
  }
  async function remove(p: FeedPost) {
    if (!window.confirm('Smazat tento příspěvek z nástěnky?')) return
    try { await feed.deletePost(p.id); await reload(); toast('Příspěvek smazán') }
    catch (e: any) { toast(e.message || 'Smazání selhalo') }
  }

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-h"><h3>Nové oznámení</h3></div>
        <div className="field"><label>Nadpis</label><input className="input" placeholder="Např. Odstávka výtahu" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label>Text</label><textarea className="input" placeholder="Detaily oznámení..." value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <button className="btn btn-primary btn-sm" onClick={publish} disabled={busy}><Icon name="send" small /> Publikovat na nástěnku</button>
        <p className="adm-mini" style={{ marginTop: 10 }}>Oznámení se objeví na nástěnce a všem členům přijde notifikace.</p>
      </div>
      <div className="card">
        <div className="card-h"><h3>Moderace příspěvků</h3><span className="adm-mini">poslední</span></div>
        {posts.slice(0, 8).map((p) => (
          <div className="doc-row" key={p.id}>
            <span className="cf-ic"><Icon name={p.kind === 'ozn' ? 'nastenka' : 'msg'} small /></span>
            <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontWeight: 600, fontSize: 13.5 }}>{p.authorName}</b><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{p.body}</span></div>
            <button className="btn btn-ghost btn-sm" onClick={() => remove(p)}>Smazat</button>
          </div>
        ))}
        {posts.length === 0 && <p className="adm-mini">Na nástěnce zatím nic není.</p>}
      </div>
    </div>
  )
}

/* ---------------- Dokumenty ---------------- */
const DOC_ROLES: { k: Role; l: string }[] = [{ k: 'rezident', l: 'Rezidenti' }, { k: 'vybor', l: 'Výbor' }, { k: 'developer', l: 'Developer' }, { k: 'investor', l: 'Investor' }]

function Documents({ toast, bid, role }: { toast: Toast; bid: string; role: Role }) {
  const [docs, setDocs] = useState<DocItem[]>([])
  const [busy, setBusy] = useState(false)
  const [cat, setCat] = useState('Ostatní')
  const [vis, setVis] = useState<Role[]>(['rezident', 'vybor', 'developer', 'investor'])

  const reload = () => api.getDocuments(bid, role).then(setDocs).catch((e: any) => toast('Načtení selhalo: ' + (e.message || e)))
  useEffect(() => { reload() }, [bid])

  async function upload(files: FileList | null) {
    if (!files || !files.length || busy) return
    setBusy(true)
    try { await api.uploadDocument(bid, files[0], { cat, vis }); await reload(); toast('Dokument nahrán') }
    catch (e: any) { toast(e.message || 'Nahrání selhalo') } finally { setBusy(false) }
  }
  async function toggleVis(d: DocItem, r: Role) {
    const cur = d.vis || []
    const next = cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]
    if (!next.includes('vybor')) next.push('vybor')
    try { await api.setDocVisibility(d.id!, next); await reload() }
    catch (e: any) { toast(e.message || 'Uložení selhalo') }
  }
  async function del(d: DocItem) {
    if (!window.confirm(`Smazat dokument ${d.name}?`)) return
    try { await api.deleteDocument(d); await reload(); toast('Dokument smazán') }
    catch (e: any) { toast(e.message || 'Smazání selhalo') }
  }
  async function open(d: DocItem) {
    try { const url = await api.openDocument(d); if (url) window.open(url, '_blank'); else toast('Dokument je ukázkový') }
    catch (e: any) { toast(e.message || 'Otevření selhalo') }
  }

  return (
    <div className="card">
      <div className="card-h" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h3>Dokumenty domu</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} value={cat} onChange={(e) => setCat(e.target.value)}>
            {['Stanovy a právní', 'Zápisy', 'Vyúčtování', 'Revize', 'Smlouvy', 'Schůze', 'Ostatní'].map((c) => <option key={c}>{c}</option>)}
          </select>
          <label className="btn btn-soft btn-sm" style={{ cursor: 'pointer' }}>
            {busy ? <span className="spin" style={{ width: 16, height: 16, margin: 0 }} /> : <><Icon name="plus" small /> Nahrát</>}
            <input className="file-in" type="file" onChange={(e) => upload(e.target.files)} />
          </label>
        </div>
      </div>
      <p className="adm-mini" style={{ marginBottom: 10 }}>Dokumenty se ukládají do zabezpečeného úložiště, otevírají se podepsaným odkazem a viditelnost řídíte po rolích.</p>
      {docs.map((d) => (
        <div className="doc-row" key={d.id || d.name} style={{ flexWrap: 'wrap' }}>
          <span className="cf-ic"><Icon name="doc" small /></span>
          <div style={{ flex: 1, minWidth: 180 }}><b>{d.name}</b><span>{d.cat ? d.cat + ' · ' : ''}{d.kind} · {d.date}</span></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DOC_ROLES.map((r) => (
              <button key={r.k} className={'pill ' + ((d.vis || []).includes(r.k) ? 'pill-ok' : 'pill-neutral')} style={{ cursor: 'pointer', border: 0 }} onClick={() => toggleVis(d, r.k)}>{r.l}</button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => open(d)}>Otevřít</button>
          <button className="btn btn-ghost btn-sm" onClick={() => del(d)}>Smazat</button>
        </div>
      ))}
      {docs.length === 0 && <p className="adm-mini">Žádné dokumenty. Nahrajte stanovy, zápisy nebo vyúčtování.</p>}
    </div>
  )
}

/* ---------------- Nastavení domu ---------------- */
function BuildingSettingsTab({ toast, bid, isDemo, buildingName }: { toast: Toast; bid: string; isDemo: boolean; buildingName: string }) {
  const [account, setAccount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.getBuildingSettings(bid).then((s) => { setAccount(s.account); setRecipient(s.recipient) }).catch(() => {})
  }, [bid])

  async function save() {
    if (busy) return
    setBusy(true)
    try { await api.saveBuildingSettings(bid, { account: account.trim(), recipient: recipient.trim() }); toast('Nastavení plateb uloženo') }
    catch (e: any) { toast(e.message || 'Uložení selhalo') } finally { setBusy(false) }
  }

  const integrations = [
    { id: 'fio', name: 'Fio banka', desc: 'Automatické párování plateb podle VS', tag: 'Připravujeme' },
    { id: 'stripe', name: 'Platby kartou', desc: 'Strhávání nájmu kartou a Apple Pay', tag: 'Připravujeme' },
    { id: 'email', name: 'E-mailové notifikace', desc: 'Upomínky a oznámení i mimo aplikaci', tag: 'Připravujeme' },
  ]

  return (
    <div className="ad-2">
      <div className="s-card" style={{ padding: '18px 20px' }}>
        <b style={{ fontSize: 14, fontWeight: 800 }}>Účet domu pro platby</b>
        <div className="a-f" style={{ marginTop: 12 }}>
          <label htmlFor="bs-a">Bankovní účet (číslo / kód banky)</label>
          <input id="bs-a" className="s-mono" placeholder="123456789/0100" value={account} onChange={(e) => setAccount(e.target.value)} />
        </div>
        <div className="a-f">
          <label htmlFor="bs-r">Název příjemce</label>
          <input id="bs-r" placeholder={buildingName} value={recipient} onChange={(e) => setRecipient(e.target.value)} />
        </div>
        <button className="s-btn s-primary sm" onClick={save} disabled={busy || isDemo}>Uložit</button>
        <p className="a-note" style={{ marginTop: 10 }}>
          Na tento účet míří QR platby rezidentů. Dokud ho nevyplníte, aplikace QR nenabízí a sousedé platí převodem s ručním potvrzením.
        </p>
      </div>
      <div className="s-card" style={{ overflow: 'hidden' }}>
        <div className="ad-hd"><b>Integrace</b><span className="s-mono" style={{ fontSize: 10, color: 'var(--s-muted)' }}>ROADMAP</span></div>
        {integrations.map((i) => (
          <div className="ad-code" key={i.id}>
            <span className="ic open"><SIcon n="card" s={15} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, letterSpacing: 0 }}>{i.name}</b>
              <span>{i.desc}</span>
            </div>
            <span className="s-badge purple">{i.tag}</span>
          </div>
        ))}
        <p className="a-note" style={{ padding: '4px 16px 14px' }}>Integrace zapneme postupně. Ozvěte se, kterou potřebujete nejdřív.</p>
      </div>
    </div>
  )
}
