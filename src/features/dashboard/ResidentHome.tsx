import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { feed, api } from '../../lib/api'
import type { Charge, Fault, VoteData, FeedPost } from '../../lib/types'
import { useSession } from '../../state/session'
import { QrPlatba, PayModal } from '../../components/QrPlatba'
import type { PayItem } from '../../components/QrPlatba'
import { SIcon } from '../../components/AppShell'

const money = (n: number) => n.toLocaleString('cs-CZ') + ' Kč'
const hi = () => { const h = new Date().getHours(); return h < 10 ? 'Dobré ráno' : h < 18 ? 'Dobrý den' : 'Dobrý večer' }
const when = (iso: string) => {
  const d = new Date(iso); const s = (Date.now() - d.getTime()) / 1000
  if (s < 3600) return 'před ' + Math.max(1, Math.floor(s / 60)) + ' min'
  if (s < 86400) return 'dnes'
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
}

// Portál rezidenta (handoff 9b): domov v kapse. Nahoře co mám udělat (zaplatit),
// pod tím co se v domě děje. Žádná konzole, žádné cizí byty.
export default function ResidentHome() {
  const { user } = useSession()
  const nav = useNavigate()

  const [charges, setCharges] = useState<Charge[]>([])
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [faults, setFaults] = useState<Fault[]>([])
  const [vote, setVote] = useState<VoteData | null>(null)
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

  return (
    <>
      <div className="r-hi">
        <h2>{hi()}, {user.name.split(' ')[0]}.</h2>
        <p>{user.buildingName} · byt {user.unit}</p>
      </div>

      <div className="r-grid">
        {/* platba — jediná věc, co má soused „udělat" */}
        {next ? (
          <div className="r-pay an">
            <div className="k">Nájem a zálohy · {next.label}</div>
            <b className="a">{money(next.amount)}</b>
            <div className="due">splatnost {next.due || '15. v měsíci'}</div>
            {canPay ? (
              <>
                <div className="r-qr"><QrPlatba account={settings.account} amount={next.amount} vs={next.vs} message={item!.msg} recipient={settings.recipient || user.buildingName} /></div>
                <button className="s-btn s-primary" onClick={() => setModal(item)}>Otevřít v bance</button>
                <div className="foot">platíte přímo domu — peníze nejdou přes Tasker</div>
              </>
            ) : (
              <>
                <button className="s-btn s-primary" onClick={() => nav('/app/najmy')}>Zobrazit platbu</button>
                <div className="foot">dům zatím nemá QR, zaplatíte převodem</div>
              </>
            )}
          </div>
        ) : (
          <div className="r-pay ok an">
            <div className="k">Platby</div>
            <b className="a">Vše uhrazeno</b>
            <div className="due" style={{ color: 'var(--s-green-txt)' }}>nic nečeká, díky</div>
            <button className="s-btn s-ghost" style={{ marginTop: 14, width: '100%' }} onClick={() => nav('/app/najmy')}>Historie plateb</button>
          </div>
        )}

        <button className="r-tile an" style={{ ['--d' as string]: '.06s' }} onClick={() => nav('/app/zavady')}>
          <div className="th">
            <span className="ic"><SIcon n="wrench" s={16} /></span>
            <b>Nahlásit závadu</b>
            {myFaults > 0 && <span className="n">{myFaults} v řešení</span>}
          </div>
          <p>{myFaults > 0 ? 'Sledujte průběh svých nahlášených závad.' : 'Vyfoťte a odešlete. Výbor přiřadí, vy vidíte průběh.'}</p>
        </button>

        <button className="r-tile an" style={{ ['--d' as string]: '.12s' }} onClick={() => nav('/app/sluzby')}>
          <div className="th">
            <span className="ic"><SIcon n="spark" s={16} /></span>
            <b>Služby Tasker</b>
          </div>
          <p>Úklid, drobná oprava nebo mytí oken od ověřeného pracovníka na pár kliknutí.</p>
        </button>

        {vote?.open && (
          <button className="r-tile an" style={{ ['--d' as string]: '.16s', gridColumn: '1 / -1' }} onClick={() => nav('/app/schuze')}>
            <div className="th">
              <span className="ic" style={{ background: 'var(--s-purple-050)', color: 'var(--s-purple)' }}><SIcon n="vote" s={16} /></span>
              <b>Probíhá hlasování</b>
              <span className="n" style={{ background: 'var(--s-purple-050)', color: 'var(--s-purple)' }}>otevřené</span>
            </div>
            <p>{vote.q} — {user.role === 'rezident' ? 'výsledek uvidíte, hlas patří vlastníkovi bytu.' : 'odhlasujte z telefonu.'}</p>
          </button>
        )}

        <div className="r-latest an" style={{ gridColumn: '1 / -1', ['--d' as string]: '.2s' }}>
          <div className="h">
            <SIcon n="bell" s={15} />
            <b>Z domu</b>
            <button className="d-link" style={{ marginLeft: 'auto' }} onClick={() => nav('/app/nastenka')}>Vše →</button>
          </div>
          {posts.length === 0 && <p style={{ fontSize: 12, color: 'var(--s-muted)', marginTop: 10 }}>Zatím žádná oznámení.</p>}
          {posts.slice(0, 3).map((p) => (
            <div className="r-post" key={p.id}>
              <b>{p.title || p.body.slice(0, 60)}</b>
              <span>{when(p.createdAt)} · {p.authorName}</span>
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
