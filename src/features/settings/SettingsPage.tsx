import { useNavigate } from 'react-router-dom'
import { useSession } from '../../state/session'
import { roleNames } from '../../lib/types'
import type { Role } from '../../lib/types'
import { Icon } from '../../components/Icon'

export default function SettingsPage() {
  const { user, isDemo, setRole, signOut } = useSession()
  const nav = useNavigate()
  if (!user) return null
  async function logout() { await signOut(); nav('/') }

  return (
    <div>
      <div className="view-head"><div><h1>Nastavení</h1><div className="desc">Profil, role a odhlášení</div></div></div>
      <div className="grid-2">
        <div className="stat">
          <div className="card-h"><h3>Profil</h3></div>
          <div className="doc-row"><span className="cf-ic" style={{ background: 'var(--green-800)', color: '#f4f0e5', fontFamily: 'var(--fm)', fontWeight: 600 }}>{user.initials}</span><div><b>{user.name}</b><span>{user.buildingName}{user.unit ? `, ${user.unit}` : ''}</span></div></div>
          <div className="doc-row"><span className="cf-ic"><Icon name="sprava" small /></span><div><b>Role</b><span>{roleNames[user.role]}</span></div></div>
        </div>
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
      {isDemo && (
        <div className="stat" style={{ marginTop: 16, background: 'var(--gold-tint)', borderColor: '#e7dab4' }}>
          <p style={{ fontSize: 14, color: '#6b5a2a' }}>Demo režim. Připojte Supabase podle SETUP.md a získáte reálné přihlášení a živou nástěnku. Ostatní sekce zatím běží na mock datech přes <span className="mono">lib/api.ts</span>.</p>
        </div>
      )}
    </div>
  )
}
