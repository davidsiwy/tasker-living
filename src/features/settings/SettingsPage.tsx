import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useSession } from '../../state/session'
import { roleNames } from '../../lib/types'
import type { Role } from '../../lib/types'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'

export default function SettingsPage() {
  const { user, isDemo, setRole, signOut } = useSession()
  const toast = useToast()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [share, setShare] = useState(false)
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.getMyProfile().then((p) => { setEmail(p.email); setPhone(p.phone); setShare(p.shareContact) }).catch(() => {})
  }, [])

  if (!user) return null
  async function logout() { await signOut(); nav('/') }

  async function saveContact() {
    if (busy) return
    setBusy(true)
    try { await api.saveMyProfile({ phone: phone.trim(), shareContact: share }); toast('Kontakt uložen') }
    catch (e: any) { toast(e.message || 'Uložení selhalo') } finally { setBusy(false) }
  }

  async function changePw() {
    if (busy) return
    if (pw.length < 8) { toast('Heslo musí mít alespoň 8 znaků'); return }
    if (pw !== pw2) { toast('Hesla se neshodují'); return }
    setBusy(true)
    try { await api.changePassword(pw); setPw(''); setPw2(''); toast('Heslo změněno') }
    catch (e: any) { toast(e.message || 'Změna hesla selhala') } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="view-head"><div><h1>Nastavení</h1><div className="desc">Profil, kontakt a zabezpečení</div></div></div>
      <div className="grid-2">
        <div className="stat">
          <div className="card-h"><h3>Profil</h3></div>
          <div className="doc-row"><span className="cf-ic" style={{ background: 'var(--green-800)', color: '#f4f0e5', fontFamily: 'var(--fm)', fontWeight: 600 }}>{user.initials}</span><div><b>{user.name}</b><span>{user.buildingName}{user.unit ? `, ${user.unit}` : ''}</span></div></div>
          <div className="doc-row"><span className="cf-ic"><Icon name="sprava" small /></span><div><b>Role</b><span>{roleNames[user.role]}</span></div></div>
          {email && <div className="doc-row"><span className="cf-ic"><Icon name="msg" small /></span><div><b>E-mail</b><span>{email}</span></div></div>}

          <div className="card-h" style={{ marginTop: 18 }}><h3>Kontakt pro sousedy</h3></div>
          <div className="field"><label>Telefon</label><input className="input" placeholder="+420 ..." value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="contact-row" style={{ padding: '2px 0 10px' }}>
            <div style={{ flex: 1 }}><b style={{ fontSize: 14 }}>Sdílet kontakt v adresáři</b><br /><span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Sousedé uvidí váš telefon v Kontaktech</span></div>
            <button className={'toggle' + (share ? ' on' : '')} onClick={() => setShare(!share)} aria-label="Sdílení kontaktu" />
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveContact} disabled={busy}>Uložit kontakt</button>
        </div>

        <div style={{ display: 'grid', gap: 16, alignSelf: 'start' }}>
          {!isDemo && (
            <div className="stat">
              <div className="card-h"><h3>Změna hesla</h3></div>
              <div className="field"><label>Nové heslo</label><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
              <div className="field"><label>Nové heslo znovu</label><input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div>
              <button className="btn btn-soft btn-sm" onClick={changePw} disabled={busy}>Změnit heslo</button>
            </div>
          )}
          <div className="stat">
            <div className="card-h"><h3>{isDemo ? 'Aktivní role' : 'Účet'}</h3>{isDemo && <span className="sub">Demo přepínač</span>}</div>
            {isDemo && (
              <div className="field"><label>Zobrazit aplikaci jako</label>
                <select className="input" value={user.role} onChange={(e) => setRole(e.target.value as Role)}>{(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}</select>
              </div>
            )}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={logout}><Icon name="x" small /> Odhlásit se</button>
          </div>
        </div>
      </div>
      {isDemo && (
        <div className="stat" style={{ marginTop: 16, background: 'var(--gold-tint)', borderColor: '#e7dab4' }}>
          <p style={{ fontSize: 14, color: '#6b5a2a' }}>Demo režim. Toto je veřejná ukázka na mock datech. Reálný provoz běží na Supabase s vlastním přihlášením.</p>
        </div>
      )}
    </div>
  )
}
