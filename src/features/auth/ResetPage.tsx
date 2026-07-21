// Landing page of the password recovery e-mail: set a new password.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { AuthSide } from './AuthPage'

export default function ResetPage() {
  const { t } = useTranslation('auth')
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy) return
    if (pw.length < 8) { setErr(t('reset.errorTooShort')); return }
    if (pw !== pw2) { setErr(t('reset.errorMismatch')); return }
    setErr(''); setBusy(true)
    try { await api.changePassword(pw); nav('/go') }
    catch (e: any) { setErr(e.message || t('reset.errorChangeFailed')) }
    finally { setBusy(false) }
  }

  return (
    <div className="auth">
      <AuthSide />
      <div className="auth-main">
        <div className="auth-box">
          <h1>{t('reset.title')}</h1>
          <p className="muted">{t('reset.intro')}</p>
          <div className="field" style={{ marginTop: 18 }}><label>{t('reset.labelNew')}</label><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
          <div className="field"><label>{t('reset.labelAgain')}</label><input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} autoComplete="new-password" /></div>
          {err && <div style={{ background: 'var(--bad-bg)', color: 'var(--bad)', borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '4px 0 12px' }}>{err}</div>}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={submit} disabled={busy}>{busy ? t('common:actions.saving') : t('reset.submit')}</button>
        </div>
      </div>
    </div>
  )
}
