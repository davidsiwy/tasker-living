import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSession } from '../state/session'
import { can } from '../lib/types'
import type { Role } from '../lib/types'
import { api } from '../lib/api'
import { LanguageSwitcher } from './LanguageSwitcher'
import { buildSearchIndex, runSearch } from '../lib/search'
import type { SearchHit, SearchIndex } from '../lib/search'
import mark from '../assets/mark.png'
import logo from '../assets/logo-sm.png'
import './shell.css'

// Sidebar podle handoffu 3b: SPRÁVA DOMU + PLATFORMA, aktivní položka zelená.
// id = existující routa a zároveň klíč do shell:nav.<id> pro popisek.
type Item = { id: string; icon: string; cap?: Role[] }
const MANAGE: Item[] = [
  { id: 'prehled', icon: 'grid' },
  { id: 'nastenka', icon: 'bell' },
  { id: 'najmy', icon: 'card' },
  { id: 'schuze', icon: 'vote' },
  { id: 'kalendar', icon: 'cal' },
  { id: 'zavady', icon: 'wrench' },
  { id: 'stiznosti', icon: 'shield' },
  { id: 'dokumenty', icon: 'doc' },
  { id: 'sprava', icon: 'sliders', cap: ['vybor','developer'] },
  { id: 'kontakty', icon: 'people' },
]
const PLATFORM: Item[] = [
  { id: 'sluzby', icon: 'spark' },
  { id: 'nastaveni', icon: 'gear' },
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
  fund: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/>',
  heart: '<path d="M20.8 4.9a5.5 5.5 0 0 0-7.8 0L12 5.9l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.5l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
}
export function SIcon({ n, s = 16, filled = false }: { n: string; s?: number; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: s, height: s, flex: 'none' }} fill={filled ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: P[n] || P.doc }} />
  )
}

// Skutečné vyhledávání napříč domem: sousedé, dokumenty, oznámení, závady
// (a u výboru/developera jednotky). Index se natáhne líně při prvním otevření
// a dál se filtruje jen v paměti, takže psaní je okamžité. Jeden wrapper s
// display:contents drží desktopový dropdown i mobilní overlay pod jedním
// ref, ať klik kamkoli dovnitř nezavře panel jako klik mimo.
function HeaderSearch({ buildingId, isCommittee }: { buildingId: string; isCommittee: boolean }) {
  const { t } = useTranslation('shell')
  const KIND_LABEL: Record<SearchHit['kind'], string> = {
    neighbor: t('search.kindNeighbor'), document: t('search.kindDocument'), post: t('search.kindPost'),
    fault: t('search.kindFault'), unit: t('search.kindUnit'),
  }
  const nav = useNavigate()
  const loc = useLocation()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState<SearchIndex | null>(null)
  const [loadingIdx, setLoadingIdx] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  async function ensureIndex() {
    if (idx || loadingIdx) return
    setLoadingIdx(true)
    try { setIdx(await buildSearchIndex(buildingId, isCommittee)) } finally { setLoadingIdx(false) }
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [])
  useEffect(() => { setOpen(false) }, [loc.pathname])

  const results = idx ? runSearch(idx, q, t) : []
  const grouped: Partial<Record<SearchHit['kind'], SearchHit[]>> = {}
  for (const r of results) (grouped[r.kind] = grouped[r.kind] || []).push(r)
  const order: SearchHit['kind'][] = ['neighbor', 'post', 'fault', 'document', 'unit']

  async function go(hit: SearchHit) {
    setOpen(false); setQ('')
    if (hit.kind === 'document' && hit.doc) {
      try { const url = await api.openDocument(hit.doc); if (url) window.open(url, '_blank') } catch { /* otevřeme aspoň seznam */ }
      nav('/app/dokumenty'); return
    }
    if (hit.kind === 'neighbor') nav('/app/kontakty')
    else if (hit.kind === 'post') nav('/app/nastenka?post=' + hit.id)
    else if (hit.kind === 'fault') nav('/app/zavady')
    else if (hit.kind === 'unit') nav('/app/sprava?tab=jednotky')
  }

  const panel = (
    <div className="s-search-panel">
      {loadingIdx && <div className="s-search-empty">{t('search.loading')}</div>}
      {!loadingIdx && q.trim().length < 2 && (
        <div className="s-search-empty">{t('search.hint')}</div>
      )}
      {!loadingIdx && q.trim().length >= 2 && results.length === 0 && (
        <div className="s-search-empty">{t('search.noResults', { query: q })}</div>
      )}
      {order.map((k) => {
        const g = grouped[k]
        if (!g || !g.length) return null
        return (
          <div className="s-search-grp" key={k}>
            <div className="s-search-lbl">{KIND_LABEL[k]}</div>
            {g.map((r) => (
              <button key={r.id} className="s-search-hit" onClick={() => go(r)}>
                <span className="i"><SIcon n={r.icon} s={14} /></span>
                <span className="t"><b>{r.title}</b><span>{r.subtitle}</span></span>
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )

  return (
    <div ref={wrapRef} style={{ display: 'contents' }}>
      <div className="s-search">
        <SIcon n="search" s={15} />
        <input placeholder={t('header.searchPlaceholder')} aria-label={t('header.searchPlaceholder')} value={q}
          onFocus={() => { setOpen(true); ensureIndex() }}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }} />
        {q && <button className="s-search-x" onClick={() => setQ('')} aria-label={t('header.searchClear')}>×</button>}
        {open && panel}
      </div>

      <button className="s-search-btn" aria-label={t('header.searchOpen')} onClick={() => { setOpen(true); ensureIndex() }}>
        <SIcon n="search" s={17} />
      </button>
      {open && (
        <div className="s-search-ov">
          <div className="s-search-ovbar">
            <SIcon n="search" s={16} />
            <input autoFocus placeholder={t('header.searchPlaceholder')} aria-label={t('header.searchPlaceholder')} value={q}
              onChange={(e) => setQ(e.target.value)} />
            <button onClick={() => { setOpen(false); setQ('') }} aria-label={t('header.searchCloseAria')}>×</button>
          </div>
          {panel}
        </div>
      )}
    </div>
  )
}

export default function AppShell() {
  const { t, i18n } = useTranslation('shell')
  const { user, isDemo, isPlatformAdmin, setRole, notifications, signOut } = useSession()
  const nav = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [complaints, setComplaints] = useState(0)
  const [faults, setFaults] = useState(0)
  const manage = user ? can(user.role as Role, 'complaint_log') : false
  const roleLabel = (r: Role) => t(`common:roles.${r}`)

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
  const isHomeRole = user.role === 'rezident' || user.role === 'investor'
  const items = MANAGE.filter((i) => (i.cap ? i.cap.includes(user.role as Role) : true) && (i.id !== 'sprava' || isAdmin))
  const countFor = (id: string) =>
    id === 'zavady' && faults > 0 ? faults : id === 'stiznosti' && manage && complaints > 0 ? complaints : 0

  const section = loc.pathname.split('/')[2] || 'prehled'
  const today = new Date().toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  async function logout() { await signOut(); nav('/') }

  const navLabel = (i: Item) => (i.id === 'prehled' && isHomeRole ? t('nav.domu') : t(`nav.${i.id}`))
  const link = (i: Item) => (
    <NavLink key={i.id} to={`/app/${i.id}`} className={({ isActive }) => 's-item' + (isActive ? ' active' : '')}>
      <span className="s-i"><SIcon n={i.icon} /></span>
      <span className="l">{navLabel(i)}</span>
      {countFor(i.id) > 0 && <span className="n">{countFor(i.id)}</span>}
    </NavLink>
  )

  return (
    <div className="sh">
      {open && <div className="s-scrim" onClick={() => setOpen(false)} />}
      <aside className={'s-side' + (open ? ' open' : '')}>
        <div className="s-brand">
          <img className="s-logo" src={logo} alt="Tasker Living" />
          <a className="brand-tag" href="https://tasker.cz" target="_blank" rel="noopener noreferrer">{t('brand.tagline')}</a>
        </div>

        <div className="s-house">
          <span className="ini">{user.buildingName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{user.buildingName}</b>
            <span>{roleLabel(user.role as Role)}</span>
          </div>
        </div>

        <div className="s-lbl">{t('nav.sectionManage')}</div>
        {items.map(link)}

        <div className="s-lbl plat">{t('nav.sectionPlatform')}</div>
        {PLATFORM.map(link)}
        {isPlatformAdmin && (
          <NavLink to="/operator" className="s-item">
            <span className="s-i"><SIcon n="grid" /></span><span className="l">{t('nav.backToConsole')}</span>
          </NavLink>
        )}

        <div className="s-me">
          <span className="ava">{user.initials}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{user.name}</b>
            <span>{roleLabel(user.role as Role)}</span>
          </div>
          <button onClick={logout} title={t('common:actions.logout')}><SIcon n="out" s={15} /></button>
        </div>
      </aside>

      <div className="s-main">
        <header className="s-top">
          <button className="s-burger" onClick={() => setOpen(true)} aria-label={t('header.menu')}><SIcon n="menu" s={18} /></button>
          <div style={{ minWidth: 0 }}>
            <h1>{section === 'prehled' && isHomeRole ? t('nav.domu') : t(`nav.${section}`, t('nav.prehled'))}</h1>
            <span className="s-crumb">{today}</span>
          </div>
          <HeaderSearch buildingId={user.buildingId} isCommittee={isAdmin} />
          <LanguageSwitcher variant="select" compact className="s-btn s-ghost sm s-lang" />
          {isDemo && (
            <select
              className="s-btn s-ghost sm"
              value={user.role}
              onChange={(e) => setRole(e.target.value as Role)}
              aria-label={t('header.role')}
            >
              {(['rezident', 'vybor', 'developer', 'investor'] as Role[]).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
          )}
          <button className="s-bell" aria-label={t('header.notifications')} onClick={() => nav('/app/nastenka')}>
            <SIcon n="bell" />{notifications.length > 0 && <i />}
          </button>
        </header>

        <main className="s-view"><Outlet /></main>
      </div>
    </div>
  )
}
