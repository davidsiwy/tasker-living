import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, currentPeriod, periodLabel } from '../../lib/api'
import { can, roleNames } from '../../lib/types'
import type { Role, Fault, UnitFull, Charge } from '../../lib/types'
import { adminApi } from '../../lib/adminApi'
import type { LiveMember, LiveCode, LiveUnit } from '../../lib/adminApi'
import * as A from '../../lib/adminData'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'
import { SIcon } from '../../components/AppShell'
import { exportBuilding } from '../../lib/exportBuilding'
import { BankCard } from '../../components/BankCard'

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
        {tab === 'schuze' && <MeetingsAdmin />}
        {tab === 'nastenka' && <Board />}
        {tab === 'dokumenty' && <DocumentsAdmin />}
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
    { l: 'Obsazenost', v: `${occupied.length}/${units.length}`, i: 'people' },
    { l: 'Výběr ' + periodLabel(period), v: rentRoll ? `${Math.round((collected / rentRoll) * 100)} %` : 'bez předpisů', i: 'card', g: true },
    { l: 'Měsíční předpis', v: money(rentRoll), i: 'card' },
    { l: 'Otevřené závady', v: String(faultsOpen.length), i: 'wrench' },
    { l: 'Stížnosti celkem', v: String(complaints), i: 'shield' },
    { l: 'Volné kódy', v: String(codesFree), i: 'people' },
  ]
  const alerts: { c: string; t: string; s: string }[] = []
  if (unpaid.length) alerts.push({ c: 'warn', t: `${unpaid.length} předpisů nezaplaceno`, s: unpaid.map((c) => c.unitLabel).join(', ') })
  if (noVendor.length) alerts.push({ c: 'warn', t: `${noVendor.length} závad bez dodavatele`, s: noVendor.map((f) => f.cat).join(', ') })
  if (ending.length) alerts.push({ c: 'warn', t: `Končící smlouvy do 60 dní`, s: ending.map((u) => `${u.label} (${u.leaseEnd})`).join(', ') })
  if (!charges.length && occupied.some((u) => u.rent > 0)) alerts.push({ c: 'warn', t: 'Předpisy za tento měsíc nejsou vystavené', s: 'Vygenerujte je v záložce Finance' })
  if (codesFree) alerts.push({ c: 'ok', t: `${codesFree} přístupových kódů čeká na použití`, s: 'Rozešlete je rezidentům, záložka Lidé' })

  return (
    <>
      <div className="d-kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 0 }}>
        {kpis.map((k) => (
          <div className="d-kpi" key={k.l}>
            <div className="k">{k.l}</div>
            <b className={k.g ? 'g' : ''}>{k.v}</b>
          </div>
        ))}
      </div>
      <div className="ad-2" style={{ marginTop: 14 }}>
        <div className="s-card" style={{ overflow: 'hidden' }}>
          <div className="ad-hd"><b>Vyžaduje pozornost</b><span className={'s-badge ' + (alerts.length ? 'warn' : 'ok')}>{alerts.length || 'vše v pořádku'}</span></div>
          {alerts.length === 0 && <div className="ad-empty">Nic nehoří. Dům běží.</div>}
          {alerts.map((al, i) => (
            <div className="ad-code" key={i}>
              <span className={'ic ' + (al.c === 'ok' ? 'used' : 'open')} style={{ width: 10, height: 10, borderRadius: '50%', background: al.c === 'ok' ? 'var(--s-green)' : 'var(--s-warn)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, letterSpacing: 0 }}>{al.t}</b>
                <span>{al.s}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="s-card" style={{ overflow: 'hidden' }}>
          <div className="ad-hd"><b>Poslední závady</b><span className="s-mono" style={{ fontSize: 11, color: 'var(--s-muted)' }}>{faults.length} celkem</span></div>
          {faults.slice(0, 6).map((f) => (
            <div className="ad-code" key={f.id}>
              <span className="ic open"><SIcon n="wrench" s={15} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, letterSpacing: 0 }}>{f.cat}</b>
                <span>{f.loc} · {f.by} · {f.date}</span>
              </div>
              <span className={'s-badge ' + (f.status === 'Vyřešeno' ? 'ok' : f.status === 'V řešení' ? 'warn' : 'neutral')}>{f.status}</span>
            </div>
          ))}
          {faults.length === 0 && <div className="ad-empty">Žádné závady zatím nikdo nenahlásil.</div>}
        </div>
      </div>
    </>
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
    <>
      <div className="d-kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 0 }}>
        <div className="d-kpi"><div className="k">Předpis {periodLabel(period)}</div><b>{money(total)}</b></div>
        <div className="d-kpi"><div className="k">Uhrazeno</div><b className="g">{money(paid)}</b></div>
        <div className="d-kpi"><div className="k">Dluží</div><b style={{ color: unpaid.length + awaiting.length ? 'var(--s-warn)' : undefined }}>{unpaid.length + awaiting.length}</b></div>
      </div>

      <div className="s-card" style={{ overflow: 'hidden', marginTop: 14 }}>
        <div className="ad-hd" style={{ flexWrap: 'wrap', gap: 10 }}>
          <b>Předpisy plateb</b>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="ad-mini-sel" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {periods.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
            </select>
            <button className="s-btn s-primary sm" onClick={generate} disabled={busy}>Vygenerovat předpisy</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ad-tbl">
            <thead><tr><th>Jednotka</th><th>Předpis</th><th>Částka</th><th>VS</th><th>Splatnost</th><th>Stav</th><th></th></tr></thead>
            <tbody>
              {charges.map((c) => (
                <tr key={c.id}>
                  <td className="mono" style={{ fontWeight: 700 }}>{c.unitLabel}</td>
                  <td>{c.label}</td>
                  <td className="mono">{money(c.amount)}</td>
                  <td className="mono">{c.vs}</td>
                  <td>{c.due}</td>
                  <td>{c.status === 'paid' ? <span className="s-badge ok">Zaplaceno</span> : c.status === 'awaiting' ? <span className="s-badge warn">Čeká na potvrzení</span> : <span className="s-badge warn">Nezaplaceno</span>}</td>
                  <td className="rt">
                    {c.status !== 'paid' && <button className="s-btn s-dark sm" onClick={() => setStatus(c, 'paid')}>Potvrdit platbu</button>}
                    {c.status === 'unpaid' && <button className="s-btn s-ghost sm" style={{ marginLeft: 6 }} onClick={() => remind(c)}>Upomenout</button>}
                    {c.status === 'paid' && <button className="s-btn s-ghost sm" onClick={() => setStatus(c, 'unpaid')}>Vrátit</button>}
                  </td>
                </tr>
              ))}
              {charges.length === 0 && <tr><td colSpan={7} className="ad-empty">Za {periodLabel(period)} nejsou vystavené předpisy. Vygenerujte je tlačítkem nahoře, vychází z nájmů u jednotek.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="ad-tot">Upomínka pošle notifikaci členům jednotky v aplikaci. Fio párování zapnete v záložce Nastavení domu.</div>
      </div>
    </>
  )
}

/* ---------------- Údržba ---------------- */
function Maintenance({ toast, bid, isDemo }: { toast: Toast; bid: string; isDemo: boolean }) {
  const [faults, setFaults] = useState<Fault[]>([])
  const nav = useNavigate()
  useEffect(() => { api.getFaults(bid).then(setFaults).catch(() => setFaults([])) }, [bid])
  const open = faults.filter((f) => f.status !== 'Vyřešeno')
  const noVendor = open.filter((f) => !f.vendor)
  void toast

  return (
    <>
      <div className="d-kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 0 }}>
        <div className="d-kpi"><div className="k">Otevřené závady</div><b>{open.length}</b></div>
        <div className="d-kpi"><div className="k">Bez dodavatele</div><b style={{ color: noVendor.length ? 'var(--s-warn)' : undefined }}>{noVendor.length}</b></div>
        <div className="d-kpi"><div className="k">Vyřešeno celkem</div><b className="g">{faults.length - open.length}</b></div>
      </div>

      <div className="s-card" style={{ marginTop: 14, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="ic" style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--s-green-050)', color: 'var(--s-green-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><SIcon n="wrench" /></span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <b style={{ fontSize: 14, fontWeight: 800, display: 'block' }}>Závady mají vlastní nástěnku</b>
          <span style={{ fontSize: 12.5, color: 'var(--s-ink-2)' }}>Kanban s fotkami, přiřazením dodavatele a průběhem najdete v sekci Závady.</span>
        </div>
        <button className="s-btn s-primary sm" onClick={() => nav('/app/zavady')}>Otevřít Závady</button>
      </div>

      {isDemo && (
        <div className="s-card" style={{ overflow: 'hidden', marginTop: 14 }}>
          <div className="ad-hd"><b>Revize a kontroly</b><span className="s-badge purple">Ukázka, připravujeme</span></div>
          {A.revize.map((r) => (
            <div className="ad-code" key={r.type}>
              <span className="ic open"><SIcon n="shield" s={15} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, letterSpacing: 0 }}>{r.type}</b>
                <span>{r.provider} · další {r.next}</span>
              </div>
              <span className={'s-badge ' + (r.status === 'Platná' ? 'ok' : r.status === 'Blíží se' ? 'warn' : 'warn')}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/* ---------------- Schůze a hlasování ---------------- */
function AdminPointer({ icon, title, desc, to, label, nav }: { icon: string; title: string; desc: string; to: string; label: string; nav: (p: string) => void }) {
  return (
    <div className="s-card" style={{ padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="ic" style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--s-green-050)', color: 'var(--s-green-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><SIcon n={icon} /></span>
      <div style={{ flex: 1, minWidth: 220 }}>
        <b style={{ fontSize: 14, fontWeight: 800, display: 'block' }}>{title}</b>
        <span style={{ fontSize: 12.5, color: 'var(--s-ink-2)' }}>{desc}</span>
      </div>
      <button className="s-btn s-primary sm" onClick={() => nav(to)}>{label}</button>
    </div>
  )
}
function MeetingsAdmin() {
  const nav = useNavigate()
  return <AdminPointer nav={nav} icon="vote" title="Schůze a hlasování mají vlastní sekci" desc="Usnesení podle podílů, plné moci a zápis z výsledků najdete v sekci Schůze a hlasování." to="/app/schuze" label="Otevřít Schůze" />
}
function Board() {
  const nav = useNavigate()
  return <AdminPointer nav={nav} icon="bell" title="Oznámení mají vlastní sekci" desc="Rozeslání s cílením a čtenost po bytech najdete v sekci Oznámení." to="/app/nastenka" label="Otevřít Oznámení" />
}
function DocumentsAdmin() {
  const nav = useNavigate()
  return <AdminPointer nav={nav} icon="doc" title="Dokumenty mají vlastní sekci" desc="Kategorie, viditelnost po rolích a podepsané odkazy najdete v sekci Dokumenty." to="/app/dokumenty" label="Otevřít Dokumenty" />
}

function BuildingSettingsTab({ toast, bid, isDemo, buildingName }: { toast: Toast; bid: string; isDemo: boolean; buildingName: string }) {
  const [exp, setExp] = useState('')
  async function doExport() {
    if (exp) return
    setExp('Připravuji export…')
    try {
      const { blob, filename, note } = await exportBuilding(bid, buildingName, setExp)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      toast('Export stažen' + (note ? ' · ' + note : ''))
    } catch (e: any) { toast(e.message || 'Export selhal') } finally { setExp('') }
  }
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

      <div className="s-card" style={{ gridColumn: '1 / -1', padding: '18px 20px' }}>
        <b style={{ fontSize: 14, fontWeight: 800, display: 'block', marginBottom: 10 }}>Napojení na banku</b>
        <BankCard buildingId={bid} variant="sh" toast={toast} />
      </div>

      <div className="s-card" style={{ gridColumn: '1 / -1', padding: '18px 20px' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--s-green-050)', color: 'var(--s-green-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><SIcon n="shield" /></span>
          <div style={{ flex: 1, minWidth: 260 }}>
            <b style={{ fontSize: 14, fontWeight: 800, display: 'block' }}>Data patří domu, ne nám</b>
            <p style={{ fontSize: 12.5, color: 'var(--s-ink-2)', lineHeight: 1.55, margin: '6px 0 0' }}>
              Kompletní export si stáhnete kdykoli sami: jednotky, členové, všechny platby, oznámení včetně
              čtenosti po bytech, závady, hlasování s plnými mocemi, soužití i soubory dokumentů. CSV pro Excel,
              JSON pro stroje. Ukončení služby: jedna zpráva na info@tasker.cz a do 30 dnů smažeme všechna
              data domu z databáze i úložiště.
            </p>
            <div className="a-acts" style={{ marginTop: 12 }}>
              <button className="s-btn s-dark sm" onClick={doExport} disabled={!!exp}>
                {exp || 'Stáhnout kompletní export (ZIP)'}
              </button>
              {isDemo && <span className="a-note">v ukázce bez souborů dokumentů</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
