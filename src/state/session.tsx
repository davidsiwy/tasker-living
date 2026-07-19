import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Loader } from '../components/Loader'
import { Navigate } from 'react-router-dom'
import type { Role, AppNotification } from '../lib/types'
import * as M from '../lib/mockData'
import { api } from '../lib/api'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export interface SessionUser {
  userId: string; name: string; handle: string; initials: string
  role: Role; buildingId: string; buildingName: string; unit: string; unitId: string
}

interface Ctx {
  user: SessionUser | null
  isDemo: boolean
  isPlatformAdmin: boolean
  needsCode: boolean                    // signed in but without a membership
  loading: boolean
  notifications: AppNotification[]
  clearNotifications: () => void
  setRole: (r: Role) => void                                            // demo only
  signIn: (email: string, pw: string) => Promise<void>                   // real
  signUp: (email: string, pw: string, name: string, code: string) => Promise<void>
  redeemCode: (code: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const C = createContext<Ctx>(null as unknown as Ctx)
export const useSession = () => useContext(C)

const initialsOf = (name: string) => name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

// demo identities, used only when Supabase is not configured
const DEMO: Record<Role, SessionUser> = {
  rezident: { userId: 'demo', name: 'Jana Nováková', handle: 'B-204', initials: 'JN', role: 'rezident', buildingId: 'demo', buildingName: M.buildingName, unit: 'B-204', unitId: 'B-204' },
  vybor: { userId: 'demo', name: 'Petr Hlaváček', handle: 'vybor', initials: 'PH', role: 'vybor', buildingId: 'demo', buildingName: M.buildingName, unit: '', unitId: '' },
  developer: { userId: 'demo', name: 'Gallery Point', handle: 'developer', initials: 'GP', role: 'developer', buildingId: 'demo', buildingName: M.buildingName, unit: '', unitId: '' },
  investor: { userId: 'demo', name: 'Investor', handle: 'investor', initials: 'IN', role: 'investor', buildingId: 'demo', buildingName: M.buildingName, unit: '', unitId: '' },
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [needsCode, setNeedsCode] = useState(false)
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured)
  const [notifications, setNotifs] = useState<AppNotification[]>(isSupabaseConfigured ? [] : M.notifications)
  const unsubNotif = useRef<() => void>(() => {})

  async function loadMembership(uid: string) {
    const sb = supabase!
    const { data: prof } = await sb.from('profiles').select('full_name').eq('id', uid).maybeSingle()
    const { data: pa } = await sb.rpc('is_platform_admin')
    const admin = pa === true
    setIsPlatformAdmin(admin)
    const { data: mem } = await sb.from('memberships')
      .select('role, building_id, unit_id, buildings(name), units(label)')
      .eq('user_id', uid).limit(1).maybeSingle()
    if (!mem) {
      if (admin) {
        const name = (prof as any)?.full_name || 'Operátor'
        setNeedsCode(false)
        setUser({ userId: uid, name, initials: initialsOf(name), role: 'developer', buildingId: '', buildingName: 'Tasker Living', unit: '', unitId: '', handle: 'operator' })
      } else { setUser(null); setNeedsCode(true) }
      return
    }
    const m = mem as any
    const name = (prof as any)?.full_name || 'Rezident'
    const unit = m.units?.label || ''
    const role = m.role as Role
    setNeedsCode(false)
    setUser({ userId: uid, name, initials: initialsOf(name), role, buildingId: m.building_id, buildingName: m.buildings?.name || M.buildingName, unit, unitId: m.unit_id || '', handle: unit || role })
    // real notifications + live bell
    try {
      setNotifs(await api.getNotifications())
      unsubNotif.current()
      unsubNotif.current = api.subscribeNotifications(uid, (n) => setNotifs((s) => [n, ...s].slice(0, 30)))
    } catch { /* bell stays empty */ }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const sb = supabase!
    sb.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) await loadMembership(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') { window.location.hash = '#/reset'; return }
      if (session?.user) await loadMembership(session.user.id)
      else { setUser(null); setNeedsCode(false); setNotifs([]); unsubNotif.current() }
    })
    return () => { sub.subscription.unsubscribe(); unsubNotif.current() }
  }, [])

  const value: Ctx = {
    user, isDemo: !isSupabaseConfigured, isPlatformAdmin, needsCode, loading, notifications,
    clearNotifications: () => { setNotifs([]); api.markNotificationsRead().catch(() => {}) },
    setRole: (r) => setUser(DEMO[r]),
    async signIn(email, pw) {
      const { error } = await supabase!.auth.signInWithPassword({ email, password: pw })
      if (error) throw error
    },
    async signUp(email, pw, name, code) {
      const sb = supabase!
      const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { full_name: name } } })
      if (error) throw error
      if (!data.session) throw new Error('Účet vytvořen. Potvrďte e-mail a přihlaste se, kód pak zadáte po přihlášení.')
      const { error: rErr } = await sb.rpc('redeem_access_code', { p_code: code.trim() })
      if (rErr) { setNeedsCode(true); throw new Error('Účet je vytvořen, ale kód selhal: ' + rErr.message) }
      await loadMembership(data.session.user.id)
    },
    async redeemCode(code) {
      const sb = supabase!
      const { error } = await sb.rpc('redeem_access_code', { p_code: code.trim() })
      if (error) throw error
      const { data } = await sb.auth.getUser()
      if (data.user) await loadMembership(data.user.id)
    },
    async resetPassword(email) {
      const redirectTo = window.location.origin + window.location.pathname
      const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw error
    },
    async signOut() { if (supabase) await supabase.auth.signOut(); setUser(null); setIsPlatformAdmin(false); setNeedsCode(false) },
  }
  return <C.Provider value={value}>{children}</C.Provider>
}

export function homeFor(isPlatformAdmin: boolean): string {
  return isPlatformAdmin ? '/operator' : '/app/prehled'
}

// Root URL ("/"): a logged-in user goes straight to their dashboard, everyone
// else sees the marketing page. "Logged in" means an actual user session — in
// demo that's only true after a role is picked, so first-time visitors still
// land on marketing. During session restore we wait rather than flash marketing.
export function RootRoute({ marketing }: { marketing: ReactNode }) {
  const { user, loading, isPlatformAdmin, needsCode } = useSession()
  if (loading) return <Loader />
  if (needsCode) return <Navigate to="/kod" replace />
  if (user) return <Navigate to={homeFor(isPlatformAdmin)} replace />
  return <>{marketing}</>
}

export function PostLogin() {
  const { user, isPlatformAdmin, isDemo, needsCode } = useSession()
  if (isDemo) return <Navigate to="/app/prehled" replace />
  if (needsCode) return <Navigate to="/kod" replace />
  if (!user) return <div style={{ padding: 40, color: 'var(--ink-3)' }}>Přihlašování...</div>
  return <Navigate to={homeFor(isPlatformAdmin)} replace />
}

export function RequireOperator({ children }: { children: ReactNode }) {
  const { user, loading, isPlatformAdmin } = useSession()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/prihlaseni" replace />
  if (!isPlatformAdmin) return <Navigate to="/app/prehled" replace />
  return <>{children}</>
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, needsCode } = useSession()
  if (loading) return <Loader />
  if (needsCode) return <Navigate to="/kod" replace />
  if (!user) return <Navigate to="/prihlaseni" replace />
  return <>{children}</>
}
