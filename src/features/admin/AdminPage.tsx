import { useMemo, useState } from 'react'
import { feed } from '../../lib/api'
import { can } from '../../lib/types'
import type { Role } from '../../lib/types'
import * as M from '../../lib/mockData'
import * as A from '../../lib/adminData'
import type { AUnit } from '../../lib/adminData'
import { parseAccount, czIban, formatIban } from '../../lib/payments'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'

const money = (n: number) => n.toLocaleString('cs-CZ') + ' Kč'
type Toast = (m: string) => void

const TABS = [
  { id: 'prehled', label: 'Přehled' }, { id: 'jednotky', label: 'Jednotky' }, { id: 'lide', label: 'Lidé' },
  { id: 'finance', label: 'Finance' }, { id: 'udrzba', label: 'Údržba' }, { id: 'schuze', label: 'Schůze' },
  { id: 'nastenka', label: 'Nástěnka' }, { id: 'dokumenty', label: 'Dokumenty' }, { id: 'nastaveni', label: 'Nastavení' },
]

export default function AdminPage() {
  const { user } = useSession()
  const toast = useToast()
  const [tab, setTab] = useState('prehled')
  const [building, setBuilding] = useState(A.portfolio[0].id)

  if (!user || !can(user.role as Role, 'admin')) {
    return (
      <div>
        <div className="view-head"><div><h1>Správa domu</h1></div></div>
        <div className="empty"><span className="cf-ic"><Icon name="sprava" /></span><p>Správa je dostupná jen výboru SVJ a developerovi. Přepněte roli nahoře.</p></div>
      </div>
    )
  }

  return (
    <div>
      <div className="view-head">
        <div><h1>Správa domu</h1><div className="desc">Kompletní řízení budovy, jednotek, financí a provozu</div></div>
        <div className="role-switch"><label>Budova</label>
          <select value={building} onChange={(e) => setBuilding(e.target.value)}>
            {A.portfolio.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <div className="adm-tabs">
        {TABS.map((t) => <button key={t.id} className={'adm-tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {tab === 'prehled' && <Overview toast={toast} />}
      {tab === 'jednotky' && <Units toast={toast} />}
      {tab === 'lide' && <People toast={toast} />}
      {tab === 'finance' && <Finance toast={toast} />}
      {tab === 'udrzba' && <Maintenance toast={toast} />}
      {tab === 'schuze' && <Meetings toast={toast} />}
      {tab === 'nastenka' && <Board toast={toast} user={user} />}
      {tab === 'dokumenty' && <Documents toast={toast} />}
      {tab === 'nastaveni' && <Settings toast={toast} />}
    </div>
  )
}

/* ---------------- Přehled ---------------- */
function Overview({ toast }: { toast: Toast }) {
  const rented = A.units.filter((u) => u.rent > 0 && u.tenant !== 'Volné')
  const vacant = A.units.filter((u) => u.tenant === 'Volné')
  const rentRoll = rented.reduce((s, u) => s + u.rent, 0)
  const collected = rented.filter((u) => u.paid).reduce((s, u) => s + u.rent, 0)
  const unpaid = rented.filter((u) => !u.paid)
  const faultsOpen = M.faults.filter((f) => f.status !== 'Vyřešeno')
  const complaints = Object.values(M.complaints).reduce((s, a) => s + a.length, 0)
  const revizeSoon = A.revize.filter((r) => r.status !== 'Platná')
  const codesFree = A.codes.filter((c) => c.status === 'Aktivní' && c.unit !== 'výbor').length

  const kpis = [
    { l: 'Obsazenost', v: `${A.units.length - vacant.length}/${A.units.length}`, i: 'nastenka' },
    { l: 'Výběr nájmů', v: `${Math.round((collected / rentRoll) * 100)} %`, i: 'bank' },
    { l: 'Měsíční předpis', v: money(rentRoll), i: 'najmy' },
    { l: 'Fond oprav', v: money(A.fund.balance), i: 'sprava' },
    { l: 'Otevřené závady', v: String(faultsOpen.length), i: 'zavady' },
    { l: 'Stížnosti tento měsíc', v: String(complaints), i: 'stiznosti' },
  ]
  const alerts = [
    { c: 'var(--bad)', t: `${unpaid.length} jednotky nezaplatily nájem`, s: unpaid.map((u) => u.id).join(', '), a: 'Upomenout', act: () => toast('Upomínky odeslány nájemníkům') },
    { c: 'var(--bad)', t: 'Revize plynu po termínu', s: 'GasKontrol, termín byl 2. 12. 2025', a: 'Objednat', act: () => toast('Poptávka odeslána dodavateli') },
    { c: 'var(--warn)', t: `${faultsOpen.length} závady bez technika`, s: 'Čekají na přiřazení', a: 'Přiřadit', act: () => toast('Otevřete záložku Údržba pro přiřazení') },
    { c: 'var(--warn)', t: 'Revize výtahu za 12 dní', s: 'VýtahServis s.r.o., 14. 3. 2026', a: 'Naplánovat', act: () => toast('Termín revize navržen') },
    { c: 'var(--warn)', t: 'Smlouva C-118 končí za 30 dní', s: 'Tomáš Blažek, 28. 2. 2026', a: 'Prodloužit', act: () => toast('Návrh prodloužení připraven') },
    { c: 'var(--ok)', t: `${codesFree} přístupové kódy nevyužité`, s: 'A-102, D-410, 1 volný', a: 'Spravovat', act: () => toast('Otevřete záložku Lidé') },
  ]

  return (
    <div>
      <div className="adm-kpis">
        {kpis.map((k) => (
          <div className="stat" key={k.l}><div className="l"><Icon name={k.i} small /> {k.l}</div><div className="v">{k.v}</div></div>
        ))}
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-h"><h3>Vyžaduje pozornost</h3><span className="pill pill-warn">{alerts.length}</span></div>
          {alerts.map((al, i) => (
            <div className="adm-alert" key={i}>
              <span className="adm-dot" style={{ background: al.c }} />
              <div className="a-main"><b>{al.t}</b><span>{al.s}</span></div>
              <button className="btn btn-soft btn-sm" onClick={al.act}>{al.a}</button>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-h"><h3>Poslední aktivita</h3><span className="adm-mini">audit log</span></div>
          {A.activity.map((e, i) => (
            <div className="doc-row" key={i}>
              <span className="cf-ic"><Icon name={e.icon} small /></span>
              <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontWeight: 600, fontSize: 13.5 }}>{e.actor} {e.action}</b><span>{e.target}</span></div>
              <span className="adm-mini">{e.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Jednotky ---------------- */
function Units({ toast }: { toast: Toast }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('vse')
  const [sel, setSel] = useState<AUnit | null>(null)
  const list = A.units.filter((u) => {
    const okQ = !q || u.id.toLowerCase().includes(q.toLowerCase()) || u.tenant.toLowerCase().includes(q.toLowerCase()) || u.owner.toLowerCase().includes(q.toLowerCase())
    const okF = filter === 'vse' || (filter === 'obsazene' && u.tenant !== 'Volné') || (filter === 'volne' && u.tenant === 'Volné') || (filter === 'parking' && u.type === 'Parking')
    return okQ && okF
  })
  const occ = A.units.filter((u) => u.tenant !== 'Volné').length

  return (
    <div>
      <div className="adm-kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="stat"><div className="l">Jednotek</div><div className="v">{A.units.length}</div></div>
        <div className="stat"><div className="l">Obsazeno</div><div className="v">{occ}</div></div>
        <div className="stat"><div className="l">Volných</div><div className="v">{A.units.length - occ}</div></div>
        <div className="stat"><div className="l">Podíl celkem</div><div className="v">{A.units.reduce((s, u) => s + u.share, 0).toFixed(1)} %</div></div>
      </div>
      <div className="adm-bar">
        <input className="input" placeholder="Hledat jednotku, vlastníka nebo nájemníka" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips" style={{ margin: 0 }}>
          {[['vse', 'Vše'], ['obsazene', 'Obsazené'], ['volne', 'Volné'], ['parking', 'Parking']].map(([k, l]) => (
            <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => toast('Formulář nové jednotky')}><Icon name="plus" small /> Přidat jednotku</button>
      </div>
      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table className="tbl">
          <thead><tr><th>Jednotka</th><th>Podlaží</th><th>Plocha</th><th>Typ</th><th>Vlastník</th><th>Nájemník</th><th>Nájem</th><th>VS</th><th>Podíl</th><th>Stav</th></tr></thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => setSel(u)}>
                <td className="mono">{u.id}</td><td>{u.floor}</td><td>{u.area ? `${u.area} m²` : '-'}</td><td>{u.type}</td>
                <td>{u.owner}</td><td>{u.tenant === 'Volné' ? <span className="adm-mini">Volné</span> : u.tenant}</td>
                <td>{u.rent ? money(u.rent) : '-'}</td><td className="mono">{u.vs}</td><td>{u.share} %</td>
                <td>{u.tenant === 'Volné' ? <span className="pill pill-neutral">Volné</span> : u.rent === 0 ? <span className="pill pill-ok">Vlastník</span> : u.paid ? <span className="pill pill-ok">Zaplaceno</span> : <span className="pill pill-bad">Dluh</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && (
        <div className="overlay" onClick={() => setSel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h"><h3>Jednotka {sel.id}</h3><button className="btn btn-ghost btn-icon" onClick={() => setSel(null)}><Icon name="x" small /></button></div>
            <div className="modal-b">
              <div className="grid-2" style={{ gap: 12 }}>
                <Detail k="Podlaží" v={sel.floor} /><Detail k="Plocha" v={sel.area ? `${sel.area} m²` : '-'} />
                <Detail k="Typ" v={sel.type} /><Detail k="Podíl na domě" v={`${sel.share} %`} />
                <Detail k="Vlastník" v={sel.owner} /><Detail k="Nájemník" v={sel.tenant} />
                <Detail k="Nájem" v={sel.rent ? money(sel.rent) : 'bez nájmu'} /><Detail k="Kauce" v={sel.deposit ? money(sel.deposit) : '-'} />
                <Detail k="Variabilní symbol" v={sel.vs} mono /><Detail k="Konec smlouvy" v={sel.leaseEnd || '-'} />
                <Detail k="Vodoměr" v={sel.water || '-'} /><Detail k="Teplo" v={sel.heat || '-'} />
              </div>
            </div>
            <div className="modal-f"><button className="btn btn-ghost btn-sm" onClick={() => toast('Historie jednotky')}>Historie</button><button className="btn btn-primary btn-sm" onClick={() => { setSel(null); toast('Úprava jednotky uložena') }}>Upravit</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
function Detail({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return <div><div className="adm-mini" style={{ marginBottom: 3 }}>{k}</div><div className={mono ? 'mono' : ''} style={{ fontSize: 14, fontWeight: 600 }}>{v}</div></div>
}

/* ---------------- Lidé ---------------- */
function People({ toast }: { toast: Toast }) {
  const [codes, setCodes] = useState(A.codes)
  function gen() { const c = { code: 'TL-VP-' + Math.random().toString(36).slice(2, 6).toUpperCase(), unit: 'nepřiřazeno', role: 'Rezident', status: 'Aktivní' as const, expires: '30 dní' }; setCodes((s) => [c, ...s]); toast(`Kód vytvořen: ${c.code}`) }
  function revoke(code: string) { setCodes((s) => s.map((c) => c.code === code ? { ...c, status: 'Zrušen' as const } : c)); toast('Kód zrušen') }

  return (
    <div className="grid-2">
      <div className="card" style={{ padding: 0 }}>
        <div className="card-h" style={{ padding: '16px 18px 0' }}><h3>Obyvatelé a členové</h3><span className="adm-mini">{A.members.length} osob</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Jméno</th><th>Jednotka</th><th>Role</th><th>Stav</th><th></th></tr></thead>
            <tbody>
              {A.members.map((m) => (
                <tr key={m.name + m.unit}>
                  <td><b style={{ fontWeight: 600 }}>{m.name}</b><br /><span className="adm-mini">{m.email || 'bez e-mailu'}</span></td>
                  <td className="mono">{m.unit}</td>
                  <td><span className={'pill ' + (m.role === 'Výbor' ? 'pill-ok' : 'pill-neutral')}>{m.role}</span></td>
                  <td>{m.status === 'Aktivní' ? <span className="pill pill-ok">Aktivní</span> : <span className="pill pill-warn">{m.status}</span>}</td>
                  <td style={{ textAlign: 'right' }}><button className="btn btn-ghost btn-sm" onClick={() => toast(`Úprava, ${m.name}`)}>Upravit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h3>Přístupové kódy</h3><button className="btn btn-soft btn-sm" onClick={gen}><Icon name="plus" small /> Vygenerovat</button></div>
        {codes.map((c) => (
          <div className="doc-row" key={c.code}>
            <span className="cf-ic"><Icon name="check" small /></span>
            <div style={{ flex: 1, minWidth: 0 }}><b className="mono" style={{ fontSize: 13.5 }}>{c.code}</b><span>{c.unit} · {c.role} · {c.expires}</span></div>
            {c.status === 'Aktivní' ? <button className="btn btn-ghost btn-sm" onClick={() => revoke(c.code)}>Zrušit</button> : <span className={'pill ' + (c.status === 'Použit' ? 'pill-neutral' : 'pill-bad')}>{c.status}</span>}
          </div>
        ))}
        <p className="adm-mini" style={{ marginTop: 12 }}>Rezident se kódem připojí k jednotce se správnou rolí. Kódy pro výbor mají plná práva správy.</p>
      </div>
    </div>
  )
}

/* ---------------- Finance ---------------- */
function Finance({ toast }: { toast: Toast }) {
  const [txns, setTxns] = useState(A.transactions)
  const rented = A.units.filter((u) => u.rent > 0 && u.tenant !== 'Volné')
  const rentRoll = rented.reduce((s, u) => s + u.rent, 0)
  const collected = rented.filter((u) => u.paid).reduce((s, u) => s + u.rent, 0)
  const unmatched = txns.filter((t) => !t.unit)
  function assign(id: string) { setTxns((s) => s.map((t) => t.id === id ? { ...t, unit: 'ručně' } : t)); toast('Platba přiřazena k jednotce') }

  return (
    <div>
      <div className="adm-kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="stat"><div className="l"><Icon name="najmy" small /> Měsíční předpis</div><div className="v">{money(rentRoll)}</div></div>
        <div className="stat"><div className="l"><Icon name="bank" small /> Vybráno</div><div className="v">{money(collected)}</div></div>
        <div className="stat"><div className="l"><Icon name="zavady" small /> Nezaplaceno</div><div className="v">{money(rentRoll - collected)}</div></div>
        <div className="stat"><div className="l"><Icon name="sprava" small /> Fond oprav</div><div className="v">{money(A.fund.balance)}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h"><h3>Bankovní pohyby</h3><span className="pill pill-ok"><Icon name="bank" small /> Fio, párování dle VS</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Datum</th><th>Protistrana</th><th>Částka</th><th>VS</th><th>Stav</th><th></th></tr></thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id}>
                  <td className="adm-mini">{t.date}</td><td>{t.party}</td><td>{money(t.amount)}</td><td className="mono">{t.vs}</td>
                  <td>{t.unit ? <span className="pill pill-ok">Spárováno {t.unit}</span> : <span className="pill pill-warn">Nespárováno</span>}</td>
                  <td style={{ textAlign: 'right' }}>{!t.unit && <button className="btn btn-soft btn-sm" onClick={() => assign(t.id)}>Přiřadit</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {unmatched.length > 0 && <p className="adm-mini" style={{ marginTop: 10 }}>{unmatched.length} platby čekají na ruční přiřazení, chybí nebo nesedí variabilní symbol.</p>}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-h"><h3>Fond oprav</h3><span className="adm-mini">+ {money(A.fund.contributionsMonthly)} / měsíc</span></div>
          <div className="stat" style={{ border: 'none', padding: 0, marginBottom: 8 }}><div className="v">{money(A.fund.balance)}</div><div className="adm-mini">aktuální zůstatek</div></div>
          {A.fund.expenses.map((e, i) => (
            <div className="doc-row" key={i}><span className="cf-ic"><Icon name="doc" small /></span><div style={{ flex: 1 }}><b style={{ fontWeight: 600, fontSize: 13.5 }}>{e.name}</b><span>{e.date}</span></div><span style={{ color: 'var(--bad)', fontWeight: 600, fontSize: 13.5 }}>- {money(e.amount)}</span></div>
          ))}
        </div>
        <div className="card">
          <div className="card-h"><h3>Nezaplacené nájmy</h3><button className="btn btn-soft btn-sm" onClick={() => toast('Upomínky odeslány')}>Upomenout vše</button></div>
          {rented.filter((u) => !u.paid).map((u) => (
            <div className="doc-row" key={u.id}><span className="cf-ic"><Icon name="najmy" small /></span><div style={{ flex: 1 }}><b style={{ fontWeight: 600, fontSize: 13.5 }}>{u.id} · {u.tenant}</b><span>VS {u.vs}</span></div><span style={{ fontWeight: 600, fontSize: 13.5 }}>{money(u.rent)}</span></div>
          ))}
          {rented.every((u) => u.paid) && <p className="adm-mini">Vše zaplaceno.</p>}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => toast('Export pro účetní stažen')}><Icon name="doc" small /> Export pro účetní</button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Údržba ---------------- */
function Maintenance({ toast }: { toast: Toast }) {
  const [faults, setFaults] = useState(M.faults.map((f) => ({ ...f, worker: '', prio: f.status === 'Nahlášeno' ? 'Střední' : 'Vysoká' })))
  function assign(id: number) { setFaults((s) => s.map((f) => f.id === id ? { ...f, worker: 'Instalatér Novák', status: 'V řešení' as const } : f)); toast('Technik přiřazen, Instalatér Novák') }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h"><h3>Závady</h3><span className="pill pill-warn">{faults.filter((f) => f.status !== 'Vyřešeno').length} otevřených</span></div>
        {faults.map((f) => (
          <div className="row-card" key={f.id} style={{ marginBottom: 8 }}>
            <div className="lead-col"><b>{f.cat}</b><span>{f.loc}</span></div>
            <div style={{ flex: 1, minWidth: 140, fontSize: 13.5, color: 'var(--ink-2)' }}>{f.desc}</div>
            <div className="row-metrics">
              <div className="metric"><div className="k">Priorita</div><div className="val">{f.prio}</div></div>
              <div className="metric"><div className="k">Technik</div><div className="val">{f.worker || 'nepřiřazen'}</div></div>
              <span className={'pill ' + (f.status === 'Vyřešeno' ? 'pill-ok' : f.status === 'V řešení' ? 'pill-warn' : 'pill-bad')}>{f.status}</span>
              {f.status !== 'Vyřešeno' && !f.worker && <button className="btn btn-soft btn-sm" onClick={() => assign(f.id)}>Přiřadit</button>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card" style={{ padding: 0 }}>
          <div className="card-h" style={{ padding: '16px 18px 0' }}><h3>Revize a kontroly</h3><span className="adm-mini">zákonné termíny</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Typ</th><th>Další termín</th><th>Dodavatel</th><th>Stav</th></tr></thead>
              <tbody>
                {A.revize.map((r) => (
                  <tr key={r.type}><td>{r.type}</td><td className="mono">{r.next}</td><td className="adm-mini">{r.provider}</td>
                    <td>{r.status === 'Platná' ? <span className="pill pill-ok">Platná</span> : r.status === 'Blíží se' ? <span className="pill pill-warn">Blíží se</span> : <span className="pill pill-bad">Po termínu</span>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Dodavatelé</h3><button className="btn btn-ghost btn-sm" onClick={() => toast('Nový dodavatel')}><Icon name="plus" small /> Přidat</button></div>
          {A.vendors.map((v) => (
            <div className="doc-row" key={v.name}><span className="cf-ic"><Icon name="phone" small /></span><div style={{ flex: 1 }}><b style={{ fontWeight: 600, fontSize: 13.5 }}>{v.name}</b><span>{v.field} · {v.phone}</span></div><span className="pill pill-neutral">★ {v.rating}</span></div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Schůze ---------------- */
function Meetings({ toast }: { toast: Toast }) {
  const m = M.meetings[0]
  const p = M.poll
  const yesShare = Math.round((p.yes / (p.yes + p.no)) * 100)
  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-h"><h3>Schůze vlastníků</h3><button className="btn btn-primary btn-sm" onClick={() => toast('Formulář nové schůze')}><Icon name="plus" small /> Naplánovat</button></div>
        <div className="doc-row"><span className="cf-ic"><Icon name="schuze" small /></span><div style={{ flex: 1 }}><b style={{ fontWeight: 600 }}>{m.date}</b><span>{m.place}</span></div><span className="pill pill-warn">Plánováno</span></div>
        <div style={{ marginTop: 12 }}><div className="adm-mini" style={{ marginBottom: 6 }}>Program</div>
          {m.agenda.map((a, i) => <div key={i} style={{ fontSize: 14, padding: '5px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>{i + 1}. {a}</div>)}
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 20 }}>
          <div><div className="adm-mini">Účast</div><div style={{ fontWeight: 700, fontSize: 15 }}>18 z 40 jednotek</div></div>
          <div><div className="adm-mini">Kvórum podílů</div><div style={{ fontWeight: 700, fontSize: 15 }}>62 %, splněno</div></div>
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h3>Hlasování per rollam</h3><button className="btn btn-ghost btn-sm" onClick={() => toast('Nové hlasování')}><Icon name="plus" small /> Nové</button></div>
        <p style={{ fontSize: 14, fontWeight: 600 }}>{p.q}</p>
        <div style={{ margin: '12px 0' }}>
          <div className="bar"><span style={{ width: `${yesShare}%` }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }} className="adm-mini"><span>Pro {p.yes} · {yesShare} % podílů</span><span>Proti {p.no}</span></div>
        </div>
        <div className="adm-mini">Uzávěrka za 6 dní. Rozhoduje podíl na společných částech, ne počet hlasů.</div>
        <div className="doc-row" style={{ marginTop: 12 }}><span className="cf-ic"><Icon name="doc" small /></span><div style={{ flex: 1 }}><b style={{ fontWeight: 600, fontSize: 13.5 }}>Zápis 11/2025</b><span>schválené usnesení</span></div><button className="btn btn-ghost btn-sm" onClick={() => toast('Otevírám zápis')}>Otevřít</button></div>
      </div>
    </div>
  )
}

/* ---------------- Nástěnka (announce + moderation) ---------------- */
function Board({ toast, user }: { toast: Toast; user: { role: Role; buildingId: string } }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState('Všichni')
  async function publish() {
    if (!title.trim()) { toast('Zadejte nadpis'); return }
    const text = body.trim() ? `${title}\n\n${body}` : title
    await feed.createPost({ buildingId: user.buildingId, author: { name: 'Výbor SVJ', handle: 'vybor', role: user.role }, kind: 'ozn', body: text })
    setTitle(''); setBody(''); toast(`Oznámení publikováno, cíl: ${target}`)
  }
  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-h"><h3>Nové oznámení</h3></div>
        <div className="field"><label>Nadpis</label><input className="input" placeholder="Např. Odstávka výtahu" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label>Text</label><textarea className="input" placeholder="Detaily oznámení..." value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <div className="field"><label>Komu</label>
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}><option>Všichni</option><option>Jen vlastníci</option><option>Jen nájemníci</option></select>
        </div>
        <button className="btn btn-primary btn-sm" onClick={publish}><Icon name="send" small /> Publikovat na nástěnku</button>
      </div>
      <div className="card">
        <div className="card-h"><h3>Moderace příspěvků</h3><span className="adm-mini">poslední</span></div>
        {M.feed.slice(0, 5).map((p) => (
          <div className="doc-row" key={p.id}>
            <span className="cf-ic"><Icon name={p.kind === 'ozn' ? 'nastenka' : 'msg'} small /></span>
            <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontWeight: 600, fontSize: 13.5 }}>{p.authorName}</b><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{p.body}</span></div>
            <button className="btn btn-ghost btn-sm" onClick={() => toast('Příspěvek skryt')}>Skrýt</button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Dokumenty ---------------- */
function Documents({ toast }: { toast: Toast }) {
  return (
    <div>
      <div className="adm-bar">
        <input className="input" placeholder="Hledat dokument" onChange={() => {}} />
        <button className="btn btn-primary btn-sm" onClick={() => toast('Nahrání dokumentu')}><Icon name="plus" small /> Nahrát dokument</button>
      </div>
      <div className="grid-2">
        {A.docCats.map((cat) => (
          <div className="card" key={cat.name}>
            <div className="card-h"><h3>{cat.name}</h3><span className="adm-mini">{cat.docs.length}</span></div>
            {cat.docs.map((d) => (
              <div className="doc-row" key={d.name}><span className="cf-ic"><Icon name={cat.icon} small /></span><div style={{ flex: 1, minWidth: 0 }}><b style={{ fontWeight: 600, fontSize: 13.5 }}>{d.name}</b><span>{d.date} · {d.size}</span></div><button className="btn btn-ghost btn-sm" onClick={() => toast('Stahuji dokument')}>Otevřít</button></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Nastavení ---------------- */
function Settings({ toast }: { toast: Toast }) {
  const [integ, setInteg] = useState(A.integrations)
  const [notif, setNotif] = useState({ email: true, sms: false, push: true })
  const [payAcc, setPayAcc] = useState(M.payAccount)
  const _a = parseAccount(payAcc); const iban = czIban(_a.prefix, _a.account, _a.bank)
  function toggle(id: string) { setInteg((s) => s.map((i) => i.id === id ? { ...i, on: !i.on, tag: i.on ? 'Nepřipojeno' : 'Připojeno' } : i)); toast('Nastavení integrace uloženo') }

  return (
    <div className="grid-2">
      <div className="col">
        <div className="card">
          <div className="card-h"><h3>Profil domu</h3></div>
          <div className="field"><label>Název</label><input className="input" defaultValue={A.profile.name} /></div>
          <div className="field"><label>Adresa</label><input className="input" defaultValue={A.profile.address} /></div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="field"><label>IČO SVJ</label><input className="input mono" defaultValue={A.profile.ico} /></div>
            <div className="field"><label>Bankovní účet</label><input className="input mono" defaultValue={A.profile.account} /></div>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="field"><label>Kontaktní e-mail</label><input className="input" defaultValue={A.profile.contactEmail} /></div>
            <div className="field"><label>Telefon</label><input className="input" defaultValue={A.profile.contactPhone} /></div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => toast('Profil domu uložen')}>Uložit změny</button>
        </div>
        <div className="card">
          <div className="card-h"><h3>Notifikace</h3></div>
          {([['email', 'E-mailem'], ['sms', 'SMS'], ['push', 'Push do aplikace']] as const).map(([k, l]) => (
            <div className="contact-row" key={k}><div style={{ flex: 1 }}><b style={{ fontWeight: 600, fontSize: 14 }}>{l}</b></div><button className={'toggle' + ((notif as any)[k] ? ' on' : '')} onClick={() => setNotif((n) => ({ ...n, [k]: !(n as any)[k] }))} /></div>
          ))}
        </div>
      </div>
      <div className="col">
        <div className="card">
          <div className="card-h"><h3>Integrace</h3></div>
          {integ.map((i) => (
            <div className="contact-row" key={i.id}>
              <span className="cf-ic"><Icon name={i.id === 'fio' || i.id === 'gocardless' ? 'bank' : i.id === 'tasker' ? 'sluzby' : 'check'} small /></span>
              <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontWeight: 600, fontSize: 14 }}>{i.name}</b><br /><span className="adm-mini">{i.desc}</span></div>
              <button className={i.on ? 'btn btn-ghost btn-sm' : 'btn btn-soft btn-sm'} onClick={() => toggle(i.id)}>{i.on ? 'Odpojit' : 'Připojit'}</button>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-h"><h3>Platby a QR</h3></div>
          <div className="field"><label>Účet pro QR platby</label><input className="input mono" value={payAcc} onChange={(e) => setPayAcc(e.target.value)} /></div>
          <div className="qr-line"><span>IBAN</span><b className="mono" style={{ fontSize: 11 }}>{formatIban(iban)}</b></div>
          <p className="adm-mini" style={{ marginTop: 10 }}>Nájem, zálohy, fond oprav a kauce se hradí QR platbou nebo trvalým příkazem na tento účet, párováno podle VS. Služby Tasker se platí přes Tasker API. Platba kartou přes Stripe se připravuje.</p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => toast('Účet pro platby uložen')}>Uložit</button>
        </div>
        <div className="card" style={{ borderColor: 'var(--bad-bg)' }}>
          <div className="card-h"><h3>Nebezpečná zóna</h3></div>
          <p className="adm-mini" style={{ marginBottom: 12 }}>Archivace odpojí dům od aplikace. Data zůstanou uložena podle nastavení retence GDPR.</p>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--bad)', borderColor: 'var(--bad-bg)' }} onClick={() => toast('Vyžaduje potvrzení')}>Archivovat dům</button>
        </div>
      </div>
    </div>
  )
}
