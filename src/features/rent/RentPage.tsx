import { useEffect, useState } from 'react'
import { api, currentPeriod, periodLabel } from '../../lib/api'
import type { Charge, UnitFull, BuildingSettings } from '../../lib/types'
import { can } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'
import { PayModal } from '../../components/QrPlatba'
import type { PayItem } from '../../components/QrPlatba'

const money = (n: number) => n.toLocaleString('cs-CZ') + ' Kč'

export default function RentPage() {
  const { user, isDemo } = useSession(); const role = user?.role
  const toast = useToast()
  const bid = user?.buildingId || ''
  const [units, setUnits] = useState<UnitFull[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [mine, setMine] = useState<Charge[]>([])
  const [settings, setSettings] = useState<BuildingSettings>({ account: '', recipient: '' })
  const [modal, setModal] = useState<PayItem | null>(null)
  const period = currentPeriod()

  const isResident = can(role!, 'own_rent')

  useEffect(() => {
    if (!bid) return
    api.getBuildingSettings(bid).then(setSettings).catch(() => {})
    if (isResident) {
      if (user?.unitId) api.getMyCharges(bid, user.unitId).then(setMine).catch((e) => console.error(e))
    } else {
      api.getUnitsFull(bid).then(setUnits).catch((e) => console.error(e))
      api.getCharges(bid, period).then(setCharges).catch((e) => console.error(e))
    }
  }, [bid, isResident, user?.unitId])

  const canPay = Boolean(settings.account)
  const asItem = (c: Charge): PayItem =>
    ({ id: c.id, label: c.label, amount: c.amount, vs: c.vs, due: c.due || '15.', recurring: true, msg: (c.label + ' ' + c.unitLabel).normalize('NFD').replace(/[\u0300-\u036f]/g, '') })

  async function markPaid(id: string) {
    try { await api.setChargeStatus(id, 'awaiting'); setMine((s) => s.map((p) => p.id === id ? { ...p, status: 'awaiting' } : p)); toast('Označeno jako zaplaceno, čeká na potvrzení správou') }
    catch (e: any) { toast(e.message || 'Nepodařilo se uložit') }
  }
  async function remind(c: Charge) {
    try { const n = await api.remindCharge(c.id); toast(n > 0 ? `Upomínka odeslána (${c.unitLabel})` : `Jednotka ${c.unitLabel} nemá v aplikaci žádného člena`) }
    catch (e: any) { toast(e.message || 'Upomínka selhala') }
  }

  // ---------- Rezident: my charges with QR ----------
  if (isResident) {
    const due = mine.filter((p) => p.status === 'unpaid')
    return (
      <div>
        <div className="view-head"><div><h1>Moje platby</h1><div className="desc">Nájem, zálohy a poplatky za jednotku {user?.unit}</div></div></div>
        <div className="grid-2">
          <div className="card">
            <div className="card-h"><h3>Předpisy</h3>{due.length > 0 ? <span className="pill pill-warn">{due.length} k zaplacení</span> : <span className="pill pill-ok">Vše uhrazeno</span>}</div>
            {mine.map((p) => (
              <div className="row-card" key={p.id} style={{ marginTop: 10 }}>
                <div className="lead-col"><b>{p.label}</b><span>{p.vs ? `VS ${p.vs} · ` : ''}{p.due ? `splatnost ${p.due}` : ''}</span></div>
                <div className="row-metrics">
                  <div className="metric"><div className="k">Částka</div><div className="val">{money(p.amount)}</div></div>
                  {p.status === 'paid'
                    ? <span className="pill pill-ok"><Icon name="check" small /> Zaplaceno</span>
                    : p.status === 'awaiting'
                      ? <span className="pill pill-warn">Čeká na potvrzení</span>
                      : canPay
                        ? <button className="btn btn-primary btn-sm" onClick={() => setModal(asItem(p))}><Icon name="bank" small /> Zaplatit</button>
                        : <button className="btn btn-soft btn-sm" onClick={() => markPaid(p.id)}>Zaplatil jsem</button>}
                </div>
              </div>
            ))}
            {mine.length === 0 && <div className="empty"><span className="cf-ic"><Icon name="bank" /></span><p>Zatím nemáte žádné předpisy plateb. Vystavuje je správa domu.</p></div>}
          </div>
          <div className="card">
            <div className="card-h"><h3>Způsob platby</h3></div>
            {canPay ? (
              <>
                <div className="doc-row"><span className="cf-ic"><Icon name="bank" small /></span><div><b>Účet domu</b><span className="mono">{settings.account}</span></div></div>
                <div className="doc-row"><span className="cf-ic"><Icon name="check" small /></span><div><b>QR platba</b><span>Naskenujte kód v detailu předpisu bankovní aplikací</span></div></div>
                <div className="doc-row"><span className="cf-ic"><Icon name="doc" small /></span><div><b>Trvalý příkaz</b><span>Nastavte podle částky a VS předpisu</span></div></div>
              </>
            ) : (
              <p style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>Správa domu zatím nenastavila bankovní účet pro platby. Po zaplacení převodem označte předpis tlačítkem Zaplatil jsem a správa platbu potvrdí.</p>
            )}
          </div>
        </div>
        {canPay && <PayModal item={modal} account={settings.account} recipient={settings.recipient || user?.buildingName || ''} onClose={() => setModal(null)} onPaid={(id) => { markPaid(id); setModal(null) }} />}
      </div>
    )
  }

  // ---------- Výbor, developer a investor: units + charges for the month ----------
  const byUnit: Record<string, Charge[]> = {}
  for (const c of charges) { if (!byUnit[c.unitId]) byUnit[c.unitId] = []; byUnit[c.unitId].push(c) }
  const occupied = units.filter((u) => u.tenant)
  const withCharge = charges.length
  const paidSum = charges.filter((c) => c.status === 'paid').reduce((s, c) => s + c.amount, 0)
  const totalSum = charges.reduce((s, c) => s + c.amount, 0)
  const unpaid = charges.filter((c) => c.status !== 'paid')
  const soon = (d: string) => { if (!d) return false; const [dd, mm, yy] = d.split('. ').map((x) => parseInt(x)); if (!dd || !mm || !yy) return false; const dt = new Date(yy, mm - 1, dd); return dt.getTime() - Date.now() < 60 * 86400000 && dt.getTime() > Date.now() }
  const ending = units.filter((u) => soon(u.leaseEnd))

  return (
    <div>
      <div className="view-head">
        <div><h1>Nájmy a platby</h1><div className="desc">Předpisy za {periodLabel(period)} a stav úhrad</div></div>
        {isDemo && <span className="pill pill-ok"><Icon name="bank" small /> Ukázková data</span>}
      </div>
      <div className="grid-4">
        <div className="stat"><div className="l"><Icon name="nastenka" small /> Obsazenost</div><div className="v">{occupied.length}/{units.length}</div></div>
        <div className="stat"><div className="l"><Icon name="bank" small /> Předpis {periodLabel(period)}</div><div className="v">{money(totalSum)}</div></div>
        <div className="stat"><div className="l"><Icon name="check" small /> Uhrazeno</div><div className="v">{totalSum ? Math.round(paidSum / totalSum * 100) : 0} %</div></div>
        <div className="stat"><div className="l"><Icon name="clock" small /> Končící smlouvy</div><div className="v">{ending.length}</div></div>
      </div>
      <div className="stat" style={{ marginTop: 16, overflowX: 'auto' }}>
        <div className="card-h"><h3>Jednotky a předpisy</h3><span className="sub">{withCharge ? `${withCharge} předpisů` : 'předpisy vystavuje Správa, záložka Finance'}</span></div>
        <table className="tbl">
          <thead><tr><th>Jednotka</th><th>Nájemník</th><th>Nájem</th><th>VS</th><th>Stav</th><th>Konec smlouvy</th><th></th></tr></thead>
          <tbody>
            {units.map((u) => {
              const cs = byUnit[u.id] || []
              const paid = cs.length > 0 && cs.every((c) => c.status === 'paid')
              const awaiting = cs.some((c) => c.status === 'awaiting')
              return (
                <tr key={u.id}>
                  <td className="mono">{u.label}</td>
                  <td>{u.tenant || <span style={{ color: 'var(--ink-3)' }}>Volné</span>}</td>
                  <td>{u.rent ? money(u.rent) : ''}</td>
                  <td className="mono">{u.vs}</td>
                  <td>{!u.tenant ? <span className="pill pill-neutral">Volné</span> : cs.length === 0 ? <span className="pill pill-neutral">Bez předpisu</span> : paid ? <span className="pill pill-ok">Zaplaceno</span> : awaiting ? <span className="pill pill-warn">Čeká na potvrzení</span> : <span className="pill pill-bad">Nezaplaceno</span>}</td>
                  <td>{u.leaseEnd || ''}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {canPay && cs[0] && cs[0].status !== 'paid' && <button className="btn btn-ghost btn-sm" onClick={() => setModal(asItem(cs[0]))}>QR</button>}
                    {cs[0] && cs[0].status !== 'paid' && <button className="btn btn-soft btn-sm" style={{ marginLeft: 6 }} onClick={() => remind(cs[0])}>Upomenout</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {unpaid.length > 0 && <p className="adm-mini" style={{ marginTop: 10 }}>Neuhrazeno {unpaid.length} předpisů za {money(unpaid.reduce((s, c) => s + c.amount, 0))}. Potvrzování plateb najdete ve Správě, záložka Finance.</p>}
      </div>
      {canPay && <PayModal item={modal} account={settings.account} recipient={settings.recipient || user?.buildingName || ''} onClose={() => setModal(null)} />}
    </div>
  )
}
