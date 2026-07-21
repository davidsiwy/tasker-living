import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../state/session'
import type { Role } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { backendAvailable, exitDemo } from '../../lib/supabase'
import logoWhite from '../../assets/logo-stacked-white.png'

export function AuthSide() {
  const { t } = useTranslation('auth')
  return (
    <div className="auth-side">
      <img className="auth-logo" src={logoWhite} alt="Tasker Living" />
      <div className="auth-quote"><h2>{t('side.headline')}</h2><p>{t('side.sub')}</p></div>
      <div className="auth-feats">
        <div className="auth-feat"><span className="cf-ic"><Icon name="check" small /></span> {t('side.feat1')}</div>
        <div className="auth-feat"><span className="cf-ic"><Icon name="check" small /></span> {t('side.feat2')}</div>
        <div className="auth-feat"><span className="cf-ic"><Icon name="check" small /></span> {t('side.feat3')}</div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  const { t } = useTranslation('auth')
  const { isDemo, setRole, signIn, signUp, resetPassword } = useSession()
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  function demoEnter(r: Role) { setRole(r); nav('/go') }

  async function submit() {
    if (busy) return
    setErr(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'login') { await signIn(email.trim(), pw); nav('/go') }
      else if (mode === 'register') { await signUp(email.trim(), pw, name.trim(), code); nav('/go') }
      else { await resetPassword(email.trim()); setInfo(t('form.infoResetSent')) }
    } catch (e: any) { setErr(e.message || t('common:errors.generic')) } finally { setBusy(false) }
  }
  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') submit() }

  const ROLE_ICON: Record<Role, string> = { rezident: 'nastenka', vybor: 'sprava', developer: 'najmy', investor: 'bank' }

  // DEMO MODE: no backend configured, pick a role to explore
  if (isDemo) {
    return (
      <div className="auth">
        <AuthSide />
        <div className="auth-main">
          <div className="auth-box">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}><LanguageSwitcher /></div>
            <h1>{t('demo.title')}</h1>
            <p className="muted">{t('demo.intro')}</p>
            <div className="divider">{t('demo.enterAs')}</div>
            <div className="roles">
              {(['rezident', 'vybor', 'developer', 'investor'] as Role[]).map((r) => (
                <button className="role-btn" key={r} onClick={() => demoEnter(r)}>
                  <span className="cf-ic"><Icon name={ROLE_ICON[r]} small /></span>
                  <b>{t(`common:roles.${r}`)}</b><span>{t(`demo.desc${r[0].toUpperCase()}${r.slice(1)}`)}</span>
                </button>
              ))}
            </div>
            {backendAvailable && (
              <button className="linklike" style={{ display: 'block', margin: '18px auto 0', fontSize: 13 }} onClick={exitDemo}>{t('demo.exitLink')}</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // REAL MODE: Supabase auth
  return (
    <div className="auth">
      <AuthSide />
      <div className="auth-main">
        <div className="auth-box">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}><LanguageSwitcher /></div>
          <h1>{mode === 'login' ? t('form.titleLogin') : mode === 'register' ? t('form.titleRegister') : t('form.titleForgot')}</h1>
          <p className="muted">{mode === 'login' ? t('form.subLogin') : mode === 'register' ? t('form.subRegister') : t('form.subForgot')}</p>

          {mode === 'register' && (
            <div className="field" style={{ marginTop: 18 }}><label>{t('form.labelName')}</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} placeholder="Jan Novák" autoComplete="name" /></div>
          )}
          <div className="field" style={{ marginTop: mode === 'register' ? 0 : 18 }}><label>{t('form.labelEmail')}</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter} placeholder="vas@email.cz" autoComplete="email" /></div>
          {mode !== 'forgot' && (
            <div className="field"><label>{t('form.labelPassword')}</label><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={onEnter} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>
          )}
          {mode === 'register' && (
            <div className="field"><label>{t('form.labelCode')}</label><input className="input mono" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onEnter} placeholder="TLV-XXXXXXXX" /></div>
          )}

          {err && <div style={{ background: 'var(--bad-bg)', color: 'var(--bad)', borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '4px 0 12px' }}>{err}</div>}
          {info && <div style={{ background: 'var(--ok-bg, #e8f5ee)', color: 'var(--ok)', borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '4px 0 12px' }}>{info}</div>}

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} onClick={submit} disabled={busy}>
            {busy ? t('common:actions.workingOnIt') : mode === 'login' ? t('form.submitLogin') : mode === 'register' ? t('form.submitRegister') : t('form.submitForgot')}
          </button>

          {mode === 'login' && (
            <button className="linklike" style={{ display: 'block', margin: '12px auto 0', fontSize: 13 }} onClick={() => { setErr(''); setInfo(''); setMode('forgot') }}>{t('form.forgotLink')}</button>
          )}

          <div className="divider">{mode === 'login' ? t('form.dividerNoAccount') : t('form.dividerHasAccount')}</div>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setErr(''); setInfo(''); setMode(mode === 'login' ? 'register' : 'login') }}>
            {mode === 'login' ? t('form.switchToRegister') : t('form.switchToLogin')}
          </button>
        </div>
      </div>
    </div>
  )
}
