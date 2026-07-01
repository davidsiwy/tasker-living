import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Unit } from '../../lib/types'
import { can } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'

const money = (n: number) => n.toLocaleString('cs-CZ') + ' Kč'

export default function RentPage() {
  const { user } = useSession(); const role = user?.role; const unit = user?.unit ?? ''
  const toast = useToast()
  const [units, setUnits] = useState<Unit[]>([])
  useEffect(() => { api.getUnits().then(setUnits) }, [])

  const occupied = units.filter((u) => u.tenant !== 'Volné')
  const revenue = occupied.reduce((s, u) => s + u.rent, 0)
  const unpaid = occupied.filter((u) => !u.paid)
  const ending = units.filter((u) => u.endSoon)
  async function remind(u: Unit) { await api.remind(u.id); toast(`Upomínka odeslána: ${u.id}`) }

  // Rezident: own rent only
  if (can(role!, 'own_rent')) {
    const me = units.find((u) => u.id === unit)
    return (
      <div>
        <div className="view-head"><div><h1>Můj nájem</h1><div className="desc">Přehled plateb za jednotku {unit}</div></div></div>
        <div className="grid-2">
          <div className="stat">
            <div className="card-h"><h3>Aktuální nájem</h3>{me?.paid ? <span className="pill pill-ok">Zaplaceno</span> : <span className="pill pill-warn">Čeká</span>}</div>
            <div style={{ fontFamily: 'var(--fd)', fontSize: 30, fontWeight: 700, letterSpacing: '-.02em' }}>{me ? money(me.rent) : '-'}</div>
            <div style={{ marginTop: 12, display: 'grid', gap: 4 }}>
              <div className="doc-row"><span className="cf-ic"><Icon name="bank" small /></span><div><b>Variabilní symbol</b><span className="mono">{me?.vs}</span></div></div>
              <div className="doc-row"><span className="cf-ic"><Icon name="clock" small /></span><div><b>Splatnost</b><span>{me?.due} v měsíci</span></div></div>
            </div>
            <button className="btn btn-gold btn-sm" style={{ marginTop: 14 }} onClick={() => toast('Platba by proběhla přes platební bránu')}>Zaplatit nájem</button>
          </div>
          <div className="stat">
            <div className="card-h"><h3>Smlouva</h3></div>
            <div className="doc-row"><span className="cf-ic"><Icon name="doc" small /></span><div><b>Konec smlouvy</b><span>{me?.end || '-'}</span></div></div>
            <div className="doc-row"><span className="cf-ic"><Icon name="check" small /></span><div><b>Poslední platba</b><span>únor 2026, spárováno</span></div></div>
          </div>
        </div>
      </div>
    )
  }

  // Výbor: SVJ contributions and debtors
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
                <button className="btn btn-soft btn-sm" onClick={() => remind(u)}>Upomenout</button></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Developer and investor: portfolio with bank matching
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
                <td style={{ textAlign: 'right' }}>{!u.paid && u.tenant !== 'Volné' && <button className="btn btn-soft btn-sm" onClick={() => remind(u)}>Upomenout</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
