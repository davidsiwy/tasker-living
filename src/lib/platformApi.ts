// Operator (platform) data layer. Everything here is real only: account
// management goes through the admin-users Edge Function (service role stays
// server side), organizations and activity go through RLS with is_platform_admin.
import { supabase, isSupabaseConfigured } from './supabase'
import type { Role } from './types'

const FN_URL = ((import.meta.env.VITE_SUPABASE_URL as string) || '') + '/functions/v1/admin-users'
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''

async function call(action: string, payload: Record<string, unknown> = {}): Promise<any> {
  const { data } = await supabase!.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ action, ...payload }),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(out.error || 'Chyba serveru')
  return out
}

export interface PlatformMembership { membershipId: string; role: Role; building: string; buildingId: string; unit: string }
export interface PlatformUser { id: string; email: string; name: string; created: string; lastLogin: string; banned: boolean; memberships: PlatformMembership[] }
export interface PlatformBuilding { id: string; name: string; slug: string; units: number; members: number }
export interface ActivityRow { at: string; kind: string; actor: string; detail: string }
export interface PUnit { id: string; label: string }

const czDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('cs-CZ') : '')
const czDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('cs-CZ') + ' ' + new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : 'nikdy'

export const platformApi = {
  configured: isSupabaseConfigured,

  async listUsers(): Promise<PlatformUser[]> {
    const sb = supabase!
    const [{ users }, mems, profs] = await Promise.all([
      call('list'),
      sb.from('memberships').select('id, user_id, role, building_id, buildings(name), units(label)'),
      sb.from('profiles').select('id, full_name'),
    ])
    const names: Record<string, string> = {}
    for (const p of (profs.data || []) as any[]) names[p.id] = p.full_name
    const byUser: Record<string, PlatformMembership[]> = {}
    for (const m of (mems.data || []) as any[]) {
      if (!byUser[m.user_id]) byUser[m.user_id] = []
      byUser[m.user_id].push({
        membershipId: m.id, role: m.role as Role, buildingId: m.building_id,
        building: m.buildings?.name || '', unit: m.units?.label || '',
      })
    }
    return (users as any[]).map((u) => ({
      id: u.id, email: u.email || '', name: names[u.id] || '',
      created: czDate(u.created_at), lastLogin: czDateTime(u.last_sign_in_at),
      banned: !!u.banned, memberships: byUser[u.id] || [],
    })).sort((a, b) => a.email.localeCompare(b.email))
  },

  async createUser(input: { email: string; password: string; fullName: string; buildingId: string | null; role: Role | null; unitId: string | null }): Promise<void> {
    await call('create', {
      email: input.email, password: input.password, full_name: input.fullName,
      building_id: input.buildingId, role: input.role, unit_id: input.unitId,
    })
  },

  async setPassword(userId: string, password: string): Promise<void> { await call('set_password', { user_id: userId, password }) },
  async updateEmail(userId: string, email: string): Promise<void> { await call('update_email', { user_id: userId, email }) },
  async setBan(userId: string, banned: boolean): Promise<void> { await call('ban', { user_id: userId, banned }) },
  async deleteUser(userId: string): Promise<void> { await call('delete', { user_id: userId }) },

  async setMembershipRole(membershipId: string, role: Role): Promise<void> {
    const { error } = await supabase!.from('memberships').update({ role }).eq('id', membershipId)
    if (error) throw error
  },
  async removeMembership(membershipId: string): Promise<void> {
    const { error } = await supabase!.from('memberships').delete().eq('id', membershipId)
    if (error) throw error
  },
  async addMembership(userId: string, buildingId: string, role: Role, unitId: string | null): Promise<void> {
    const { error } = await supabase!.from('memberships').insert({ user_id: userId, building_id: buildingId, role, unit_id: unitId })
    if (error) throw error
  },

  async listBuildings(): Promise<PlatformBuilding[]> {
    const { data, error } = await supabase!.from('buildings')
      .select('id, name, slug, units(count), memberships(count)').order('name')
    if (error) throw error
    return (data || []).map((b: any) => ({
      id: b.id, name: b.name, slug: b.slug || '',
      units: b.units?.[0]?.count || 0, members: b.memberships?.[0]?.count || 0,
    }))
  },

  async createBuilding(name: string, slug: string, unitLabels: string[]): Promise<void> {
    const sb = supabase!
    const { data, error } = await sb.from('buildings').insert({ name, slug: slug || null }).select('id').single()
    if (error) throw error
    const labels = unitLabels.map((l) => l.trim()).filter(Boolean)
    if (labels.length) {
      const { error: uErr } = await sb.from('units').insert(labels.map((label) => ({ building_id: (data as any).id, label })))
      if (uErr) throw uErr
    }
  },

  async listUnitsOf(buildingId: string): Promise<PUnit[]> {
    const { data, error } = await supabase!.from('units').select('id, label').eq('building_id', buildingId).order('label')
    if (error) throw error
    return (data || []).map((u: any) => ({ id: u.id, label: u.label }))
  },

  async activity(): Promise<ActivityRow[]> {
    const { data, error } = await supabase!.rpc('admin_activity', { p_limit: 80 })
    if (error) throw error
    return (data || []).map((r: any) => ({ at: czDateTime(r.at), kind: r.kind, actor: r.actor || '', detail: r.detail || '' }))
  },
}
