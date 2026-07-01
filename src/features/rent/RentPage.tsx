import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Unit } from '../../lib/types'
import { can } from '../../lib/types'
import * as M from '../../lib/mockData'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'
import { PayModal } from '../../components/QrPlatba'
import type { PayItem } from '../../components/QrPlatba'

const money = (n: number) => n.toLocaleString('cs-CZ') + ' Kč'

export default function RentPage() {
  const { user } = useSession(); const role = user?.role; const unit = user?.unit ?? ''
  const toast = useToast()
  const [units, setUnits] = useState<Unit[]>([])
  const [pays, setPays] = useState(M.myPayments)
  const [modal, setModal] = useState<PayItem | null>(null)
  const [auto, setAuto] = useState<Record<string, boolean>>({})
  useEffect(() => { api.getUnits().then(setUnits) }, [])

  const occupied = units.filter((u) => u.tenant !== 'Volné')
  const revenue = occupied.reduce((s, u) => s + u.rent, 0)
  const unpaid = occupied.filter((u) => !u.paid)
  const ending = units.filter((u) => u.endSoon)
  async function remind(u: Unit) { await api.remind(u.id); toast(`Upomínka odeslána: ${u.id}`) }
  const asItem = (o: { id: string; label: string; amount: number; vs: string; due?: string; recurring?: boolean; msg?: string }): PayItem =>
    ({ id: o.id, label: o.label, amount: o.amount, vs: o.vs, due: o.due || '15.', recurring: o.recurring ?? true, msg: o.msg || o.label })

  // ---------- Rezident: my payments with QR ----------
  if (can(role!, 'own_rent')) {
    const me = units.find((u) => u.id === unit)
    const due = pays.filter((p) => p.status === 'unpaid')
    return (
      <div>
        <div className="view-head"><div><h1>Moje platby</h1><div className="desc">Nájem, zálohy a poplatky za jednotku {unit}</div></div></div>
        <div className="grid-2">
          <div className="card">
            <div className="card-h"><h3>K úhradě</h3>{due.length > 0 ? <span className="pill pill-warn">{due.length} k zaplacení</span> : <span className="pill pill-ok">Vše uhrazeno</span>}</div>
            {pays.map((p) => (
              <div className="row-card" key={p.id} style={{ marginTop: 10 }}>
                <div className="lead-col"><b>{p.label}</b><span>VS {p.vs} · splatnost {p.due} dne</span></div>
                <div className="row-metrics">
                  <div className="metric"><div className="k">Částka</div><div className="val">{money(p.amount)}</div></div>
                  {auto[p.id]
                    ? <span className="pill pill-ok"><Icon name="check" small /> Automaticky</span>
                    : p.status === 'paid'
                      ? <span className="pill pill-ok"><Icon name="check" small /> Zaplaceno</span>
                      : <button className="btn btn-primary btn-sm" onClick={() => setModal(asItem(p))}><Icon name="bank" small /> Zaplatit</button>}
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-h"><h3>Smlouva a způsob platby</h3></div>
            <div className="doc-row"><span className="cf-ic"><Icon name="doc" small /></span><div><b>Konec smlouvy</b><span>{me?.end || '31. 8. 2026'}</span></div></div>
            <div className="doc-row"><span className="cf-ic"><Icon name="bank" small /></span><div><b>Způsob platby</b><span>QR platba nebo trvalý příkaz</span></div></div>
            <div className="doc-row"><span className="cf-ic"><Icon name="check" small /></span><div><b>Poslední platba</b><span>leden 2026, spárováno</span></div></div>
            <div className="qr-soon" style={{ marginTop: 8 }}><Icon name="bank" small /> Automatické strhávání kartou brzy.</div>
          </div>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h"><h3>Historie plateb</h3><span className="sub">spárováno z banky</span></div>
          {M.payHistory.map((h) => (
            <div className="doc-row" key={h.id}><span className="cf-ic"><Icon name="bank" small /></span><div style={{ flex: 1 }}><b>{h.label}</b><span>{h.date}</span></div><span style={{ fontWeight: 700, fontSize: 13.5 }}>{money(h.amount)}</span></div>
          ))}
        </div>
        <PayModal item={modal} account={M.payAccount} recipient={M.payRecipient} onClose={() => setModal(null)} onPaid={(id) => { setPays((s) => s.map((p) => p.id === id ? { ...p, status: 'paid' } : p)); toast('Označeno jako zaplaceno, čeká na spárování') }} onAutopay={(id) => { setAuto((a) => ({ ...a, [id]: true })); setPays((s) => s.map((p) => p.id === id ? { ...p, status: 'paid' } : p)); toast('Automatické platby zapnuty') }} />
      </div>
    )
  }

  // ---------- Výbor: SVJ contributions and debtors ----------
  if (can(role!, 'svj_contrib')) {
    return (
      <div>
        <div className="view-head"><div><h1>Příspěvky SVJ</h1><div className="desc">Fond oprav a dlužníci domu</div></div></div>
        <div className="grid-3">
          <div className="stat"><div className="l"><Icon name="bank" small /> Fond oprav</div><div className="v">1 284 500 <small>Kč</small></div></div>
          <div className="stat"><div className="l"><Icon name="check" small /> Vybráno tento měsíc</div><div className="v">{money(revenue)}</div></div>
          <div className="stat"><div className="l"><Icon name="zavady" small /> Dlužníci</div><div className="v">{unpaid.length}</div></div>
        </div>
        <div className="stat" style={{ marginTop: 16 }}>
          <div className="card-h"><h3>Dlužníci</h3><span className="sub">Neuhrazené příspěvky</span></div>
          {unpaid.length === 0 && <div className="empty"><span className="cf-ic"><Icon name="check" /></span><p>Nikdo nedluží. Skvělé.</p></div>}
          {unpaid.map((u) => (
            <div className="row-card" key={u.id} style={{ marginTop: 10 }}>
              <div className="lead-col"><b className="mono">{u.id}</b><span>{u.tenant}</span></div>
              <div className="row-metrics"><div className="metric"><div className="k">Dluží</div><div className="val">{money(u.rent)}</div></div>
                <button className="btn btn-ghost btn-sm" onClick={() => setModal(asItem({ id: u.id, label: `Příspěvek ${u.id}`, amount: u.rent, vs: u.vs, msg: `Prispevek ${u.id}` }))}><Icon name="bank" small /> QR</button>
                <button className="btn btn-soft btn-sm" onClick={() => remind(u)}>Upomenout</button></div>
            </div>
          ))}
        </div>
        <PayModal item={modal} account={M.payAccount} recipient={M.payRecipient} onClose={() => setModal(null)} />
      </div>
    )
  }

  // ---------- Developer and investor: portfolio with bank matching + QR ----------
  return (
    <div>
      <div className="view-head">
        <div><h1>Nájmy a platby</h1><div className="desc">Portfolio jednotek s párováním plateb z banky</div></div>
        <span className="pill pill-ok"><Icon name="bank" small /> Napojeno na Fio banku</span>
      </div>
      <div className="grid-4">
        <div className="stat"><div className="l"><Icon name="nastenka" small /> Obsazenost</div><div className="v">{occupied.length}/{units.length}</div></div>
        <div className="stat"><div className="l"><Icon name="bank" small /> Měsíční výnos</div><div className="v">{money(revenue)}</div></div>
        <div className="stat"><div className="l"><Icon name="zavady" small /> Nezaplaceno</div><div className="v">{unpaid.length}</div></div>
        <div className="stat"><div className="l"><Icon name="clock" small /> Končící smlouvy</div><div className="v">{ending.length}</div></div>
      </div>
      <div className="stat" style={{ marginTop: 16, overflowX: 'auto' }}>
        <table className="tbl">
          <thead><tr><th>Jednotka</th><th>Nájemník</th><th>Nájem</th><th>VS</th><th>Stav</th><th>Konec smlouvy</th><th></th></tr></thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id}>
                <td className="mono">{u.id}</td>
                <td>{u.tenant}</td>
                <td>{money(u.rent)}</td>
                <td className="mono">{u.vs}</td>
                <td>{u.tenant === 'Volné' ? <span className="pill pill-neutral">Volné</span> : u.paid ? <span className="pill pill-ok">Zaplaceno</span> : <span className="pill pill-bad">Nezaplaceno</span>}</td>
                <td>{u.endSoon ? <span className="pill pill-warn">{u.end}</span> : (u.end || '-')}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {u.tenant !== 'Volné' && u.rent > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setModal(asItem({ id: u.id, label: `Nájem ${u.id}`, amount: u.rent, vs: u.vs, msg: `Najem ${u.id}` }))}>QR</button>}
                  {!u.paid && u.tenant !== 'Volné' && <button className="btn btn-soft btn-sm" style={{ marginLeft: 6 }} onClick={() => remind(u)}>Upomenout</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PayModal item={modal} account={M.payAccount} recipient={M.payRecipient} onClose={() => setModal(null)} />
    </div>
  )
}
