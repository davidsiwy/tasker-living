// Signed in but without a membership: enter the access code from the committee.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../state/session'
import { AuthSide } from './AuthPage'

export default function CodePage() {
  const { t } = useTranslation('auth')
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
    catch (e: any) { setErr(e.message || t('code.errorRedeem')) }
    finally { setBusy(false) }
  }

  return (
    <div className="auth">
      <AuthSide />
      <div className="auth-main">
        <div className="auth-box">
          <h1>{t('code.title')}</h1>
          <p className="muted">{t('code.intro')}</p>
          <div className="field" style={{ marginTop: 18 }}><label>{t('form.labelCode')}</label>
            <input className="input mono" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} placeholder="TLV-XXXXXXXX" autoFocus />
          </div>
          {err && <div style={{ background: 'var(--bad-bg)', color: 'var(--bad)', borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '4px 0 12px' }}>{err}</div>}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={submit} disabled={busy}>{busy ? t('code.verifying') : t('code.submit')}</button>
          <div className="divider">{t('code.or')}</div>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={async () => { await signOut(); nav('/prihlaseni') }}>{t('common:actions.logout')}</button>
        </div>
      </div>
    </div>
  )
}
