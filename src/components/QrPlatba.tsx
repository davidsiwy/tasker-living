import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { parseAccount, czIban, formatIban, spayd } from '../lib/payments'
import { Icon } from './Icon'

const money = (n: number) => n.toLocaleString('cs-CZ') + ' Kč'

export function QrPlatba({ account, amount, vs, message, recipient }: { account: string; amount: number; vs?: string; message?: string; recipient?: string }) {
  const acc = parseAccount(account)
  const iban = czIban(acc.prefix, acc.account, acc.bank)
  const code = spayd({ iban, amount, vs, msg: message, recipient })
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let ok = true
    QRCode.toDataURL(code, { margin: 1, width: 240, errorCorrectionLevel: 'M' }).then((u) => { if (ok) setUrl(u) }).catch(() => {})
    return () => { ok = false }
  }, [code])
  function copy() {
    navigator.clipboard?.writeText(`Účet: ${account}\nČástka: ${amount} Kč\nVS: ${vs || ''}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  }
  return (
    <div className="qr-pay">
      <div className="qr-box">{url ? <img src={url} alt="QR platba" /> : <div className="spin" />}</div>
      <div className="qr-meta">
        <div className="qr-amt">{money(amount)}</div>
        <div className="qr-line"><span>Účet</span><b className="mono">{account}</b></div>
        {vs && <div className="qr-line"><span>VS</span><b className="mono">{vs}</b></div>}
        <div className="qr-line"><span>IBAN</span><b className="mono" style={{ fontSize: 11 }}>{formatIban(iban)}</b></div>
        <button className="btn btn-ghost btn-sm" onClick={copy} style={{ marginTop: 10 }}><Icon name={copied ? 'check' : 'doc'} small /> {copied ? 'Zkopírováno' : 'Kopírovat údaje'}</button>
      </div>
    </div>
  )
}

export interface PayItem { id: string; label: string; amount: number; vs: string; due: string; recurring: boolean; msg: string }

export function PayModal({ item, account, recipient, onClose, onPaid, onAutopay }: { item: PayItem | null; account: string; recipient: string; onClose: () => void; onPaid?: (id: string) => void; onAutopay?: (id: string) => void }) {
  const [tab, setTab] = useState<'once' | 'auto'>('once')
  useEffect(() => { setTab('once') }, [item?.id])
  if (!item) return null
  const canAuto = item.recurring && Boolean(onAutopay)
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-h"><h3>Zaplatit: {item.label}</h3><button className="btn btn-ghost btn-icon" onClick={onClose}><Icon name="x" small /></button></div>
        <div className="modal-b">
          {canAuto && (
            <div className="pay-tabs">
              <button className={'pay-tab' + (tab === 'once' ? ' on' : '')} onClick={() => setTab('once')}>Jednorázově</button>
              <button className={'pay-tab' + (tab === 'auto' ? ' on' : '')} onClick={() => setTab('auto')}>Automaticky</button>
            </div>
          )}
          {tab === 'once' && (
            <>
              <QrPlatba account={account} amount={item.amount} vs={item.vs} message={item.msg} recipient={recipient} />
              <p className="qr-hint">Naskenujte QR ve své bankovní aplikaci a potvrďte platbu. Platba se spáruje automaticky podle variabilního symbolu.</p>
            </>
          )}
          {tab === 'auto' && canAuto && (
            <div>
              <p className="qr-hint" style={{ marginTop: 0 }}>Zaplaťte {money(item.amount)} automaticky každý měsíc. Nikdy nezapomenete a nemusíte nic řešit.</p>
              <div className="card-form">
                <div className="field"><label>Číslo karty</label><input className="input" placeholder="1234 5678 9012 3456" inputMode="numeric" /></div>
                <div className="cf-row">
                  <div className="field"><label>Platnost</label><input className="input" placeholder="MM / RR" /></div>
                  <div className="field"><label>CVC</label><input className="input" placeholder="123" inputMode="numeric" /></div>
                </div>
                <div className="field"><label>Držitel karty</label><input className="input" placeholder="Jméno Příjmení" /></div>
              </div>
              <div className="qr-soon" style={{ marginTop: 4 }}><Icon name="bank" small /> Zabezpečeno přes Stripe, kartu můžete kdykoli odebrat.</div>
              <div className="pay-or"><span>nebo</span></div>
              <div className="qr-standing" style={{ marginTop: 0 }}>
                <b><Icon name="clock" small /> Trvalý příkaz v bance</b>
                <p>Účet {account}, VS {item.vs}, částka {money(item.amount)}, měsíčně k {item.due} dni.</p>
              </div>
            </div>
          )}
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" onClick={onClose}>Zavřít</button>
          {tab === 'once' && onPaid && <button className="btn btn-primary" onClick={() => { onPaid(item.id); onClose() }}>Už jsem zaplatil</button>}
          {tab === 'auto' && canAuto && <button className="btn btn-primary" onClick={() => { onAutopay!(item.id); onClose() }}>Zapnout automatické platby</button>}
        </div>
      </div>
    </div>
  )
}
