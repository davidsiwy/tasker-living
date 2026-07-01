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
  const { user, isDemo, setRole, notifications, clearNotifications, signOut } = useSession()
  const nav = useNavigate()
  const [bell, setBell] = useState(false)
  if (!user) return null
  const items = NAV.filter((n) => !n.adminOnly || can(user.role as Role, 'admin'))
  async function logout() { await signOut(); nav('/') }

  return (
    <div className="app">
      <aside className="side">
        <Logo />
        <div className="side-lbl">Dům</div>
        {items.map((n) => (
          <NavLink key={n.id} to={`/app/${n.id}`} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <Icon name={n.icon} />{n.label}
            {n.id === 'stiznosti' && user.role !== 'rezident' && <span className="badge">3</span>}
          </NavLink>
        ))}
        <div className="side-foot">
          <NavLink to="/app/nastaveni" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}><Icon name="sprava" />Nastavení</NavLink>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="bldg">
            <span className="cf-ic"><Icon name="nastenka" small /></span>
            <div><b>{user.buildingName}</b><br /><span>{user.role === 'rezident' && user.unit ? `Jednotka ${user.unit}` : roleNames[user.role]}</span></div>
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
              <span className="pill pill-neutral">{roleNames[user.role]}</span>
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
            <button className="btn btn-ghost btn-icon" onClick={logout} title="Odhlásit se"><Icon name="x" /></button>
            <span className="cf-ic" style={{ background: 'var(--green-800)', color: '#f4f0e5', fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 600 }}>{user.initials}</span>
          </div>
        </header>

        <main className="view"><Outlet /></main>

        <nav className="mobile-nav">
          {items.map((n) => (
            <NavLink key={n.id} to={`/app/${n.id}`} className={({ isActive }) => 'mnav-item' + (isActive ? ' active' : '')}><Icon name={n.icon} />{n.label}</NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
