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

export function PayModal({ item, account, recipient, onClose, onPaid }: { item: PayItem | null; account: string; recipient: string; onClose: () => void; onPaid?: (id: string) => void }) {
  if (!item) return null
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-h"><h3>Zaplatit: {item.label}</h3><button className="btn btn-ghost btn-icon" onClick={onClose}><Icon name="x" small /></button></div>
        <div className="modal-b">
          <QrPlatba account={account} amount={item.amount} vs={item.vs} message={item.msg} recipient={recipient} />
          <p className="qr-hint">Naskenujte QR ve své bankovní aplikaci a potvrďte platbu. Platba se spáruje automaticky podle variabilního symbolu.</p>
          {item.recurring && (
            <div className="qr-standing">
              <b><Icon name="clock" small /> Platit automaticky každý měsíc</b>
              <p>Nastavte si ve své bance trvalý příkaz: účet {account}, VS {item.vs}, částka {money(item.amount)}, měsíčně k {item.due} dni.</p>
            </div>
          )}
          <div className="qr-soon"><Icon name="bank" small /> Automatické strhávání kartou připravujeme přes Stripe.</div>
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" onClick={onClose}>Zavřít</button>
          {onPaid && <button className="btn btn-primary" onClick={() => { onPaid(item.id); onClose() }}>Už jsem zaplatil</button>}
        </div>
      </div>
    </div>
  )
}
