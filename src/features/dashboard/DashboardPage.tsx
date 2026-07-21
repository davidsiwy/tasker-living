import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../state/session'
import { api, currentPeriod, periodLabel } from '../../lib/api'
import type { Charge, Fault, VoteData, Neighbor } from '../../lib/types'
import { reminderWord } from '../../lib/types'
import { SIcon } from '../../components/AppShell'
import ResidentHome from './ResidentHome'
import { useToast } from '../../components/Toast'

const money = (n: number) => n.toLocaleString('cs-CZ') + ' Kč'
const hi = () => {
  const h = new Date().getHours()
  return h < 10 ? 'Dobré ráno' : h < 18 ? 'Dobrý den' : 'Dobrý večer'
}
const STATE: Record<string, { l: string; c: string }> = {
  paid: { l: 'Zaplaceno', c: 'ok' },
  awaiting: { l: 'Čeká', c: 'neutral' },
  unpaid: { l: 'Po splatnosti', c: 'warn' },
}

// Přehled výboru (handoff 3b): ranní kontrola domu za dvě minuty.
// Nahoře co potřebuje rozhodnutí, pod tím co běží samo.
export default function DashboardPage() {
  const { user } = useSession()
  const nav = useNavigate()
  const toast = useToast()
  const period = currentPeriod()

  const [charges, setCharges] = useState<Charge[]>([])
  const [faults, setFaults] = useState<Fault[]>([])
  const [vote, setVote] = useState<VoteData | null>(null)
  const [neighbors, setNeighbors] = useState<Neighbor[]>([])
  const [busy, setBusy] = useState(false)
  const [reminded, setReminded] = useState(false)

  useEffect(() => {
    if (!user) return
    const bid = user.buildingId
    api.getCharges(bid, period).then(setCharges).catch(() => setCharges([]))
    api.getFaults(bid).then(setFaults).catch(() => setFaults([]))
    api.getVote(bid).then(setVote).catch(() => setVote(null))
    api.getNeighbors(bid).then(setNeighbors).catch(() => setNeighbors([]))
  }, [user?.buildingId, period])

  const m = useMemo(() => {
    const total = charges.reduce((s, c) => s + c.amount, 0)
    const paid = charges.filter((c) => c.status === 'paid')
    const paidSum = paid.reduce((s, c) => s + c.amount, 0)
    const overdue = charges.filter((c) => c.status === 'unpaid')
    const pct = total ? Math.round((paidSum / total) * 100) : 0
    const open = faults.filter((f) => f.status !== 'Vyřešeno')
    const unassigned = open.filter((f) => !f.vendor)
    const units = neighbors.length
    const joined = neighbors.filter((n) => n.shares).length
    return {
      total, paidSum, pct, overdue,
      overdueSum: overdue.reduce((s, c) => s + c.amount, 0),
      open, unassigned, units, joined,
      joinedPct: units ? Math.round((joined / units) * 100) : 0,
    }
  }, [charges, faults, neighbors])

  const v = useMemo(() => {
    if (!vote || !vote.roster.length) return null
    const totalShares = vote.roster.reduce((s, r) => s + r.shares, 0) || 1
    let yes = 0, no = 0
    for (const r of vote.roster) {
      const b = vote.ballots[r.unitId]
      if (b === 'ano') yes += r.shares
      else if (b === 'ne') no += r.shares
    }
    const pct = (x: number) => Math.round((x / totalShares) * 100)
    const votedShares = vote.roster.filter((r) => vote.ballots[r.unitId]).reduce((s, r) => s + r.shares, 0)
    return {
      q: vote.q, open: vote.open,
      yes: pct(yes), no: pct(no), silent: 100 - pct(votedShares),
      quorumOk: pct(votedShares) >= (vote.quorum || 50),
      missing: vote.roster.filter((r) => !vote.ballots[r.unitId]).length,
    }
  }, [vote])

  if (!user) return null
  if (user.role === 'rezident' || user.role === 'investor') return <ResidentHome />

  async function remindAll() {
    if (busy || !m.overdue.length) return
    setBusy(true)
    try {
      for (const c of m.overdue) await api.remindCharge(c.id)
      setReminded(true)
      toast(`Upomínky odeslány (${m.overdue.length})`)
    } catch { toast('Upomínky se nepodařilo odeslat') } finally { setBusy(false) }
  }

  const first = user.name.split(' ')[0]
  const attention = m.overdue.length > 0 || (v?.open && v.missing > 0) || m.unassigned.length > 0

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>{hi()}, {first}.</h2>
          <p>
            {attention
              ? 'Tohle dnes potřebuje vaši pozornost — všechno ostatní běží samo.'
              : 'Dnes nic nečeká na rozhodnutí. Dům běží sám.'}
          </p>
        </div>
        <span className="d-live"><i className="pulse" />ŽIVĚ · {periodLabel(period).toUpperCase()}</span>
      </div>

      {/* co potřebuje rozhodnutí — každá karta má právě jednu akci */}
      <div className="d-act3">
        {m.overdue.length > 0 && (
          <div className="d-act warn-l an">
            <div className="h">
              <span className="ic w"><SIcon n="card" /></span>
              <b>{m.overdue.length} {m.overdue.length === 1 ? 'platba' : m.overdue.length < 5 ? 'platby' : 'plateb'} po splatnosti</b>
            </div>
            <p>
              {m.overdue.slice(0, 3).map((c) => c.unitLabel).join(', ')}
              {m.overdue.length > 3 ? ' a další' : ''}, celkem {money(m.overdueSum)}. Text upomínky je připravený.
            </p>
            <button className="s-btn s-primary sm" onClick={remindAll} disabled={busy || reminded}>
              {reminded ? 'Upomínky odeslány' : busy ? 'Odesílám…' : `Poslat ${m.overdue.length} ${reminderWord(m.overdue.length)}`}
            </button>
          </div>
        )}

        {v?.open && v.missing > 0 && (
          <div className="d-act purple-l an" style={{ ['--d' as string]: '.07s' }}>
            <div className="h">
              <span className="ic p"><SIcon n="vote" /></span>
              <b>Hlasování ještě běží</b>
            </div>
            <p>{v.q}: {v.yes} % pro, {v.silent} % podílů zatím nehlasovalo.</p>
            <button className="s-btn s-dark sm" onClick={() => nav('/app/schuze')}>
              Připomenout {v.missing} nehlasujícím
            </button>
          </div>
        )}

        {m.unassigned.length > 0 && (
          <div className="d-act green-l an" style={{ ['--d' as string]: '.14s' }}>
            <div className="h">
              <span className="ic g"><SIcon n="wrench" /></span>
              <b>Nová závada od {m.unassigned[0].by}</b>
            </div>
            <p>„{m.unassigned[0].desc}“ · {m.unassigned[0].loc} · {m.unassigned[0].date}. Čeká na přiřazení.</p>
            <button className="s-btn s-dark sm" onClick={() => nav('/app/zavady')}>Přiřadit dodavatele</button>
          </div>
        )}

        {!attention && (
          <div className="d-act green-l an">
            <div className="h">
              <span className="ic g"><SIcon n="vote" /></span>
              <b>Nic nečeká</b>
            </div>
            <p>Žádné platby po splatnosti, žádná nepřiřazená závada, žádné hlasování bez odezvy.</p>
          </div>
        )}
      </div>

      {/* co běží samo */}
      <div className="d-kpis">
        <div className="d-kpi an">
          <div className="k">Vybráno v {periodLabel(period).toLowerCase()}</div>
          <b className="g">{m.pct} %</b>
          <div className="bar"><i style={{ width: `${m.pct}%` }} /></div>
        </div>
        <div className="d-kpi an" style={{ ['--d' as string]: '.06s' }}>
          <div className="k">Připojené byty</div>
          <b>{m.joined} / {m.units || '—'}</b>
          <div className="bar"><i className="ink" style={{ width: `${m.joinedPct}%`, ['--d' as string]: '.1s' }} /></div>
        </div>
        <div className="d-kpi an" style={{ ['--d' as string]: '.12s' }}>
          <div className="k">Otevřené závady</div>
          <b>{m.open.length}</b>
          <span className="note">{m.unassigned.length > 0 ? `${m.unassigned.length} čeká na přiřazení` : 'všechny mají dodavatele'}</span>
        </div>
        <div className="d-kpi an" style={{ ['--d' as string]: '.18s' }}>
          <div className="k">Předpisy · {periodLabel(period)}</div>
          <b>{charges.length} / {m.units || charges.length}</b>
          <span className="note">celkem {money(m.total)}</span>
        </div>
      </div>

      <div className="d-grid">
        <div className="s-card an" style={{ overflow: 'hidden' }}>
          <div className="d-ch">
            <b>Platby · {periodLabel(period)}</b>
            <button className="d-link" onClick={() => nav('/app/najmy')}>Všechny platby →</button>
          </div>
          {charges.length === 0 && <div className="d-empty">Za toto období zatím nejsou vystavené předpisy.</div>}
          {[...charges]
            .sort((a, b) => (a.status === 'unpaid' ? -1 : 0) - (b.status === 'unpaid' ? -1 : 0))
            .slice(0, 5)
            .map((c) => (
              <div className={'d-row' + (c.status === 'unpaid' ? ' due' : '')} key={c.id}>
                <b className="u">{c.unitLabel}</b>
                <span className="what">{c.label}</span>
                <span className="amt">{money(c.amount)}</span>
                <span className={'s-badge ' + STATE[c.status].c}>{STATE[c.status].l}</span>
              </div>
            ))}
          {m.overdue.length > 0 && (
            <div className="d-foot">
              <button className="s-btn s-dark sm" onClick={remindAll} disabled={busy || reminded}>
                {reminded ? 'Odesláno' : `Poslat ${m.overdue.length} ${reminderWord(m.overdue.length)}`}
              </button>
              <span className="m">jedním klikem, text je předpřipravený</span>
            </div>
          )}
        </div>

        <div className="d-col">
          {v && (
            <div className="d-mini an">
              <div className="h">
                <b>{v.q}</b>
                <span className={'s-badge ' + (v.quorumOk ? 'ok' : 'warn')}>
                  {v.quorumOk ? 'Usnášeníschopné' : 'Zatím bez kvóra'}
                </span>
              </div>
              <div className="d-dual">
                <i style={{ width: `${v.yes}%`, background: '#06C40A' }} />
                <i style={{ width: `${v.no}%`, background: '#B26A00', ['--d' as string]: '.4s' }} />
              </div>
              <div className="d-legend">
                <span><b>{v.yes} %</b> pro</span>
                <span>{v.no} % proti</span>
                <span>{v.silent} % nehlasovalo</span>
                <span className="s-mono" style={{ marginLeft: 'auto', color: '#B26A00', fontWeight: 600, fontSize: 10 }}>
                  {v.open ? 'HLASOVÁNÍ BĚŽÍ' : 'UZAVŘENO'}
                </span>
              </div>
            </div>
          )}

          <div className="d-mini an" style={{ ['--d' as string]: '.07s' }}>
            <div className="h">
              <b>Otevřené závady</b>
              <button className="d-link" onClick={() => nav('/app/zavady')}>Vše →</button>
            </div>
            {m.open.length === 0 && <p style={{ fontSize: 12, color: '#8b93a0', marginTop: 10 }}>Žádná otevřená závada. Poslední byla vyřešena bez připomínek.</p>}
            {m.open.slice(0, 3).map((f) => (
              <div className="d-fault" key={f.id}>
                <span className="ic"><SIcon n="wrench" s={15} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{f.desc}</b>
                  <span>{f.by} · {f.date} · {f.vendor ? f.vendor : 'nepřiřazeno'}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="d-svc an" style={{ ['--d' as string]: '.14s' }}>
            <div className="h">
              <SIcon n="spark" s={15} />
              <b>Služby Tasker pro dům</b>
            </div>
            <p>Úklid společných prostor, mytí oken nebo drobná oprava od ověřeného pracovníka. Dispečink potvrdí termín.</p>
            <button className="s-btn s-primary sm" onClick={() => nav('/app/sluzby')}>Objednat za dům</button>
          </div>
        </div>
      </div>
    </>
  )
}
