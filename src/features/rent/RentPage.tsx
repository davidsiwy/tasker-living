import { useEffect, useMemo, useState } from 'react'
import { api, currentPeriod, periodLabel } from '../../lib/api'
import type { Charge, BuildingSettings, ChargeStatus } from '../../lib/types'
import { can } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { QrPlatba, PayModal } from '../../components/QrPlatba'
import type { PayItem } from '../../components/QrPlatba'

const money = (n: number) => n.toLocaleString('cs-CZ') + ' Kč'
const STATE: Record<ChargeStatus, { l: string; c: string }> = {
  paid: { l: 'Zaplaceno', c: 'ok' },
  awaiting: { l: 'Čeká', c: 'neutral' },
  unpaid: { l: 'Po splatnosti', c: 'warn' },
}
const asItem = (c: Charge): PayItem => ({
  id: c.id, label: c.label, amount: c.amount, vs: c.vs, due: c.due || '15.', recurring: true,
  msg: (c.label + ' ' + c.unitLabel).normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
})

// Platby (handoff 4b): předpisy, QR na účet domu, upomínky jedním klikem, export.
// Peníze jdou přímo domu, přes nás neprotečou — proto jen předpis a potvrzení.
export default function RentPage() {
  const { user } = useSession()
  const toast = useToast()
  const bid = user?.buildingId || ''
  const period = currentPeriod()
  const isResident = user ? can(user.role, 'own_rent') : false

  const [charges, setCharges] = useState<Charge[]>([])
  const [mine, setMine] = useState<Charge[]>([])
  const [settings, setSettings] = useState<BuildingSettings>({ account: '', recipient: '' })
  const [modal, setModal] = useState<PayItem | null>(null)
  const [filter, setFilter] = useState<'all' | ChargeStatus>('all')
  const [sel, setSel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reminded, setReminded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!bid) return
    api.getBuildingSettings(bid).then(setSettings).catch(() => {})
    if (isResident) {
      if (user?.unitId) api.getMyCharges(bid, user.unitId).then(setMine).catch(console.error)
    } else {
      api.getCharges(bid, period).then(setCharges).catch(console.error)
    }
  }, [bid, isResident, user?.unitId, period])

  const canPay = Boolean(settings.account)

  const m = useMemo(() => {
    const total = charges.reduce((s, c) => s + c.amount, 0)
    const paid = charges.filter((c) => c.status === 'paid')
    const paidSum = paid.reduce((s, c) => s + c.amount, 0)
    const overdue = charges.filter((c) => c.status === 'unpaid')
    return {
      total, paidSum, pct: total ? Math.round((paidSum / total) * 100) : 0,
      overdue, overdueSum: overdue.reduce((s, c) => s + c.amount, 0),
      awaiting: charges.filter((c) => c.status === 'awaiting'),
      paid,
    }
  }, [charges])

  const shown = useMemo(
    () => (filter === 'all' ? charges : charges.filter((c) => c.status === filter))
      .slice()
      .sort((a, b) => (b.status === 'unpaid' ? 1 : 0) - (a.status === 'unpaid' ? 1 : 0)),
    [charges, filter],
  )
  const detail = useMemo(() => charges.find((c) => c.id === sel) || null, [charges, sel])

  async function markPaid(id: string) {
    try {
      await api.setChargeStatus(id, 'awaiting')
      setMine((s) => s.map((p) => (p.id === id ? { ...p, status: 'awaiting' } : p)))
      toast('Označeno jako zaplaceno, čeká na potvrzení výboru')
    } catch (e: any) { toast(e.message || 'Nepodařilo se uložit') }
  }
  async function confirmPaid(c: Charge) {
    try {
      await api.setChargeStatus(c.id, 'paid')
      setCharges((s) => s.map((x) => (x.id === c.id ? { ...x, status: 'paid' } : x)))
      toast(`Platba ${c.unitLabel} potvrzena`)
    } catch (e: any) { toast(e.message || 'Nepodařilo se uložit') }
  }
  async function remindAll() {
    if (busy || !m.overdue.length) return
    setBusy(true)
    try {
      for (const c of m.overdue) await api.remindCharge(c.id)
      setReminded(Object.fromEntries(m.overdue.map((c) => [c.id, true])))
      toast(`Upomínky odeslány (${m.overdue.length})`)
    } catch (e: any) { toast(e.message || 'Upomínky selhaly') } finally { setBusy(false) }
  }
  async function remindOne(c: Charge) {
    try {
      const n = await api.remindCharge(c.id)
      setReminded((r) => ({ ...r, [c.id]: true }))
      toast(n > 0 ? `Upomínka odeslána (${c.unitLabel})` : `Byt ${c.unitLabel} zatím není v aplikaci — vytiskne se dopis`)
    } catch (e: any) { toast(e.message || 'Upomínka selhala') }
  }
  async function issue() {
    if (busy) return
    setBusy(true)
    try {
      const n = await api.generateCharges(bid, period)
      setCharges(await api.getCharges(bid, period))
      toast(n > 0 ? `Vystaveno ${n} předpisů` : 'Předpisy už jsou vystavené')
    } catch (e: any) { toast(e.message || 'Nepodařilo se vystavit') } finally { setBusy(false) }
  }
  function exportCsv() {
    const head = 'byt;polozka;castka;vs;splatnost;stav\n'
    const rows = charges.map((c) => [c.unitLabel, c.label, c.amount, c.vs, c.due, STATE[c.status].l].join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF' + head + rows], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `platby-${period}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast('CSV pro účetní staženo')
  }

  if (!user) return null

  // ---------- soused: jedna platba = jedna obrazovka, QR hned nahoře ----------
  if (isResident) {
    const due = mine.filter((p) => p.status !== 'paid')
    const next = due[0]
    return (
      <div className="p-grid">
        <div className="s-card an" style={{ padding: '18px 20px' }}>
          <div className="d-mini-h" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <b style={{ fontSize: 14, fontWeight: 800 }}>Vaše platby · byt {user.unit}</b>
            {due.length > 0
              ? <span className="s-badge warn">{due.length} k zaplacení</span>
              : <span className="s-badge ok">Vše uhrazeno</span>}
          </div>

          {next && canPay && (
            <div style={{ marginTop: 14 }}>
              <QrPlatba account={settings.account} amount={next.amount} vs={next.vs}
                message={asItem(next).msg} recipient={settings.recipient || user.buildingName} />
              <button className="s-btn s-primary" style={{ width: '100%', marginTop: 12 }} onClick={() => setModal(asItem(next))}>
                Otevřít v bankovní aplikaci
              </button>
              <span style={{ display: 'block', textAlign: 'center', fontSize: 11, color: 'var(--s-muted)', marginTop: 7 }}>
                platíte přímo domu — peníze nejdou přes Tasker
              </span>
            </div>
          )}

          {next && !canPay && (
            <p style={{ fontSize: 13, color: 'var(--s-ink-2)', lineHeight: 1.55, marginTop: 12 }}>
              Výbor zatím nenastavil účet domu. Po zaplacení převodem to označte tlačítkem níže a výbor platbu potvrdí.
            </p>
          )}
          {next && !canPay && (
            <button className="s-btn s-dark" style={{ width: '100%', marginTop: 12 }} onClick={() => markPaid(next.id)}>
              Zaplatil jsem
            </button>
          )}
          {!next && (
            <p style={{ fontSize: 13, color: 'var(--s-ink-2)', lineHeight: 1.55, marginTop: 12 }}>
              Nic nečeká. Až výbor vystaví další předpis, přijde vám notifikace a QR najdete tady.
            </p>
          )}
        </div>

        <div className="d-mini an" style={{ ['--d' as string]: '.07s' }}>
          <div className="h"><b>Historie</b></div>
          <div className="p-hist">
            {mine.length === 0 && <div style={{ color: 'var(--s-muted)' }}>Zatím žádné předpisy.</div>}
            {mine.map((p) => (
              <div key={p.id}>
                <span>{p.period || p.label} · {money(p.amount)}</span>
                <span className={p.status === 'paid' ? 'g' : ''}>
                  {p.status === 'paid' ? 'zaplaceno' : p.status === 'awaiting' ? 'čeká na potvrzení' : 'k zaplacení'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {canPay && (
          <PayModal item={modal} account={settings.account} recipient={settings.recipient || user.buildingName}
            onClose={() => setModal(null)} onPaid={(id) => { markPaid(id); setModal(null) }} />
        )}
      </div>
    )
  }

  // ---------- výbor: předpisy, neplatiči na jedné obrazovce ----------
  return (
    <>
      <div className="d-hi">
        <div>
          <h2>Platby · {periodLabel(period)}</h2>
          <p>Peníze jdou přímo na účet domu. Vy jen vystavíte předpis a potvrdíte, co dorazilo.</p>
        </div>
        <button className="s-btn s-primary" onClick={issue} disabled={busy}>Vystavit předpisy</button>
      </div>

      <div className="p-kpis" style={{ marginTop: 18 }}>
        <div className="d-kpi an">
          <div className="k">Vybráno v {periodLabel(period).toLowerCase()}</div>
          <b className="g">{m.pct} % · {money(m.paidSum)}</b>
          <div className="bar"><i style={{ width: `${m.pct}%` }} /></div>
        </div>
        <div className="d-kpi an" style={{ ['--d' as string]: '.07s' }}>
          <div className="k">Po splatnosti</div>
          <b style={{ color: 'var(--s-warn)' }}>{money(m.overdueSum)}</b>
          <span className="note">
            {m.overdue.length === 0 ? 'nikdo nedluží' : `${m.overdue.length} bytů · upomínky připraveny`}
          </span>
        </div>
        <div className="d-kpi an" style={{ ['--d' as string]: '.14s' }}>
          <div className="k">Předpisy · {periodLabel(period)}</div>
          <b>{charges.length}</b>
          <span className="note">celkem {money(m.total)} · {m.awaiting.length} čeká na potvrzení</span>
        </div>
      </div>

      <div className="p-grid">
        <div className="s-card an" style={{ overflow: 'hidden' }}>
          <div className="p-filters">
            {([['all', 'Vše', charges.length], ['paid', 'Zaplacené', m.paid.length],
               ['unpaid', 'Po splatnosti', m.overdue.length], ['awaiting', 'Čeká', m.awaiting.length]] as const).map(([k, l, n]) => (
              <button key={k} className={'a-chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k as any)}>
                {l} · {n}
              </button>
            ))}
            <span className="p-per">‹ {periodLabel(period)} ›</span>
          </div>

          {shown.length === 0 && (
            <div className="d-empty">
              {charges.length === 0
                ? 'Za toto období zatím nejsou vystavené předpisy. Vystavíte je tlačítkem nahoře.'
                : 'V tomto filtru nic není.'}
            </div>
          )}

          {shown.map((c) => (
            <button
              key={c.id}
              className={'p-row' + (c.status === 'unpaid' ? ' due' : '') + (sel === c.id ? ' on' : '')}
              onClick={() => setSel(sel === c.id ? null : c.id)}
            >
              <b className="u">{c.unitLabel}</b>
              <span className="what">{c.label}</span>
              <span className="amt">{money(c.amount)}</span>
              <span className={'s-badge ' + STATE[c.status].c}>{STATE[c.status].l}</span>
            </button>
          ))}

          {charges.length > 0 && (
            <div className="d-foot">
              {m.overdue.length > 0 && (
                <button className="s-btn s-dark sm" onClick={remindAll} disabled={busy}>
                  Poslat {m.overdue.length} {m.overdue.length === 1 ? 'upomínku' : 'upomínky'}
                </button>
              )}
              <button className="s-btn s-ghost sm" onClick={exportCsv}>Export pro účetní (CSV)</button>
              {m.overdue.length === 0 && <span className="m">nikdo nedluží, nic k odesílání</span>}
            </div>
          )}
        </div>

        <div className="d-col">
          {detail ? (
            <div className="d-mini an">
              <div className="h">
                <b>Byt {detail.unitLabel} · detail předpisu</b>
                <span className={'s-badge ' + STATE[detail.status].c}>{STATE[detail.status].l}</span>
              </div>
              <div className="p-det">
                <div>
                  <b className="a">{money(detail.amount)}</b>
                  <span>{detail.label} · splatnost {detail.due}</span>
                </div>
              </div>
              {canPay
                ? <div style={{ marginTop: 12 }}>
                    <QrPlatba account={settings.account} amount={detail.amount} vs={detail.vs}
                      message={asItem(detail).msg} recipient={settings.recipient || user.buildingName} />
                  </div>
                : <p style={{ fontSize: 12, color: 'var(--s-muted)', marginTop: 10 }}>Bez účtu domu nejde vygenerovat QR.</p>}
              <div className="a-acts">
                {detail.status !== 'paid' && (
                  <button className="s-btn s-dark sm" onClick={() => remindOne(detail)} disabled={reminded[detail.id]}>
                    {reminded[detail.id] ? 'Upomínka odeslána' : 'Poslat upomínku'}
                  </button>
                )}
                {detail.status !== 'paid' && (
                  <button className="s-btn s-ghost sm" onClick={() => confirmPaid(detail)}>Potvrdit platbu</button>
                )}
                {detail.status === 'paid' && <span className="a-note">Zaplaceno, nic dalšího neřešíte.</span>}
              </div>
            </div>
          ) : (
            <div className="d-mini an">
              <div className="h"><b>Detail předpisu</b></div>
              <p style={{ fontSize: 12, color: 'var(--s-muted)', marginTop: 10, lineHeight: 1.5 }}>
                Klikněte na řádek v tabulce. Uvidíte QR na účet domu, variabilní symbol a akce pro ten byt.
              </p>
            </div>
          )}

          {!canPay && (
            <div className="d-mini an" style={{ ['--d' as string]: '.07s' }}>
              <div className="h"><b>Chybí účet domu</b></div>
              <p style={{ fontSize: 12, color: 'var(--s-ink-2)', marginTop: 8, lineHeight: 1.5 }}>
                Bez čísla účtu nejde generovat QR. Doplňte ho v Nastavení domu a sousedé zaplatí naskenováním.
              </p>
            </div>
          )}

          <div className="p-soon an" style={{ ['--d' as string]: '.14s' }}>
            <b>Připravujeme:</b> automatické párování plateb z bankovního výpisu (FIO, ČS, KB).
            Do té doby platbu potvrdíte jedním klikem.
          </div>
        </div>
      </div>

      {canPay && (
        <PayModal item={modal} account={settings.account} recipient={settings.recipient || user.buildingName}
          onClose={() => setModal(null)} />
      )}
    </>
  )
}
