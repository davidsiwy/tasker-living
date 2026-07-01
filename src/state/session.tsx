import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Role, AppNotification } from '../lib/types'
import * as M from '../lib/mockData'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export interface SessionUser {
  userId: string; name: string; handle: string; initials: string
  role: Role; buildingId: string; buildingName: string; unit: string
}

interface Ctx {
  user: SessionUser | null
  isDemo: boolean
  isPlatformAdmin: boolean
  loading: boolean
  notifications: AppNotification[]
  clearNotifications: () => void
  setRole: (r: Role) => void                                            // demo only
  signIn: (email: string, pw: string) => Promise<void>                   // real
  signUp: (email: string, pw: string, name: string, code: string) => Promise<void>
  signOut: () => Promise<void>
}

const C = createContext<Ctx>(null as unknown as Ctx)
export const useSession = () => useContext(C)

const initialsOf = (name: string) => name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

// demo identities, used only when Supabase is not configured
const DEMO: Record<Role, SessionUser> = {
  rezident: { userId: 'demo', name: 'Jana Nováková', handle: 'B-204', initials: 'JN', role: 'rezident', buildingId: 'demo', buildingName: M.buildingName, unit: 'B-204' },
  vybor: { userId: 'demo', name: 'Výbor SVJ', handle: 'vybor', initials: 'VS', role: 'vybor', buildingId: 'demo', buildingName: M.buildingName, unit: '' },
  developer: { userId: 'demo', name: 'Gallery Point', handle: 'developer', initials: 'GP', role: 'developer', buildingId: 'demo', buildingName: M.buildingName, unit: '' },
  investor: { userId: 'demo', name: 'Investor', handle: 'investor', initials: 'IN', role: 'investor', buildingId: 'demo', buildingName: M.buildingName, unit: '' },
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured)
  const [notifications, setNotifs] = useState<AppNotification[]>(M.notifications)

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
        setUser({ userId: uid, name, initials: initialsOf(name), role: 'developer', buildingId: '', buildingName: 'Tasker Living', unit: '', handle: 'operator' })
      } else setUser(null)
      return
    }
    const m = mem as any
    const name = (prof as any)?.full_name || 'Rezident'
    const unit = m.units?.label || ''
    const role = m.role as Role
    setUser({ userId: uid, name, initials: initialsOf(name), role, buildingId: m.building_id, buildingName: m.buildings?.name || M.buildingName, unit, handle: unit || role })
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const sb = supabase!
    sb.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) await loadMembership(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = sb.auth.onAuthStateChange(async (_e, session) => {
      if (session?.user) await loadMembership(session.user.id)
      else setUser(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value: Ctx = {
    user, isDemo: !isSupabaseConfigured, isPlatformAdmin, loading, notifications,
    clearNotifications: () => setNotifs([]),
    setRole: (r) => setUser(DEMO[r]),
    async signIn(email, pw) {
      const { error } = await supabase!.auth.signInWithPassword({ email, password: pw })
      if (error) throw error
    },
    async signUp(email, pw, name, code) {
      const sb = supabase!
      const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { full_name: name } } })
      if (error) throw error
      if (!data.session) throw new Error('Účet vytvořen. Vypněte potvrzování e-mailu v Supabase nebo potvrďte e-mail, pak se přihlaste.')
      const { error: rErr } = await sb.rpc('redeem_access_code', { p_code: code })
      if (rErr) throw new Error('Přihlášení proběhlo, ale kód selhal: ' + rErr.message)
      await loadMembership(data.session.user.id)
    },
    async signOut() { if (supabase) await supabase.auth.signOut(); setUser(null); setIsPlatformAdmin(false) },
  }
  return <C.Provider value={value}>{children}</C.Provider>
}

export function PostLogin() {
  const { user, isPlatformAdmin, isDemo } = useSession()
  if (isDemo) return <Navigate to="/app/nastenka" replace />
  if (!user) return <div style={{ padding: 40, color: 'var(--ink-3)' }}>Přihlašování...</div>
  return <Navigate to={isPlatformAdmin ? '/operator' : '/app/nastenka'} replace />
}

export function RequireOperator({ children }: { children: ReactNode }) {
  const { user, loading, isPlatformAdmin } = useSession()
  if (loading) return <div style={{ padding: 40, color: 'var(--ink-3)' }}>Načítání...</div>
  if (!user) return <Navigate to="/prihlaseni" replace />
  if (!isPlatformAdmin) return <Navigate to="/app/nastenka" replace />
  return <>{children}</>
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useSession()
  if (loading) return <div style={{ padding: 40, color: 'var(--ink-3)' }}>Načítání...</div>
  if (!user) return <Navigate to="/prihlaseni" replace />
  return <>{children}</>
}
