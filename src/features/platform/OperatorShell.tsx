// Operator shell: standalone environment for platform operators. Own sidebar,
// own routes, no client features. The client app stays reachable via one link.
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSession } from '../../state/session'
import { Icon } from '../../components/Icon'
import type { ActivityRow } from '../../lib/platformApi'

const OPNAV = [
  { id: '', label: 'Přehled', icon: 'nastenka', end: true },
  { id: 'klienti', label: 'Klienti', icon: 'kontakty' },
  { id: 'organizace', label: 'Organizace', icon: 'bank' },
  { id: 'aktivita', label: 'Aktivita', icon: 'clock' },
  { id: 'operatori', label: 'Operátoři', icon: 'sprava' },
]

export default function OperatorShell() {
  const { user, signOut } = useSession()
  const nav = useNavigate()
  if (!user) return null
  async function logout() { await signOut(); nav('/') }

  return (
    <div className="app">
      <aside className="side">
        <div className="op-brand"><span className="op-brand-dot" /><b>Tasker Living</b></div>
        <div className="side-lbl">Operátor platformy</div>
        {OPNAV.map((n) => (
          <NavLink key={n.id} to={'/operator' + (n.id ? '/' + n.id : '')} end={n.end}
            className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <Icon name={n.icon} />{n.label}
          </NavLink>
        ))}
        <div className="side-foot">
          <NavLink to="/app/nastenka" className="nav-item"><Icon name="najmy" />Aplikace domu</NavLink>
          <button className="nav-item" style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, cursor: 'pointer' }} onClick={logout}>
            <Icon name="x" />Odhlásit se
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="bldg">
            <span className="cf-ic"><Icon name="sprava" small /></span>
            <div style={{ minWidth: 0 }}><b>Tasker Living</b><br /><span>Operátorská konzole</span></div>
          </div>
          <div className="top-actions">
            <div className="avatar" title={user.name}>{user.initials}</div>
          </div>
        </header>
        <main className="view"><Outlet /></main>
        <nav className="mobile-nav">
          {OPNAV.slice(0, 4).map((n) => (
            <NavLink key={n.id} to={'/operator' + (n.id ? '/' + n.id : '')} end={n.end}
              className={({ isActive }) => 'mnav-item' + (isActive ? ' active' : '')}>
              <Icon name={n.icon} />{n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

/* shared bits for operator pages */
export const KIND_LABEL: Record<string, string> = {
  registrace: 'Registrace', prihlaseni: 'Přihlášení', prispevek: 'Příspěvek', clenstvi: 'Členství',
}
export const KIND_ICON: Record<string, string> = {
  registrace: 'kontakty', prihlaseni: 'check', prispevek: 'nastenka', clenstvi: 'najmy',
}

export function ActRow({ a }: { a: ActivityRow }) {
  return (
    <div className="doc-row">
      <span className="cf-ic"><Icon name={KIND_ICON[a.kind] || 'check'} small /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontWeight: 600 }}>{a.actor || 'Systém'}</b>
        <span>{KIND_LABEL[a.kind] || a.kind}{a.detail ? ' · ' + a.detail : ''}</span>
      </div>
      <span className="adm-mini" style={{ whiteSpace: 'nowrap' }}>{a.at}</span>
    </div>
  )
}
