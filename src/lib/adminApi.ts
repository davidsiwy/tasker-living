// Live data layer for the management console (Správa). Real when Supabase is
// configured, otherwise mapped mock data so demo mode keeps working. The People
// tab reads only from here, same seam pattern as api.ts.
import { supabase, isSupabaseConfigured } from './supabase'
import { api } from './api'
import * as A from './adminData'
import type { Role } from './types'

export interface LiveMember { membershipId: string; userId: string; name: string; email: string; unit: string; role: Role; since: string }
export interface LiveCode { code: string; role: Role; unit: string; used: boolean; created: string }
export interface LiveUnit { id: string; label: string }

const czDate = (iso: string) => new Date(iso).toLocaleDateString('cs-CZ')
const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms))

// demo fallbacks shaped like the live rows
const demoRole = (r: string): Role => (r === 'Výbor' ? 'vybor' : 'rezident')
let demoMembers: LiveMember[] = A.members.map((m, i) => ({
  membershipId: 'demo-' + i, userId: 'demo-' + i, name: m.name, email: m.email,
  unit: m.unit, role: demoRole(m.role), since: m.since,
}))
let demoCodes: LiveCode[] = A.codes.map((c) => ({
  code: c.code, role: demoRole(c.role), unit: c.unit,
  used: c.status === 'Použit', created: c.expires,
}))

export const adminApi = {
  async listMembers(buildingId: string): Promise<LiveMember[]> {
    if (!isSupabaseConfigured) { await wait(); return [...demoMembers] }
    const sb = supabase!
    const { data: mems, error } = await sb.from('memberships')
      .select('id, user_id, role, created_at, units(label)')
      .eq('building_id', buildingId).order('created_at', { ascending: true })
    if (error) throw error
    const ids = (mems || []).map((m: any) => m.user_id)
    const profs: Record<string, { full_name: string; email: string | null }> = {}
    if (ids.length) {
      const { data: ps } = await sb.from('profiles').select('id, full_name, email').in('id', ids)
      for (const p of (ps || []) as any[]) profs[p.id] = { full_name: p.full_name, email: p.email }
    }
    return (mems || []).map((m: any) => ({
      membershipId: m.id, userId: m.user_id,
      name: profs[m.user_id]?.full_name || 'Rezident',
      email: profs[m.user_id]?.email || '',
      unit: m.units?.label || '', role: m.role as Role, since: czDate(m.created_at),
    }))
  },

  async setRole(membershipId: string, role: Role): Promise<void> {
    if (!isSupabaseConfigured) { await wait(80); demoMembers = demoMembers.map((m) => m.membershipId === membershipId ? { ...m, role } : m); return }
    const { error } = await supabase!.from('memberships').update({ role }).eq('id', membershipId)
    if (error) throw error
  },

  async removeMember(membershipId: string): Promise<void> {
    if (!isSupabaseConfigured) { await wait(80); demoMembers = demoMembers.filter((m) => m.membershipId !== membershipId); return }
    const { error } = await supabase!.from('memberships').delete().eq('id', membershipId)
    if (error) throw error
  },

  async listCodes(buildingId: string): Promise<LiveCode[]> {
    if (!isSupabaseConfigured) { await wait(); return [...demoCodes] }
    const { data, error } = await supabase!.from('access_codes')
      .select('code, role, used_by, created_at, units(label)')
      .eq('building_id', buildingId).order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map((c: any) => ({
      code: c.code, role: c.role as Role, unit: c.units?.label || '',
      used: !!c.used_by, created: czDate(c.created_at),
    }))
  },

  async createCode(buildingId: string, role: Role, unitId: string | null, prefix = 'TL-VP'): Promise<string> {
    const code = prefix + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
    if (!isSupabaseConfigured) { await wait(); demoCodes = [{ code, role, unit: 'nepřiřazeno', used: false, created: 'dnes' }, ...demoCodes]; return code }
    const { error } = await supabase!.from('access_codes').insert({ code, building_id: buildingId, role, unit_id: unitId })
    if (error) throw error
    return code
  },

  async deleteCode(code: string): Promise<void> {
    if (!isSupabaseConfigured) { await wait(80); demoCodes = demoCodes.filter((c) => c.code !== code); return }
    const { error } = await supabase!.from('access_codes').delete().eq('code', code)
    if (error) throw error
  },

  async listUnits(buildingId: string): Promise<LiveUnit[]> {
    if (!isSupabaseConfigured) { await wait(60); return A.units.map((u) => ({ id: u.id, label: u.id })) }
    const { data, error } = await supabase!.from('units').select('id, label').eq('building_id', buildingId).order('label')
    if (error) throw error
    return (data || []).map((u: any) => ({ id: u.id, label: u.label }))
  },

  async addUnit(buildingId: string, label: string): Promise<LiveUnit> {
    if (!isSupabaseConfigured) { await wait(); return { id: label, label } }
    const { data, error } = await supabase!.from('units').insert({ building_id: buildingId, label }).select('id, label').single()
    if (error) throw error
    return { id: (data as any).id, label: (data as any).label }
  },
}
