import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { Neighbor } from '../../lib/types'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'
import { thread, sendDM, replyDM, type DM } from '../../lib/dm'

export default function ContactsPage() {
  const toast = useToast()
  const [list, setList] = useState<Neighbor[]>([])
  const [chatWith, setChatWith] = useState<Neighbor | null>(null)
  const [msgs, setMsgs] = useState<DM[]>([])
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { api.getNeighbors().then(setList) }, [])
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }, [msgs, chatWith])

  const me = list.find((n) => n.unit === 'B-204')
  async function toggleMe() {
    if (!me) return
    await api.setVisibility(me.name, !me.shares); setList(await api.getNeighbors())
    toast(me.shares ? 'Skryto z adresáře' : 'Zveřejněno v adresáři')
  }
  function openChat(n: Neighbor) { setChatWith(n); setMsgs(thread(n.unit, n.name.split(' ')[0])); setText('') }
  function send() {
    const t = text.trim(); if (!t || !chatWith) return
    setMsgs(sendDM(chatWith.unit, t)); setText('')
    setTimeout(() => setMsgs(replyDM(chatWith.unit)), 800)
  }
  function call(n: Neighbor) { window.location.href = 'tel:' + n.phone.replace(/\s/g, '') }

  return (
    <div>
      <div className="view-head"><div><h1>Kontakty sousedů</h1><div className="desc">Adresář domu, viditelnost je dobrovolná</div></div></div>

      <div className="stat" style={{ marginBottom: 16 }}>
        <div className="contact-row" style={{ padding: '4px 0' }}>
          <span className="cf-ic"><Icon name="kontakty" small /></span>
          <div style={{ flex: 1 }}><b>Moje viditelnost v adresáři</b><br /><span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{me?.shares ? 'Sousedé vidí vaše jméno a telefon' : 'Vaše údaje jsou skryté'}</span></div>
          <button className={'toggle' + (me?.shares ? ' on' : '')} onClick={toggleMe} aria-label="Přepnout viditelnost" />
        </div>
      </div>

      <div className="stat">
        <div className="card-h"><h3>Sousedé</h3><span className="sub">{list.filter((n) => n.shares).length} sdílí kontakt</span></div>
        {list.map((n) => (
          <div className="contact-row" key={n.name}>
            <span className="cf-ic" style={{ background: 'var(--green-800)', color: '#f4f0e5', fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 600 }}>{n.name.split(' ').map((x) => x[0]).join('')}</span>
            <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14 }}>{n.name}</b><br /><span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{n.unit} · {n.floor}</span></div>
            {n.shares
              ? <div className="cta-row"><button className="btn btn-ghost btn-icon" onClick={() => call(n)} aria-label="Volat"><Icon name="phone" small /></button><button className="btn btn-ghost btn-icon" onClick={() => openChat(n)} aria-label="Napsat zprávu"><Icon name="msg" small /></button></div>
              : <span className="pill pill-neutral">Sdílení vypnuto</span>}
          </div>
        ))}
      </div>

      {chatWith && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setChatWith(null) }}>
          <div className="modal">
            <div className="modal-h">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="cf-ic" style={{ background: 'var(--green-800)', color: '#f4f0e5', fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 600 }}>{chatWith.name.split(' ').map((x) => x[0]).join('')}</span>
                <div><h3 style={{ margin: 0 }}>{chatWith.name}</h3><span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{chatWith.unit} · {chatWith.floor}</span></div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setChatWith(null)}><Icon name="x" small /></button>
            </div>
            <div className="modal-b">
              <div className="chat-scroll" ref={scrollRef}>
                {msgs.map((m) => (
                  <div className={'bubble ' + m.from} key={m.id}>{m.text}<span className="bt">{m.at}</span></div>
                ))}
              </div>
              <div className="chat-input">
                <input className="input" placeholder="Napište zprávu..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send() }} />
                <button className="btn btn-primary btn-icon" onClick={send} aria-label="Odeslat"><Icon name="send" small /></button>
              </div>
              <p className="adm-mini" style={{ marginTop: 8 }}>Ukázková konverzace. Po napojení Supabase budou zprávy reálné a doručené i druhé straně.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
