import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useSession } from '../state/session'
import { roleNames, can } from '../lib/types'
import type { Role } from '../lib/types'
import { api } from '../lib/api'
import mark from '../assets/mark.png'
import './shell.css'

// Sidebar podle handoffu 3b: SPRÁVA DOMU + PLATFORMA, aktivní položka zelená.
// id = existující routa, label = pojmenování z handoffu.
type Item = { id: string; label: string; icon: string; cap?: Role[] }
const MANAGE: Item[] = [
  { id: 'prehled', label: 'Přehled', icon: 'grid' },
  { id: 'nastenka', label: 'Oznámení', icon: 'bell' },
  { id: 'najmy', label: 'Platby', icon: 'card' },
  { id: 'schuze', label: 'Schůze a hlasování', icon: 'vote' },
  { id: 'kalendar', label: 'Kalendář', icon: 'cal' },
  { id: 'zavady', label: 'Závady', icon: 'wrench' },
  { id: 'stiznosti', label: 'Soužití', icon: 'shield' },
  { id: 'dokumenty', label: 'Dokumenty', icon: 'doc' },
  { id: 'sprava', label: 'Správa domu', icon: 'sliders', cap: ['vybor','developer'] },
  { id: 'kontakty', label: 'Sousedé', icon: 'people' },
]
const PLATFORM: Item[] = [
  { id: 'sluzby', label: 'Služby Tasker', icon: 'spark' },
  { id: 'nastaveni', label: 'Nastavení', icon: 'gear' },
]

const P: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
  vote: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  wrench: '<path d="M14.7 6.3a4.6 4.6 0 0 0-6.1 6.1L3 18l3 3 5.6-5.6a4.6 4.6 0 0 0 6.1-6.1L14.5 12 12 9.5l2.7-3.2z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  people: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  spark: '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 8.9 8.9 0 0 1-3.8-.8L3 20l1-5.5a8.2 8.2 0 0 1-.9-3A8.4 8.4 0 0 1 11.5 3 8.4 8.4 0 0 1 21 11.5z"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
}
export function SIcon({ n, s = 16 }: { n: string; s?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: s, height: s, flex: 'none' }} fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: P[n] || P.doc }} />
  )
}

const TITLES: Record<string, string> = Object.fromEntries(
  [...MANAGE, ...PLATFORM].map((i) => [i.id, i.label]),
)

export default function AppShell() {
  const { user, isDemo, isPlatformAdmin, setRole, notifications, signOut } = useSession()
  const nav = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [complaints, setComplaints] = useState(0)
  const [faults, setFaults] = useState(0)
  const manage = user ? can(user.role as Role, 'complaint_log') : false

  useEffect(() => {
    if (!user) return
    if (manage) api.getComplaintsCount(user.buildingId).then(setComplaints).catch(() => setComplaints(0))
    api.getFaults(user.buildingId)
      .then((f) => setFaults(f.filter((x) => x.status !== 'Vyřešeno').length))
      .catch(() => setFaults(0))
  }, [user?.buildingId, manage])

  useEffect(() => { setOpen(false) }, [loc.pathname])

  if (!user) return null

  const isAdmin = can(user.role as Role, 'admin')
  const items = MANAGE.filter((i) => (i.cap ? i.cap.includes(user.role as Role) : true) && (i.id !== 'sprava' || isAdmin))
    .map((i) => (i.id === 'prehled' && (user.role === 'rezident' || user.role === 'investor') ? { ...i, label: 'Domů' } : i))
  const countFor = (id: string) =>
    id === 'zavady' && faults > 0 ? faults : id === 'stiznosti' && manage && complaints > 0 ? complaints : 0

  const section = loc.pathname.split('/')[2] || 'prehled'
  const today = new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  async function logout() { await signOut(); nav('/') }

  const link = (i: Item) => (
    <NavLink key={i.id} to={`/app/${i.id}`} className={({ isActive }) => 's-item' + (isActive ? ' active' : '')}>
      <span className="s-i"><SIcon n={i.icon} /></span>
      <span className="l">{i.label}</span>
      {countFor(i.id) > 0 && <span className="n">{countFor(i.id)}</span>}
    </NavLink>
  )

  return (
    <div className="sh">
      {open && <div className="s-scrim" onClick={() => setOpen(false)} />}
      <aside className={'s-side' + (open ? ' open' : '')}>
        <div className="s-brand">
          <img src={mark} alt="" />
          <div><b>Tasker Living</b><small>Součást Tasker</small></div>
        </div>

        <div className="s-house">
          <span className="ini">{user.buildingName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{user.buildingName}</b>
            <span>{roleNames[user.role as Role]}</span>
          </div>
        </div>

        <div className="s-lbl">Správa domu</div>
        {items.map(link)}

        <div className="s-lbl plat">Platforma</div>
        {PLATFORM.map(link)}
        {isPlatformAdmin && (
          <NavLink to="/operator" className="s-item">
            <span className="s-i"><SIcon n="grid" /></span><span className="l">Zpět do konzole</span>
          </NavLink>
        )}

        <div className="s-me">
          <span className="ava">{user.initials}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{user.name}</b>
            <span>{roleNames[user.role as Role]}</span>
          </div>
          <button onClick={logout} title="Odhlásit se"><SIcon n="out" s={15} /></button>
        </div>
      </aside>

      <div className="s-main">
        <header className="s-top">
          <button className="s-burger" onClick={() => setOpen(true)} aria-label="Menu"><SIcon n="menu" s={18} /></button>
          <div style={{ minWidth: 0 }}>
            <h1>{section === 'prehled' && (user.role === 'rezident' || user.role === 'investor') ? 'Domů' : (TITLES[section] || 'Přehled')}</h1>
            <span className="s-crumb">{today}</span>
          </div>
          <div className="s-search">
            <SIcon n="search" s={15} />
            <input placeholder="Hledat v domě…" aria-label="Hledat v domě" />
          </div>
          {isDemo && (
            <select
              className="s-btn s-ghost sm"
              value={user.role}
              onChange={(e) => setRole(e.target.value as Role)}
              aria-label="Role"
            >
              {(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
            </select>
          )}
          <button className="s-bell" aria-label="Notifikace" onClick={() => nav('/app/nastenka')}>
            <SIcon n="bell" />{notifications.length > 0 && <i />}
          </button>
        </header>

        <main className="s-view"><Outlet /></main>
      </div>
    </div>
  )
}
