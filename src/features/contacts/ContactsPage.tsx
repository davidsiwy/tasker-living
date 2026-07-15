import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { Neighbor } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'
import { dm, type DM } from '../../lib/dm'

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
  useEffect(() => { reload().catch((e) => console.error(e)) }, [bid])
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }, [msgs, chatWith])
  useEffect(() => () => unsub.current(), [])

  async function toggleMe() {
    try {
      await api.saveMyProfile({ shareContact: !meShares })
      setMeShares(!meShares)
      toast(meShares ? 'Skryto z adresáře' : 'Zveřejněno v adresáři')
      reload()
    } catch (e: any) { toast(e.message || 'Uložení selhalo') }
  }

  async function openChat(n: Neighbor) {
    setChatWith(n); setText('')
    const otherId = n.userId || n.unit
    setMsgs(await dm.thread(otherId, n.name.split(' ')[0]))
    unsub.current()
    if (user) unsub.current = dm.subscribe(user.userId, otherId, (m) => setMsgs((s) => s.some((x) => x.id === m.id) ? s : [...s, m]))
  }
  function closeChat() { unsub.current(); unsub.current = () => {}; setChatWith(null) }

  async function send() {
    const t = text.trim(); if (!t || !chatWith) return
    setText('')
    try {
      const m = await dm.send(bid, chatWith.userId || chatWith.unit, t)
      setMsgs((s) => [...s, m])
    } catch (e: any) { toast(e.message || 'Odeslání selhalo') }
  }
  function call(n: Neighbor) { if (n.phone) window.location.href = 'tel:' + n.phone.replace(/\s/g, '') }

  const others = list.filter((n) => n.userId !== user?.userId)
  const isMinority = user?.role === 'developer' || user?.role === 'investor'

  return (
    <div>
      <div className="view-head"><div><h1>Kontakty sousedů</h1><div className="desc">Adresář domu, viditelnost je dobrovolná</div></div></div>

      {!isMinority && (
        <div className="stat" style={{ marginBottom: 16 }}>
          <div className="contact-row" style={{ padding: '4px 0' }}>
            <span className="cf-ic"><Icon name="kontakty" small /></span>
            <div style={{ flex: 1 }}><b>Moje viditelnost v adresáři</b><br /><span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{meShares ? 'Sousedé vidí vaše jméno a telefon' : 'Váš telefon je skrytý'}</span></div>
            <button className={'toggle' + (meShares ? ' on' : '')} onClick={toggleMe} aria-label="Přepnout viditelnost" />
          </div>
          <p className="adm-mini" style={{ marginTop: 6 }}>Telefon si nastavíte v Nastavení.</p>
        </div>
      )}

      <div className="stat">
        <div className="card-h"><h3>Sousedé</h3><span className="sub">{others.filter((n) => n.shares).length} sdílí kontakt</span></div>
        {others.map((n) => (
          <div className="contact-row" key={n.userId || n.name}>
            <span className="cf-ic" style={{ background: 'var(--green-800)', color: '#f4f0e5', fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 600 }}>{n.name.split(' ').map((x) => x[0]).join('')}</span>
            <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14 }}>{n.name}</b><br /><span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{n.unit}{n.floor ? ' · ' + n.floor : ''}</span></div>
            <div className="cta-row">
              {n.shares && n.phone && <button className="btn btn-ghost btn-icon" onClick={() => call(n)} aria-label="Volat"><Icon name="phone" small /></button>}
              <button className="btn btn-ghost btn-icon" onClick={() => openChat(n)} aria-label="Napsat zprávu"><Icon name="msg" small /></button>
              {!n.shares && <span className="pill pill-neutral">Telefon skrytý</span>}
            </div>
          </div>
        ))}
        {others.length === 0 && <div className="empty"><span className="cf-ic"><Icon name="kontakty" /></span><p>Zatím tu kromě vás nikdo není. Sousedé se objeví, jakmile se připojí přístupovým kódem.</p></div>}
      </div>

      {chatWith && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) closeChat() }}>
          <div className="modal">
            <div className="modal-h">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="cf-ic" style={{ background: 'var(--green-800)', color: '#f4f0e5', fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 600 }}>{chatWith.name.split(' ').map((x) => x[0]).join('')}</span>
                <div><h3 style={{ margin: 0 }}>{chatWith.name}</h3><span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{chatWith.unit}{chatWith.floor ? ' · ' + chatWith.floor : ''}</span></div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={closeChat}><Icon name="x" small /></button>
            </div>
            <div className="modal-b">
              <div className="chat-scroll" ref={scrollRef}>
                {msgs.map((m) => (
                  <div className={'bubble ' + m.from} key={m.id}>{m.text}<span className="bt">{m.at}</span></div>
                ))}
                {msgs.length === 0 && <p className="adm-mini" style={{ textAlign: 'center', padding: '20px 0' }}>Začátek konverzace. Zprávy vidíte jen vy dva.</p>}
              </div>
              <div className="chat-input">
                <input className="input" placeholder="Napište zprávu..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send() }} />
                <button className="btn btn-primary btn-icon" onClick={send} aria-label="Odeslat"><Icon name="send" small /></button>
              </div>
              {isDemo && <p className="adm-mini" style={{ marginTop: 8 }}>Ukázková konverzace. V reálném provozu se zprávy doručují druhé straně okamžitě.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
