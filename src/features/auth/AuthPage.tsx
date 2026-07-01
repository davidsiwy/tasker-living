import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../state/session'
import { roleNames } from '../../lib/types'
import type { Role } from '../../lib/types'
import { Icon } from '../../components/Icon'
import logoWhite from '../../assets/logo-stacked-white.png'

const DEMO_DESC: Record<Role, string> = {
  rezident: 'Nástěnka, závady, můj nájem',
  vybor: 'Správa, schůze, stížnosti',
  developer: 'Portfolio a předání domu',
  investor: 'Platby a konce smluv',
}

function Side() {
  return (
    <div className="auth-side">
      <img className="auth-logo" src={logoWhite} alt="Tasker Living" />
      <div className="auth-quote"><h2>Celý dům v jedné aplikaci</h2><p>Přihlaste se přístupovým kódem, který jste dostali od výboru nebo správce domu.</p></div>
      <div className="auth-feats">
        <div className="auth-feat"><span className="cf-ic"><Icon name="check" small /></span> Živá nástěnka a závady</div>
        <div className="auth-feat"><span className="cf-ic"><Icon name="check" small /></span> Platby spárované z banky</div>
        <div className="auth-feat"><span className="cf-ic"><Icon name="check" small /></span> Ověření pracovníci Tasker</div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  const { isDemo, setRole, signIn, signUp } = useSession()
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('TL-VP-VYBOR')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  function demoEnter(r: Role) { setRole(r); nav('/app/nastenka') }

  async function submit() {
    setErr(''); setBusy(true)
    try {
      if (mode === 'login') await signIn(email, pw)
      else await signUp(email, pw, name, code)
      nav('/app/nastenka')
    } catch (e: any) { setErr(e.message || 'Něco se nepovedlo') } finally { setBusy(false) }
  }

  // DEMO MODE: no backend configured, pick a role to explore
  if (isDemo) {
    return (
      <div className="auth">
        <Side />
        <div className="auth-main">
          <div className="auth-box">
            <h1>Přihlášení</h1>
            <p className="muted">Demo režim, backend není připojen. Vyberte roli a prohlédněte si aplikaci jejíma očima. Napojení na Supabase je v SETUP.md.</p>
            <div className="field" style={{ marginTop: 20 }}><label>Přístupový kód</label><input className="input mono" defaultValue="TL-VP-7F3K" /></div>
            <div className="divider">nebo vstupte jako</div>
            <div className="roles">
              {(Object.keys(roleNames) as Role[]).map((r) => (
                <button className="role-btn" key={r} onClick={() => demoEnter(r)}>
                  <span className="cf-ic"><Icon name={r === 'rezident' ? 'nastenka' : r === 'vybor' ? 'sprava' : r === 'developer' ? 'najmy' : 'bank'} small /></span>
                  <b>{roleNames[r]}</b><span>{DEMO_DESC[r]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // REAL MODE: Supabase auth
  return (
    <div className="auth">
      <Side />
      <div className="auth-main">
        <div className="auth-box">
          <h1>{mode === 'login' ? 'Přihlášení' : 'Registrace'}</h1>
          <p className="muted">{mode === 'login' ? 'Zadejte e-mail a heslo.' : 'Vytvořte účet pomocí přístupového kódu od výboru.'}</p>

          {mode === 'register' && (
            <div className="field" style={{ marginTop: 18 }}><label>Jméno a příjmení</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jan Novák" /></div>
          )}
          <div className="field" style={{ marginTop: mode === 'login' ? 18 : 0 }}><label>E-mail</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vas@email.cz" /></div>
          <div className="field"><label>Heslo</label><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" /></div>
          {mode === 'register' && (
            <div className="field"><label>Přístupový kód</label><input className="input mono" value={code} onChange={(e) => setCode(e.target.value)} /></div>
          )}

          {err && <div style={{ background: 'var(--bad-bg)', color: 'var(--bad)', borderRadius: 10, padding: '10px 12px', fontSize: 13, margin: '4px 0 12px' }}>{err}</div>}

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} onClick={submit} disabled={busy}>
            {busy ? 'Pracuji...' : mode === 'login' ? 'Přihlásit se' : 'Vytvořit účet'}
          </button>

          <div className="divider">{mode === 'login' ? 'nemáte účet?' : 'máte účet?'}</div>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setErr(''); setMode(mode === 'login' ? 'register' : 'login') }}>
            {mode === 'login' ? 'Registrovat přístupovým kódem' : 'Zpět na přihlášení'}
          </button>
        </div>
      </div>
    </div>
  )
}
