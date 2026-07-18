import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { Neighbor } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { SIcon } from '../../components/AppShell'
import { dm, type DM } from '../../lib/dm'

const ini = (name: string) => name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()

// Sousedé (handoff 4f): adresář domu. Viditelnost telefonu je dobrovolná,
// napsat můžete komukoli i bez zveřejněného čísla — zprávy vidí jen vy dva.
export default function ContactsPage() {
  const { user, isDemo } = useSession()
  const toast = useToast()
  const bid = user?.buildingId || ''

  const [list, setList] = useState<Neighbor[]>([])
  const [meShares, setMeShares] = useState(false)
  const [chatWith, setChatWith] = useState<Neighbor | null>(null)
  const [msgs, setMsgs] = useState<DM[]>([])
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const unsub = useRef<() => void>(() => {})

  const reload = async () => {
    if (!bid) return
    const [ns, prof] = await Promise.all([api.getNeighbors(bid), api.getMyProfile()])
    setList(ns); setMeShares(prof.shareContact)
  }
  useEffect(() => { reload().catch(console.error) }, [bid])
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }, [msgs, chatWith])
  useEffect(() => () => unsub.current(), [])

  async function toggleMe() {
    try {
      await api.saveMyProfile({ shareContact: !meShares })
      setMeShares(!meShares)
      toast(meShares ? 'Váš telefon je teď skrytý' : 'Sousedé teď vidí vaše číslo')
      reload()
    } catch (e: any) { toast(e.message || 'Uložení selhalo') }
  }
  async function openChat(n: Neighbor) {
    setChatWith(n); setText('')
    const otherId = n.userId || n.unit
    setMsgs(await dm.thread(otherId, n.name.split(' ')[0]))
    unsub.current()
    if (user) unsub.current = dm.subscribe(user.userId, otherId, (m) => setMsgs((s) => (s.some((x) => x.id === m.id) ? s : [...s, m])))
  }
  function closeChat() { unsub.current(); unsub.current = () => {}; setChatWith(null) }
  async function send() {
    const t = text.trim(); if (!t || !chatWith) return
    setText('')
    try { const m = await dm.send(bid, chatWith.userId || chatWith.unit, t); setMsgs((s) => [...s, m]) }
    catch (e: any) { toast(e.message || 'Odeslání selhalo') }
  }
  function call(n: Neighbor) { if (n.phone) window.location.href = 'tel:' + n.phone.replace(/\s/g, '') }

  if (!user) return null
  const others = list.filter((n) => n.userId !== user.userId)
  const isMinority = user.role === 'developer' || user.role === 'investor'
  const sharing = others.filter((n) => n.shares).length

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>Sousedé</h2>
          <p>Adresář domu. Telefon sdílíte, jen když chcete — napsat můžete komukoli.</p>
        </div>
        <span className="d-live"><i style={{ background: 'var(--s-green)' }} />{others.length} sousedů · {sharing} sdílí číslo</span>
      </div>

      {!isMinority && (
        <div className="n-me an">
          <span className="ic"><SIcon n="people" /></span>
          <div style={{ flex: 1 }}>
            <b>Moje viditelnost v adresáři</b>
            <span>{meShares ? 'sousedé vidí vaše jméno a telefon' : 'vaše číslo je skryté, zprávy vám přijít můžou'}</span>
          </div>
          <button className={'a-tog' + (meShares ? ' on' : '')} onClick={toggleMe} aria-pressed={meShares} aria-label="Viditelnost" />
        </div>
      )}

      <div className="n-grid">
        {others.map((n, i) => (
          <div className="n-card an" key={n.userId || n.name} style={{ ['--d' as string]: `${Math.min(i, 8) * 0.04}s` }}>
            <span className="n-ava">{ini(n.name)}</span>
            <div style={{ minWidth: 0 }}>
              <b>{n.name}</b>
              <span className="u">{n.unit}{n.floor ? ' · ' + n.floor : ''}</span>
            </div>
            <div className="n-act">
              {n.shares && n.phone
                ? <button className="n-ib" onClick={() => call(n)} aria-label="Volat"><SIcon n="card" s={15} /></button>
                : <span className="n-hidden">skryto</span>}
              <button className="n-ib" onClick={() => openChat(n)} aria-label="Napsat"><SIcon n="bell" s={15} /></button>
            </div>
          </div>
        ))}
      </div>
      {others.length === 0 && (
        <div className="d-empty" style={{ background: '#fff', border: '1px solid var(--s-line)', borderRadius: 14, marginTop: 14 }}>
          Zatím tu kromě vás nikdo není. Sousedé se objeví, jakmile se připojí přístupovým kódem ke svému bytu.
        </div>
      )}

      {chatWith && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) closeChat() }}>
          <div className="modal">
            <div className="modal-h">
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span className="n-ava" style={{ width: 38, height: 38, fontSize: 12.5 }}>{ini(chatWith.name)}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15 }}>{chatWith.name}</h3>
                  <span className="s-mono" style={{ fontSize: 11, color: 'var(--s-muted)' }}>{chatWith.unit}{chatWith.floor ? ' · ' + chatWith.floor : ''}</span>
                </div>
              </div>
              <button className="s-btn s-ghost sm" onClick={closeChat}>Zavřít</button>
            </div>
            <div className="modal-b">
              <div className="ch-scroll" ref={scrollRef}>
                {msgs.length === 0 && <p className="a-note" style={{ textAlign: 'center', padding: '20px 0' }}>Začátek konverzace. Zprávy vidíte jen vy dva.</p>}
                {msgs.map((m) => (
                  <div className={'ch-b ' + (m.from === 'me' ? 'me' : 'them')} key={m.id}>
                    {m.text}<span className="bt">{m.at}</span>
                  </div>
                ))}
              </div>
              <div className="ch-in">
                <input placeholder="Napište zprávu…" value={text} onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') send() }} />
                <button className="s-btn s-primary" onClick={send}>Odeslat</button>
              </div>
              {isDemo && <p className="a-note" style={{ marginTop: 8 }}>Ukázková konverzace. V provozu se zprávy doručí druhé straně okamžitě.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
