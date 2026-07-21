import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bank } from '../../lib/bank'
import { api, currentPeriod, periodLabel } from '../../lib/api'
import type { Charge, BuildingSettings, ChargeStatus } from '../../lib/types'
import { can, chargeStatusLabel } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { QrPlatba, PayModal } from '../../components/QrPlatba'
import type { PayItem } from '../../components/QrPlatba'

const asItem = (c: Charge): PayItem => ({
  id: c.id, label: c.label, amount: c.amount, vs: c.vs, due: c.due || '15.', recurring: true,
  msg: (c.label + ' ' + c.unitLabel).normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
})

// Platby (handoff 4b): předpisy, QR na účet domu, upomínky jedním klikem, export.
// Peníze jdou přímo domu, přes nás neprotečou — proto jen předpis a potvrzení.
export default function RentPage() {
  const { t, i18n } = useTranslation(['rent', 'dashboard', 'common'])
  const money = (n: number) => n.toLocaleString(i18n.language) + ' Kč'
  const STATE: Record<ChargeStatus, { l: string; c: string }> = {
    paid: { l: chargeStatusLabel('paid', t), c: 'ok' },
    awaiting: { l: chargeStatusLabel('awaiting', t), c: 'neutral' },
    unpaid: { l: chargeStatusLabel('unpaid', t), c: 'warn' },
  }
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

  useEffect(() => {
    // tiché dopárování z banky při otevření Plateb (výbor/developer, max 1x za 15 min)
    if (!bank.available || !bid || isResident) return
    const key = 'tl-banksync-' + bid
    if (Date.now() - Number(sessionStorage.getItem(key) || 0) < 15 * 60e3) return
    sessionStorage.setItem(key, String(Date.now()))
    bank.status(bid).then((st) => {
      if (!st?.enabled) return
      bank.syncNow(bid).then((r) => {
        if (r.matched > 0) { toast(t('rent:toastBankMatched', { count: r.matched })); api.getCharges(bid, period).then(setCharges).catch(() => {}) }
      }).catch(() => {})
    }).catch(() => {})
  }, [bid, isResident])

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
      toast(t('rent:toastMarkedPaid'))
    } catch (e: any) { toast(e.message || t('rent:toastSaveFailed')) }
  }
  async function confirmPaid(c: Charge) {
    try {
      await api.setChargeStatus(c.id, 'paid')
      setCharges((s) => s.map((x) => (x.id === c.id ? { ...x, status: 'paid' } : x)))
      toast(t('rent:toastPaymentConfirmed', { unit: c.unitLabel }))
    } catch (e: any) { toast(e.message || t('rent:toastSaveFailed')) }
  }
  async function remindAll() {
    if (busy || !m.overdue.length) return
    setBusy(true)
    try {
      for (const c of m.overdue) await api.remindCharge(c.id)
      setReminded(Object.fromEntries(m.overdue.map((c) => [c.id, true])))
      toast(t('rent:toastRemindersSent', { count: m.overdue.length }))
    } catch (e: any) { toast(e.message || t('rent:toastRemindersFailed')) } finally { setBusy(false) }
  }
  async function remindOne(c: Charge) {
    try {
      const n = await api.remindCharge(c.id)
      setReminded((r) => ({ ...r, [c.id]: true }))
      toast(n > 0 ? t('rent:toastReminderSentFor', { unit: c.unitLabel }) : t('rent:toastReminderNoApp', { unit: c.unitLabel }))
    } catch (e: any) { toast(e.message || t('rent:toastReminderFailed')) }
  }
  async function issue() {
    if (busy) return
    setBusy(true)
    try {
      const n = await api.generateCharges(bid, period)
      setCharges(await api.getCharges(bid, period))
      toast(n > 0 ? t('rent:toastIssuedCount', { count: n }) : t('rent:toastAlreadyIssued'))
    } catch (e: any) { toast(e.message || t('rent:toastIssueFailed')) } finally { setBusy(false) }
  }
  function exportCsv() {
    const head = 'byt;polozka;castka;vs;splatnost;stav\n'
    const rows = charges.map((c) => [c.unitLabel, c.label, c.amount, c.vs, c.due, STATE[c.status].l].join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF' + head + rows], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `platby-${period}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast(t('rent:toastCsvDownloaded'))
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
            <b style={{ fontSize: 14, fontWeight: 800 }}>{t('rent:resident.yourPayments', { unit: user.unit })}</b>
            {due.length > 0
              ? <span className="s-badge warn">{t('rent:resident.toPay', { count: due.length })}</span>
              : <span className="s-badge ok">{t('rent:resident.allPaid')}</span>}
          </div>

          {next && canPay && (
            <div style={{ marginTop: 14 }}>
              <QrPlatba account={settings.account} amount={next.amount} vs={next.vs}
                message={asItem(next).msg} recipient={settings.recipient || user.buildingName} />
              <button className="s-btn s-primary" style={{ width: '100%', marginTop: 12 }} onClick={() => setModal(asItem(next))}>
                {t('rent:resident.openInBank')}
              </button>
              <span style={{ display: 'block', textAlign: 'center', fontSize: 11, color: 'var(--s-muted)', marginTop: 7 }}>
                {t('rent:resident.payDirect')}
              </span>
            </div>
          )}

          {next && !canPay && (
            <p style={{ fontSize: 13, color: 'var(--s-ink-2)', lineHeight: 1.55, marginTop: 12 }}>
              {t('rent:resident.noAccountYet')}
            </p>
          )}
          {next && !canPay && (
            <button className="s-btn s-dark" style={{ width: '100%', marginTop: 12 }} onClick={() => markPaid(next.id)}>
              {t('rent:resident.iPaid')}
            </button>
          )}
          {!next && (
            <p style={{ fontSize: 13, color: 'var(--s-ink-2)', lineHeight: 1.55, marginTop: 12 }}>
              {t('rent:resident.nothingDue')}
            </p>
          )}
        </div>

        <div className="d-mini an" style={{ ['--d' as string]: '.07s' }}>
          <div className="h"><b>{t('rent:resident.history')}</b></div>
          <div className="p-hist">
            {mine.length === 0 && <div style={{ color: 'var(--s-muted)' }}>{t('rent:resident.noChargesYet')}</div>}
            {mine.map((p) => (
              <div key={p.id}>
                <span>{p.period || p.label} · {money(p.amount)}</span>
                <span className={p.status === 'paid' ? 'g' : ''}>
                  {p.status === 'paid' ? t('rent:resident.histPaid') : p.status === 'awaiting' ? t('rent:resident.histAwaiting') : t('rent:resident.histToPay')}
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
          <h2>{t('rent:committee.title', { period: periodLabel(period, i18n.language) })}</h2>
          <p>{t('rent:committee.subtitle')}</p>
        </div>
        <button className="s-btn s-primary" onClick={issue} disabled={busy}>{t('rent:committee.issue')}</button>
      </div>

      <div className="p-kpis" style={{ marginTop: 18 }}>
        <div className="d-kpi an">
          <div className="k">{t('rent:committee.collectedIn', { period: periodLabel(period, i18n.language) })}</div>
          <b className="g">{m.pct} % · {money(m.paidSum)}</b>
          <div className="bar"><i style={{ width: `${m.pct}%` }} /></div>
        </div>
        <div className="d-kpi an" style={{ ['--d' as string]: '.07s' }}>
          <div className="k">{t('rent:committee.overdueLabel')}</div>
          <b style={{ color: 'var(--s-warn)' }}>{money(m.overdueSum)}</b>
          <span className="note">
            {m.overdue.length === 0 ? t('rent:committee.noOneOwes') : t('rent:committee.unitsReady', { units: t('common:units.unit', { count: m.overdue.length }) })}
          </span>
        </div>
        <div className="d-kpi an" style={{ ['--d' as string]: '.14s' }}>
          <div className="k">{t('rent:committee.chargesFor', { period: periodLabel(period, i18n.language) })}</div>
          <b>{charges.length}</b>
          <span className="note">{t('rent:committee.totalAwaiting', { sum: money(m.total), count: m.awaiting.length })}</span>
        </div>
      </div>

      <div className="p-grid">
        <div className="s-card an" style={{ overflow: 'hidden' }}>
          <div className="p-filters">
            {([['all', t('rent:committee.filterAll'), charges.length], ['paid', t('rent:committee.filterPaid'), m.paid.length],
               ['unpaid', t('rent:committee.filterUnpaid'), m.overdue.length], ['awaiting', t('rent:committee.filterAwaiting'), m.awaiting.length]] as const).map(([k, l, n]) => (
              <button key={k} className={'a-chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k as any)}>
                {l} · {n}
              </button>
            ))}
            <span className="p-per">‹ {periodLabel(period, i18n.language)} ›</span>
          </div>

          {shown.length === 0 && (
            <div className="d-empty">
              {charges.length === 0 ? t('rent:committee.emptyNoCharges') : t('rent:committee.emptyFiltered')}
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
                  {t('dashboard:committee.sendReminders', { count: m.overdue.length })}
                </button>
              )}
              <button className="s-btn s-ghost sm" onClick={exportCsv}>{t('rent:committee.exportCsv')}</button>
              {m.overdue.length === 0 && <span className="m">{t('rent:committee.nothingToSend')}</span>}
            </div>
          )}
        </div>

        <div className="d-col">
          {detail ? (
            <div className="d-mini an">
              <div className="h">
                <b>{t('rent:committee.detail.unitDetail', { unit: detail.unitLabel })}</b>
                <span className={'s-badge ' + STATE[detail.status].c}>{STATE[detail.status].l}</span>
              </div>
              <div className="p-det">
                <div>
                  <b className="a">{money(detail.amount)}</b>
                  <span>{detail.label} · {t('rent:committee.detail.dueLabel', { due: detail.due })}</span>
                </div>
              </div>
              {canPay
                ? <div style={{ marginTop: 12 }}>
                    <QrPlatba account={settings.account} amount={detail.amount} vs={detail.vs}
                      message={asItem(detail).msg} recipient={settings.recipient || user.buildingName} />
                  </div>
                : <p style={{ fontSize: 12, color: 'var(--s-muted)', marginTop: 10 }}>{t('rent:committee.detail.noQr')}</p>}
              <div className="a-acts">
                {detail.status !== 'paid' && (
                  <button className="s-btn s-dark sm" onClick={() => remindOne(detail)} disabled={reminded[detail.id]}>
                    {reminded[detail.id] ? t('rent:committee.detail.reminderSent') : t('rent:committee.detail.sendReminder')}
                  </button>
                )}
                {detail.status !== 'paid' && (
                  <button className="s-btn s-ghost sm" onClick={() => confirmPaid(detail)}>{t('rent:committee.detail.confirmPayment')}</button>
                )}
                {detail.status === 'paid' && <span className="a-note">{t('rent:committee.detail.paidNote')}</span>}
              </div>
            </div>
          ) : (
            <div className="d-mini an">
              <div className="h"><b>{t('rent:committee.detail.title')}</b></div>
              <p style={{ fontSize: 12, color: 'var(--s-muted)', marginTop: 10, lineHeight: 1.5 }}>
                {t('rent:committee.detail.clickHint')}
              </p>
            </div>
          )}

          {!canPay && (
            <div className="d-mini an" style={{ ['--d' as string]: '.07s' }}>
              <div className="h"><b>{t('rent:committee.missingAccount.title')}</b></div>
              <p style={{ fontSize: 12, color: 'var(--s-ink-2)', marginTop: 8, lineHeight: 1.5 }}>
                {t('rent:committee.missingAccount.body')}
              </p>
            </div>
          )}

          <div className="p-soon an" style={{ ['--d' as string]: '.14s' }}>
            {t('rent:committee.bankSync')}
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
