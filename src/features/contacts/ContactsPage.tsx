import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Neighbor } from '../../lib/types'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'

export default function ContactsPage() {
  const toast = useToast()
  const [list, setList] = useState<Neighbor[]>([])
  useEffect(() => { api.getNeighbors().then(setList) }, [])
  const me = list.find((n) => n.unit === 'B-204')
  async function toggleMe() {
    if (!me) return
    await api.setVisibility(me.name, !me.shares)
    setList(await api.getNeighbors())
    toast(me.shares ? 'Skryto z adresáře' : 'Zveřejněno v adresáři')
  }

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
              ? <div className="cta-row"><button className="btn btn-ghost btn-icon" onClick={() => toast(`Volání: ${n.phone}`)}><Icon name="phone" small /></button><button className="btn btn-ghost btn-icon" onClick={() => toast('Otevřít zprávu')}><Icon name="msg" small /></button></div>
              : <span className="pill pill-neutral">Sdílení vypnuto</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
