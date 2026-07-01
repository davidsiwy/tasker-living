import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSession } from '../state/session'
import { NAV, roleNames, can } from '../lib/types'
import type { Role } from '../lib/types'
import { Icon } from './Icon'

function Logo() {
  return (
    <div className="logo">
      <span className="mark"><span className="f f1" /><span className="f f2" /><span className="f f3" /><span className="w" /></span>
      <div><b>Tasker Living</b><small>Rezidence</small></div>
    </div>
  )
}

export default function AppShell() {
  const { user, isDemo, isPlatformAdmin, setRole, notifications, clearNotifications, signOut } = useSession()
  const nav = useNavigate()
  const [bell, setBell] = useState(false)
  const [sheet, setSheet] = useState(false)
  if (!user) return null
  const items = NAV.filter((n) => !n.adminOnly || can(user.role as Role, 'admin'))
  const primary = items.slice(0, 4)
  async function logout() { setSheet(false); await signOut(); nav('/') }
  function go(id: string) { setSheet(false); nav(`/app/${id}`) }
  const showComplaintBadge = user.role !== 'rezident'

  return (
    <div className="app">
      <aside className="side">
        <Logo />
        <div className="side-lbl">Dům</div>
        {items.map((n) => (
          <NavLink key={n.id} to={`/app/${n.id}`} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <Icon name={n.icon} />{n.label}
            {n.id === 'stiznosti' && showComplaintBadge && <span className="badge">3</span>}
          </NavLink>
        ))}
        {isPlatformAdmin && (
          <>
            <div className="side-lbl">Platforma</div>
            <NavLink to="/app/operator" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <Icon name="bank" />Operátor
            </NavLink>
          </>
        )}
        <div className="side-foot">
          <NavLink to="/app/nastaveni" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}><Icon name="sprava" />Nastavení</NavLink>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="bldg">
            <span className="cf-ic"><Icon name="nastenka" small /></span>
            <div style={{ minWidth: 0 }}><b>{user.buildingName}</b><br /><span>{user.role === 'rezident' && user.unit ? `Jednotka ${user.unit}` : roleNames[user.role]}</span></div>
          </div>
          <div className="top-actions">
            {isDemo ? (
              <div className="role-switch">
                <label>Role</label>
                <select value={user.role} onChange={(e) => setRole(e.target.value as Role)}>
                  {(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
                </select>
              </div>
            ) : (
              <span className="pill pill-neutral hide-mobile">{roleNames[user.role]}</span>
            )}
            <div className="bell">
              <button className="btn btn-ghost btn-icon" onClick={() => setBell((v) => !v)} aria-label="Notifikace">
                <Icon name="bell" />{notifications.length > 0 && <span className="badge">{notifications.length}</span>}
              </button>
              {bell && (
                <div className="notif-pop">
                  <div className="h">Notifikace<button className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }} onClick={clearNotifications}>Vyčistit</button></div>
                  {notifications.length === 0 && <div className="notif-item"><span style={{ color: 'var(--ink-3)', fontSize: 13 }}>Žádné nové notifikace.</span></div>}
                  {notifications.map((n, i) => (
                    <div className="notif-item" key={i}><span className="cf-ic"><Icon name={n.icon} small /></span><div><b>{n.t}</b><span>{n.s}</span></div></div>
                  ))}
                </div>
              )}
            </div>
            <button className="btn btn-ghost btn-icon hide-mobile" onClick={logout} title="Odhlásit se"><Icon name="x" /></button>
            <span className="cf-ic avatar-plate">{user.initials}</span>
          </div>
        </header>

        <main className="view"><Outlet /></main>

        <nav className="mobile-nav">
          {primary.map((n) => (
            <NavLink key={n.id} to={`/app/${n.id}`} className={({ isActive }) => 'mnav-item' + (isActive ? ' active' : '')}>
              <Icon name={n.icon} />{n.label}
              {n.id === 'stiznosti' && showComplaintBadge && <span className="badge">3</span>}
            </NavLink>
          ))}
          <button className={'mnav-item' + (sheet ? ' active' : '')} onClick={() => setSheet(true)}><Icon name="menu" />Více</button>
        </nav>

        {sheet && (
          <div className="sheet-scrim" onClick={() => setSheet(false)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-handle" />
              <div className="sheet-h"><b>{user.buildingName}</b><button className="btn btn-ghost btn-icon" onClick={() => setSheet(false)} aria-label="Zavřít"><Icon name="x" small /></button></div>
              <div className="sheet-grid">
                {items.map((n) => (
                  <button key={n.id} className="sheet-item" onClick={() => go(n.id)}>
                    <Icon name={n.icon} />{n.label}
                    {n.id === 'stiznosti' && showComplaintBadge && <span className="badge">3</span>}
                  </button>
                ))}
                <button className="sheet-item" onClick={() => go('nastaveni')}><Icon name="sprava" />Nastavení</button>
              </div>
              <button className="btn btn-ghost sheet-foot" style={{ width: '100%', justifyContent: 'center' }} onClick={logout}><Icon name="x" small /> Odhlásit se</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
