import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../state/session'
import { roleNames } from '../../lib/types'
import type { Role } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { backendAvailable, exitDemo } from '../../lib/supabase'
import logoWhite from '../../assets/logo-stacked-white.png'

const DEMO_DESC: Record<Role, string> = {
  rezident: 'Nástěnka, závady, můj nájem',
  vybor: 'Správa, schůze, stížnosti',
  developer: 'Portfolio a předání domu',
  investor: 'Platby a konce smluv',
}

export function AuthSide() {
  return (
    <div className="auth-side">
      <img className="auth-logo" src={logoWhite} alt="Tasker Living" />
      <div className="auth-quote"><h2>Celý dům v jedné aplikaci</h2><p>Přihlaste se přístupovým kódem, který jste dostali od výboru nebo správce domu.</p></div>
      <div className="auth-feats">
        <div className="auth-feat"><span className="cf-ic"><Icon name="check" small /></span> Živá nástěnka a závady</div>
        <div className="auth-feat"><span className="cf-ic"><Icon name="check" small /></span> Platby QR kódem s párováním</div>
        <div className="auth-feat"><span className="cf-ic"><Icon name="check" small /></span> Ověření pracovníci Tasker</div>
      </div>
    </div>
  )
}

export default function AuthPage() {
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
      else { await resetPassword(email.trim()); setInfo('Poslali jsme vám e-mail s odkazem pro nastavení nového hesla.') }
    } catch (e: any) { setErr(e.message || 'Něco se nepovedlo') } finally { setBusy(false) }
  }
  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') submit() }

  // DEMO MODE: no backend configured, pick a role to explore
  if (isDemo) {
    return (
      <div className="auth">
        <AuthSide />
        <div className="auth-main">
          <div className="auth-box">
            <h1>Přihlášení</h1>
            <p className="muted">Demo režim, backend není připojen. Vyberte roli a prohlédněte si aplikaci jejíma očima.</p>
            <div className="divider">vstupte jako</div>
            <div className="roles">
              {(Object.keys(roleNames) as Role[]).map((r) => (
                <button className="role-btn" key={r} onClick={() => demoEnter(r)}>
                  <span className="cf-ic"><Icon name={r === 'rezident' ? 'nastenka' : r === 'vybor' ? 'sprava' : r === 'developer' ? 'najmy' : 'bank'} small /></span>
                  <b>{roleNames[r]}</b><span>{DEMO_DESC[r]}</span>
                </button>
              ))}
            </div>
            {backendAvailable && (
              <button className="linklike" style={{ display: 'block', margin: '18px auto 0', fontSize: 13 }} onClick={exitDemo}>Mám účet, přihlásit se do svého domu</button>
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
          <h1>{mode === 'login' ? 'Přihlášení' : mode === 'register' ? 'Registrace' : 'Zapomenuté heslo'}</h1>
          <p className="muted">{mode === 'login' ? 'Zadejte e-mail a heslo.' : mode === 'register' ? 'Vytvořte účet pomocí přístupového kódu od výboru nebo správce.' : 'Pošleme vám e-mail s odkazem pro nastavení nového hesla.'}</p>

          {mode === 'register' && (
            <div className="field" style={{ marginTop: 18 }}><label>Jméno a příjmení</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} placeholder="Jan Novák" autoComplete="name" /></div>
          )}
          <div className="field" style={{ marginTop: mode === 'register' ? 0 : 18 }}><label>E-mail</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter} placeholder="vas@email.cz" autoComplete="email" /></div>
          {mode !== 'forgot' && (
            <div className="field"><label>Heslo</label><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={onEnter} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>
          )}
          {mode === 'register' && (
            <div className="field"><label>Přístupový kód</label><input className="input mono" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onEnter} placeholder="TLV-XXXXXXXX" /></div>
          )}

          {err && <div style={{ background: 'var(--bad-bg)', color: 'var(--bad)', borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '4px 0 12px' }}>{err}</div>}
          {info && <div style={{ background: 'var(--ok-bg, #e8f5ee)', color: 'var(--ok)', borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '4px 0 12px' }}>{info}</div>}

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} onClick={submit} disabled={busy}>
            {busy ? 'Pracuji...' : mode === 'login' ? 'Přihlásit se' : mode === 'register' ? 'Vytvořit účet' : 'Poslat odkaz'}
          </button>

          {mode === 'login' && (
            <button className="linklike" style={{ display: 'block', margin: '12px auto 0', fontSize: 13 }} onClick={() => { setErr(''); setInfo(''); setMode('forgot') }}>Zapomněli jste heslo?</button>
          )}

          <div className="divider">{mode === 'login' ? 'nemáte účet?' : 'máte účet?'}</div>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setErr(''); setInfo(''); setMode(mode === 'login' ? 'register' : 'login') }}>
            {mode === 'login' ? 'Registrovat přístupovým kódem' : 'Zpět na přihlášení'}
          </button>
        </div>
      </div>
    </div>
  )
}
