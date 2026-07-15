// Signed in but without a membership: enter the access code from the committee.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../state/session'
import { AuthSide } from './AuthPage'

export default function CodePage() {
  const { redeemCode, signOut, needsCode, user } = useSession()
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (!needsCode && user) { nav('/go'); return null }

  async function submit() {
    if (busy || !code.trim()) return
    setErr(''); setBusy(true)
    try { await redeemCode(code); nav('/go') }
    catch (e: any) { setErr(e.message || 'Kód se nepodařilo uplatnit') }
    finally { setBusy(false) }
  }

  return (
    <div className="auth">
      <AuthSide />
      <div className="auth-main">
        <div className="auth-box">
          <h1>Připojit se k domu</h1>
          <p className="muted">Váš účet zatím není přiřazen k žádnému domu. Zadejte přístupový kód, který jste dostali od výboru nebo správce.</p>
          <div className="field" style={{ marginTop: 18 }}><label>Přístupový kód</label>
            <input className="input mono" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} placeholder="TLV-XXXXXXXX" autoFocus />
          </div>
          {err && <div style={{ background: 'var(--bad-bg)', color: 'var(--bad)', borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '4px 0 12px' }}>{err}</div>}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={submit} disabled={busy}>{busy ? 'Ověřuji...' : 'Připojit se'}</button>
          <div className="divider">nebo</div>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={async () => { await signOut(); nav('/prihlaseni') }}>Odhlásit se</button>
        </div>
      </div>
    </div>
  )
}
