import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { feed, api } from '../../lib/api'
import type { Charge, Fault, VoteData, FeedPost, ReserveFund } from '../../lib/types'
import { useSession } from '../../state/session'
import { QrPlatba, PayModal } from '../../components/QrPlatba'
import type { PayItem } from '../../components/QrPlatba'
import { SIcon } from '../../components/AppShell'

const money = (n: number, lng: string) => n.toLocaleString(lng) + ' Kč'
const when = (iso: string, t: (k: string, o?: Record<string, unknown>) => string, lng: string) => {
  const d = new Date(iso); const s = (Date.now() - d.getTime()) / 1000
  if (s < 3600) return t('common:time.minutesAgo', { count: Math.max(1, Math.floor(s / 60)) })
  if (s < 86400) return t('common:time.today')
  return d.toLocaleDateString(lng, { day: 'numeric', month: 'numeric' })
}

// Portál rezidenta (handoff 9b): domov v kapse. Nahoře co mám udělat (zaplatit),
// pod tím co se v domě děje. Žádná konzole, žádné cizí byty.
export default function ResidentHome() {
  const { t, i18n } = useTranslation(['dashboard', 'common'])
  const { user } = useSession()
  const nav = useNavigate()

  const [charges, setCharges] = useState<Charge[]>([])
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [faults, setFaults] = useState<Fault[]>([])
  const [vote, setVote] = useState<VoteData | null>(null)
  const [fund, setFund] = useState<ReserveFund | null>(null)
  const [settings, setSettings] = useState({ account: '', recipient: '' })
  const [modal, setModal] = useState<PayItem | null>(null)

  useEffect(() => {
    if (!user) return
    const bid = user.buildingId
    if (user.unitId) api.getMyCharges(bid, user.unitId).then(setCharges).catch(() => {})
    feed.list(bid).then(setPosts).catch(() => {})
    api.getFaults(bid).then(setFaults).catch(() => {})
    api.getVote(bid).then(setVote).catch(() => {})
    api.getBuildingSettings(bid).then(setSettings).catch(() => {})
    api.getReserveFund(bid).then((f) => setFund(f.visible ? f : null)).catch(() => setFund(null))
  }, [user?.buildingId, user?.unitId])

  const next = useMemo(() => charges.find((c) => c.status !== 'paid') || null, [charges])
  const myFaults = useMemo(
    () => faults.filter((f) => f.by === user?.unit && f.status !== 'Vyřešeno').length,
    [faults, user?.unit],
  )
  const canPay = Boolean(settings.account) && next
  const item: PayItem | null = next
    ? { id: next.id, label: next.label, amount: next.amount, vs: next.vs, due: next.due || '15.', recurring: true,
        msg: (next.label + " " + next.unitLabel).normalize('NFD').replace(/[\u0300-\u036f]/g, '') }
    : null

  if (!user) return null
  const hour = new Date().getHours()
  const hi = hour < 10 ? t('dashboard:greeting.morning') : hour < 18 ? t('dashboard:greeting.day') : t('dashboard:greeting.evening')

  return (
    <>
      <div className="r-hi">
        <h2>{hi}, {user.name.split(' ')[0]}.</h2>
        <p>{t('dashboard:resident.greetingLine', { building: user.buildingName, unit: user.unit })}</p>
      </div>

      <div className="r-grid">
        {/* platba — jediná věc, co má soused „udělat" */}
        {next ? (
          <div className="r-pay an">
            <div className="k">{t('dashboard:resident.rentLabel', { label: next.label })}</div>
            <b className="a">{money(next.amount, i18n.language)}</b>
            <div className="due">{t('dashboard:resident.dueOn', { due: next.due || '15. v měsíci' })}</div>
            {canPay ? (
              <>
                <div className="r-qr"><QrPlatba account={settings.account} amount={next.amount} vs={next.vs} message={item!.msg} recipient={settings.recipient || user.buildingName} /></div>
                <button className="s-btn s-primary" onClick={() => setModal(item)}>{t('dashboard:resident.openInBank')}</button>
                <div className="foot">{t('dashboard:resident.footDirect')}</div>
              </>
            ) : (
              <>
                <button className="s-btn s-primary" onClick={() => nav('/app/najmy')}>{t('dashboard:resident.showPayment')}</button>
                <div className="foot">{t('dashboard:resident.footNoQr')}</div>
              </>
            )}
          </div>
        ) : (
          <div className="r-pay ok an">
            <div className="k">{t('dashboard:resident.paymentsTitle')}</div>
            <b className="a">{t('dashboard:resident.allPaid')}</b>
            <div className="due" style={{ color: 'var(--s-green-txt)' }}>{t('dashboard:resident.nothingDue')}</div>
            <button className="s-btn s-ghost" style={{ marginTop: 14, width: '100%' }} onClick={() => nav('/app/najmy')}>{t('dashboard:resident.paymentHistory')}</button>
          </div>
        )}

        <button className="r-tile an" style={{ ['--d' as string]: '.06s' }} onClick={() => nav('/app/zavady')}>
          <div className="th">
            <span className="ic"><SIcon n="wrench" s={16} /></span>
            <b>{t('dashboard:resident.reportFault')}</b>
            {myFaults > 0 && <span className="n">{t('dashboard:resident.faultsInProgress', { count: myFaults })}</span>}
          </div>
          <p>{myFaults > 0 ? t('dashboard:resident.faultTrack') : t('dashboard:resident.faultNew')}</p>
        </button>

        <button className="r-tile an" style={{ ['--d' as string]: '.12s' }} onClick={() => nav('/app/sluzby')}>
          <div className="th">
            <span className="ic"><SIcon n="spark" s={16} /></span>
            <b>{t('dashboard:resident.tasker')}</b>
          </div>
          <p>{t('dashboard:resident.taskerBody')}</p>
        </button>

        {fund && (
          <div className="r-tile r-fund an" style={{ ['--d' as string]: '.09s' }}>
            <div className="th">
              <span className="ic" style={{ background: 'var(--s-green-050)', color: 'var(--s-green-ink)' }}><SIcon n="fund" s={16} /></span>
              <b>{t('dashboard:resident.fundTitle')}</b>
            </div>
            <div className="r-fund-bal">{money(fund.balance, i18n.language)}</div>
            {fund.target ? (
              <>
                <div className="bar" style={{ marginTop: 8 }}>
                  <i style={{ width: `${Math.max(0, Math.min(100, Math.round((fund.balance / fund.target) * 100)))}%` }} />
                </div>
                <p>{t('dashboard:resident.fundOfTarget', { pct: Math.round((fund.balance / fund.target) * 100), target: money(fund.target, i18n.language) })}</p>
              </>
            ) : (
              <p>{t('dashboard:resident.fundNoTarget')}</p>
            )}
            {fund.entries[0] && (
              <div className="r-fund-last">
                <span>{fund.entries[0].note}</span>
                <b style={{ color: fund.entries[0].amount >= 0 ? 'var(--s-green-ink)' : 'var(--s-warn)' }}>
                  {fund.entries[0].amount >= 0 ? '+' : ''}{money(fund.entries[0].amount, i18n.language)}
                </b>
              </div>
            )}
          </div>
        )}

        {vote?.open && (
          <button className="r-tile an" style={{ ['--d' as string]: '.16s', gridColumn: '1 / -1' }} onClick={() => nav('/app/schuze')}>
            <div className="th">
              <span className="ic" style={{ background: 'var(--s-purple-050)', color: 'var(--s-purple)' }}><SIcon n="vote" s={16} /></span>
              <b>{t('dashboard:resident.voteOpenTitle')}</b>
              <span className="n" style={{ background: 'var(--s-purple-050)', color: 'var(--s-purple)' }}>{t('dashboard:resident.voteOpenTag')}</span>
            </div>
            <p>{user.role === 'rezident' ? t('dashboard:resident.voteBodyResident', { q: vote.q }) : t('dashboard:resident.voteBodyOther', { q: vote.q })}</p>
          </button>
        )}

        <div className="r-latest an" style={{ gridColumn: '1 / -1', ['--d' as string]: '.2s' }}>
          <div className="h">
            <SIcon n="bell" s={15} />
            <b>{t('dashboard:resident.fromBuilding')}</b>
            <button className="d-link" style={{ marginLeft: 'auto' }} onClick={() => nav('/app/nastenka')}>{t('dashboard:resident.seeAll')}</button>
          </div>
          {posts.length === 0 && <p style={{ fontSize: 12, color: 'var(--s-muted)', marginTop: 10 }}>{t('dashboard:resident.noAnnouncements')}</p>}
          {posts.slice(0, 3).map((p) => (
            <div className="r-post" key={p.id}>
              <b>{p.title || p.body.slice(0, 60)}</b>
              <span>{when(p.createdAt, t, i18n.language)} · {p.authorName}</span>
            </div>
          ))}
        </div>
      </div>

      {canPay && (
        <PayModal item={modal} account={settings.account} recipient={settings.recipient || user.buildingName}
          onClose={() => setModal(null)}
          onPaid={async (id) => { try { await api.setChargeStatus(id, 'awaiting'); setCharges((s) => s.map((c) => c.id === id ? { ...c, status: 'awaiting' } : c)) } catch { /* necháme na stránce Platby */ } setModal(null) }} />
      )}
    </>
  )
}
