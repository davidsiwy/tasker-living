// Data layer. Every module is real when Supabase is configured and mocked
// otherwise, so the public demo keeps working. Screens import only from here.
import * as M from './mockData'
import type {
  FeedPost, FeedComment, FeedType, Fault, FaultStatus, UnitFull, Charge, ChargeStatus,
  BuildingSettings, Service, Booking, Meeting, DocItem, VoteChoice, VoteData,
  Neighbor, AppNotification, ComplaintItem, MyProfile, Role, ReadRow, CalEvent,
} from './types'
import { supabase, isSupabaseConfigured } from './supabase'

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)) }
const wait = (ms = 160) => new Promise((r) => setTimeout(r, ms))
const rid = () => Math.random().toString(36).slice(2, 10)
const czDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('cs-CZ') : '')
const czDateTime = (iso: string) => new Date(iso).toLocaleDateString('cs-CZ') + ', ' + new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
export const currentPeriod = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') }
export const prevPeriod = (p: string) => { const [y, m] = p.split('-').map(Number); const d = new Date(y, m - 2, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') }
export const nextPeriod = (p: string) => { const [y, m] = p.split('-').map(Number); const d = new Date(y, m, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') }
export const periodLabel = (p: string) => {
  const [y, m] = p.split('-'); const names = ['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec']
  return (names[Number(m) - 1] || m) + ' ' + y
}

interface Author { name: string; handle: string; role?: string }

// ---------------- FEED (real when Supabase configured) ----------------
let mockFeed: FeedPost[] = clone(M.feed)

export const feed = {
  async list(buildingId: string): Promise<FeedPost[]> {
    if (!isSupabaseConfigured) { await wait(); return clone(mockFeed) }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const me = auth.user?.id
    const { data, error } = await sb.from('posts')
      .select('id, title, audience, push, author_name, handle, role, kind, body, image_url, created_at, post_likes(user_id), post_comments(id), post_reads(unit_id)')
      .eq('building_id', buildingId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return (data || []).map((p: any) => ({
      id: p.id, title: p.title, audience: p.audience || 'all', push: p.push !== false,
      authorName: p.author_name, handle: p.handle, role: p.role || '',
      kind: p.kind, body: p.body, imageUrl: p.image_url, createdAt: p.created_at,
      reads: new Set((p.post_reads || []).map((r: any) => r.unit_id).filter(Boolean)).size,
      likes: (p.post_likes || []).length,
      liked: (p.post_likes || []).some((l: any) => l.user_id === me),
      commentCount: (p.post_comments || []).length, comments: [],
    }))
  },

  async createPost(input: { buildingId: string; author: Author; kind: FeedType; body: string; imageUrl?: string; title?: string; audience?: string; push?: boolean }): Promise<FeedPost> {
    if (!isSupabaseConfigured) {
      await wait()
      const p: FeedPost = { id: rid(), title: input.title || null, audience: input.audience || 'all', push: input.push !== false, authorName: input.author.name, handle: input.author.handle, role: input.author.role || '', kind: input.kind, body: input.body, imageUrl: input.imageUrl, createdAt: new Date().toISOString(), likes: 0, liked: false, commentCount: 0, comments: [] }
      mockFeed.unshift(p); return clone(p)
    }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const { data, error } = await sb.from('posts').insert({
      building_id: input.buildingId, author_id: auth.user?.id, author_name: input.author.name,
      handle: input.author.handle, role: input.author.role, kind: input.kind, body: input.body, image_url: input.imageUrl || null,
      title: input.title || null, audience: input.audience || 'all', push: input.push !== false,
    }).select().single()
    if (error) throw error
    return { id: data.id, title: data.title, audience: data.audience, push: data.push, authorName: data.author_name, handle: data.handle, role: data.role || '', kind: data.kind, body: data.body, imageUrl: data.image_url, createdAt: data.created_at, likes: 0, liked: false, commentCount: 0, comments: [] }
  },

  // Soused si oznámení označí přečtené; výbor pak vidí, koho obejít osobně.
  async markRead(postId: string, unitId?: string): Promise<void> {
    if (!isSupabaseConfigured) return
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    if (!auth.user) return
    await sb.from('post_reads').upsert(
      { post_id: postId, user_id: auth.user.id, unit_id: unitId || null },
      { onConflict: 'post_id,user_id', ignoreDuplicates: true },
    )
  },

  // Čtenost po bytech: přečteno / doručeno / nepřipojeno (tomu se tiskne dopis).
  async readStats(postId: string): Promise<ReadRow[]> {
    if (!isSupabaseConfigured) return []
    const sb = supabase!
    const { data, error } = await sb.rpc('post_read_stats', { p_post: postId })
    if (error) throw error
    return (data || []).map((r: any) => ({
      unitId: r.unit_id, unitLabel: r.unit_label, state: r.state, readAt: r.read_at,
    }))
  },

  async deletePost(id: string): Promise<void> {
    if (!isSupabaseConfigured) { await wait(60); mockFeed = mockFeed.filter((p) => p.id !== id); return }
    const { error } = await supabase!.from('posts').delete().eq('id', id)
    if (error) throw error
  },

  async toggleLike(p: FeedPost): Promise<void> {
    if (!isSupabaseConfigured) { await wait(60); const x = mockFeed.find((m) => m.id === p.id); if (x) { x.liked = !x.liked; x.likes += x.liked ? 1 : -1 } return }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser(); const me = auth.user?.id
    if (p.liked) await sb.from('post_likes').delete().eq('post_id', p.id).eq('user_id', me)
    else await sb.from('post_likes').insert({ post_id: p.id, user_id: me })
  },

  async getComments(postId: string): Promise<FeedComment[]> {
    if (!isSupabaseConfigured) { await wait(); const x = mockFeed.find((m) => m.id === postId); return clone(x?.comments || []) }
    const sb = supabase!
    const { data, error } = await sb.from('post_comments').select('id, author_name, handle, body, created_at').eq('post_id', postId).order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map((c: any) => ({ id: c.id, authorName: c.author_name, handle: c.handle, body: c.body, createdAt: c.created_at }))
  },

  async addComment(postId: string, author: Author, body: string): Promise<FeedComment> {
    if (!isSupabaseConfigured) { await wait(); const x = mockFeed.find((m) => m.id === postId); const c: FeedComment = { id: rid(), authorName: author.name, handle: author.handle, body, createdAt: new Date().toISOString() }; if (x) { x.comments.push(c); x.commentCount++ } return clone(c) }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const { data, error } = await sb.from('post_comments').insert({ post_id: postId, author_id: auth.user?.id, author_name: author.name, handle: author.handle, body }).select().single()
    if (error) throw error
    return { id: data.id, authorName: data.author_name, handle: data.handle, body: data.body, createdAt: data.created_at }
  },

  async uploadImage(file: File, buildingId: string): Promise<string> {
    if (!isSupabaseConfigured) { await wait(120); return URL.createObjectURL(file) }
    const sb = supabase!
    const path = `${buildingId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error } = await sb.storage.from('feed').upload(path, file, { upsert: false })
    if (error) throw error
    return sb.storage.from('feed').getPublicUrl(path).data.publicUrl
  },

  subscribe(buildingId: string, onChange: () => void): () => void {
    if (!isSupabaseConfigured) return () => {}
    const sb = supabase!
    let t: any
    const fire = () => { clearTimeout(t); t = setTimeout(onChange, 300) }
    const ch = sb.channel('feed-' + buildingId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `building_id=eq.${buildingId}` }, fire)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, fire)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments' }, fire)
      .subscribe()
    return () => { sb.removeChannel(ch) }
  },
}

// ---------------- demo state (used only without Supabase) ----------------
const demoFaults: Fault[] = clone(M.faults).map((f: any) => ({ ...f, id: String(f.id) }))
const db = {
  faults: demoFaults,
  bookings: clone(M.bookings).map((b: any) => ({ ...b, id: String(b.id) })) as Booking[],
  meetings: clone(M.meetings).map((m: any) => ({ ...m, id: String(m.id) })) as Meeting[],
  documents: clone(M.documents) as DocItem[],
  neighbors: clone(M.neighbors),
  complaints: clone(M.complaints) as Record<string, ComplaintItem[]>,
  voteBallots: { 'A-101': 'ano', 'B-205': 'ano', 'C-302': 'ne', 'D-410': 'ano' } as Record<string, VoteChoice>,
  voteProxies: {} as Record<string, string>,
  demoCharges: null as Charge[] | null,
  units: null as UnitFull[] | null,
  poll: { id: 'demo', q: M.voteQuestion, quorum: M.voteQuorum, open: true },
  myProfile: { email: 'demo@tasker.cz', phone: '+420 604 111 222', shareContact: true } as MyProfile,
}

function demoUnits(): UnitFull[] {
  if (!db.units) db.units = M.units.map((u) => ({ id: u.id, label: u.id, floor: u.floor, tenant: u.tenant === 'Volné' ? '' : u.tenant, rent: u.rent, vs: u.vs, leaseEnd: u.end, share: 2.5 }))
  return db.units
}
function demoCharges(): Charge[] {
  if (!db.demoCharges) {
    db.demoCharges = M.units.filter((u) => u.tenant !== 'Volné').map((u) => ({
      id: 'ch-' + u.id, unitId: u.id, unitLabel: u.id, label: 'Nájem', amount: u.rent, vs: u.vs,
      period: currentPeriod(), due: '15. ' + (new Date().getMonth() + 1) + '.', status: u.paid ? 'paid' as ChargeStatus : 'unpaid' as ChargeStatus,
    }))
  }
  return db.demoCharges
}

// ---------------- REAL API ----------------
export const api = {
  // ------- faults -------
  async getFaults(buildingId: string): Promise<Fault[]> {
    if (!isSupabaseConfigured) { await wait(); return clone(db.faults) }
    const { data, error } = await supabase!.from('faults')
      .select('id, category, location, description, status, vendor, reporter_label, created_at, fault_photos(url), fault_events(status, note, created_at)')
      .eq('building_id', buildingId).order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map((f: any) => ({
      id: f.id, cat: f.category, loc: f.location, desc: f.description, status: f.status as FaultStatus,
      date: czDate(f.created_at), by: f.reporter_label, vendor: f.vendor || undefined,
      photos: (f.fault_photos || []).map((p: any) => p.url),
      timeline: (f.fault_events || [])
        .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
        .map((e: any) => ({ status: e.status, at: czDateTime(e.created_at), note: e.note || undefined })),
    }))
  },

  async reportFault(input: { buildingId: string; cat: string; loc: string; desc: string; by: string; photos: string[] }): Promise<void> {
    if (!isSupabaseConfigured) {
      await wait()
      db.faults.unshift({ id: rid(), status: 'Nahlášeno', date: 'právě teď', cat: input.cat, loc: input.loc, desc: input.desc, by: input.by, photos: input.photos, timeline: [{ status: 'Nahlášeno', at: 'právě teď' }] })
      return
    }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const { data, error } = await sb.from('faults').insert({
      building_id: input.buildingId, reporter_id: auth.user?.id, reporter_label: input.by,
      category: input.cat, location: input.loc, description: input.desc,
    }).select('id').single()
    if (error) throw error
    if (input.photos.length) {
      await sb.from('fault_photos').insert(input.photos.map((url) => ({ fault_id: (data as any).id, url })))
    }
  },

  async advanceFault(id: string, status: FaultStatus, note?: string): Promise<void> {
    if (!isSupabaseConfigured) {
      await wait(90); const f = db.faults.find((x) => x.id === id); if (!f) return
      f.status = status; f.timeline = f.timeline || []; f.timeline.push({ status, at: 'právě teď', note }); return
    }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const { error } = await sb.from('faults').update({ status }).eq('id', id)
    if (error) throw error
    await sb.from('fault_events').insert({ fault_id: id, status, note: note || null, author_id: auth.user?.id })
  },

  async assignVendor(id: string, vendor: string): Promise<void> {
    if (!isSupabaseConfigured) {
      await wait(90); const f = db.faults.find((x) => x.id === id); if (!f) return
      f.vendor = vendor; f.timeline = f.timeline || []; f.timeline.push({ status: 'Přiřazen dodavatel', at: 'právě teď', note: vendor }); return
    }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const { error } = await sb.from('faults').update({ vendor }).eq('id', id)
    if (error) throw error
    await sb.from('fault_events').insert({ fault_id: id, status: 'Přiřazen dodavatel', note: vendor, author_id: auth.user?.id })
  },

  // ------- units -------
  async getUnitsFull(buildingId: string): Promise<UnitFull[]> {
    if (!isSupabaseConfigured) { await wait(); return demoUnits() }
    const { data, error } = await supabase!.from('units')
      .select('id, label, floor, tenant, rent, vs, lease_end, share').eq('building_id', buildingId).order('label')
    if (error) throw error
    return (data || []).map((u: any) => ({
      id: u.id, label: u.label, floor: u.floor || '', tenant: u.tenant || '', rent: Number(u.rent) || 0,
      vs: u.vs || '', leaseEnd: u.lease_end ? czDate(u.lease_end) : '', share: Number(u.share) || 0,
    }))
  },

  async saveUnit(id: string, patch: { label?: string; floor?: string; tenant?: string; rent?: number; vs?: string; leaseEnd?: string; share?: number }): Promise<void> {
    if (!isSupabaseConfigured) {
      await wait(80)
      const u = demoUnits().find((x) => x.id === id)
      if (u) {
        Object.assign(u, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
        const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(u.leaseEnd)
        if (m) u.leaseEnd = `${+m[3]}. ${+m[2]}. ${m[1]}`
      }
      return
    }
    const upd: any = {}
    if (patch.label !== undefined) upd.label = patch.label
    if (patch.floor !== undefined) upd.floor = patch.floor || null
    if (patch.tenant !== undefined) upd.tenant = patch.tenant || null
    if (patch.rent !== undefined) upd.rent = patch.rent
    if (patch.vs !== undefined) upd.vs = patch.vs || null
    if (patch.leaseEnd !== undefined) upd.lease_end = patch.leaseEnd || null
    if (patch.share !== undefined) upd.share = patch.share
    const { error } = await supabase!.from('units').update(upd).eq('id', id)
    if (error) throw error
  },

  async addUnit(buildingId: string, label: string): Promise<void> {
    if (!isSupabaseConfigured) { await wait(80); demoUnits().push({ id: label, label, floor: '', tenant: '', rent: 0, vs: '', leaseEnd: '', share: 0 }); return }
    const { error } = await supabase!.from('units').insert({ building_id: buildingId, label })
    if (error) throw error
  },

  async deleteUnit(id: string): Promise<void> {
    if (!isSupabaseConfigured) { await wait(80); db.units = demoUnits().filter((x) => x.id !== id); return }
    const { error } = await supabase!.from('units').delete().eq('id', id)
    if (error) throw error
  },

  // ------- charges (platby) -------
  async getCharges(buildingId: string, period: string): Promise<Charge[]> {
    if (!isSupabaseConfigured) { await wait(); return clone(demoCharges()) }
    const { data, error } = await supabase!.from('charges')
      .select('id, unit_id, label, amount, vs, period, due_date, status, units(label)')
      .eq('building_id', buildingId).eq('period', period).order('created_at')
    if (error) throw error
    return (data || []).map((c: any) => ({
      id: c.id, unitId: c.unit_id, unitLabel: c.units?.label || '', label: c.label,
      amount: Number(c.amount), vs: c.vs || '', period: c.period, due: c.due_date ? czDate(c.due_date) : '', status: c.status,
    }))
  },

  async getMyCharges(buildingId: string, unitId: string): Promise<Charge[]> {
    if (!isSupabaseConfigured) { await wait(); return clone(M.myPayments.map((p) => ({ id: p.id, unitId: 'B-204', unitLabel: 'B-204', label: p.label, amount: p.amount, vs: p.vs, period: currentPeriod(), due: p.due + ' dne', status: p.status as ChargeStatus }))) }
    const { data, error } = await supabase!.from('charges')
      .select('id, unit_id, label, amount, vs, period, due_date, status, units(label)')
      .eq('building_id', buildingId).eq('unit_id', unitId)
      .order('period', { ascending: false }).limit(12)
    if (error) throw error
    return (data || []).map((c: any) => ({
      id: c.id, unitId: c.unit_id, unitLabel: c.units?.label || '', label: c.label + ', ' + periodLabel(c.period),
      amount: Number(c.amount), vs: c.vs || '', period: c.period, due: c.due_date ? czDate(c.due_date) : '', status: c.status,
    }))
  },

  async generateCharges(buildingId: string, period: string): Promise<number> {
    if (!isSupabaseConfigured) { await wait(); return demoCharges().length }
    const units = await this.getUnitsFull(buildingId)
    const withRent = units.filter((u) => u.rent > 0 && u.tenant)
    if (!withRent.length) return 0
    const [y, m] = period.split('-').map(Number)
    const due = `${y}-${String(m).padStart(2, '0')}-15`
    const rows = withRent.map((u) => ({ building_id: buildingId, unit_id: u.id, label: 'Nájem', amount: u.rent, vs: u.vs || null, period, due_date: due }))
    const { error } = await supabase!.from('charges').upsert(rows, { onConflict: 'unit_id,period,label', ignoreDuplicates: true })
    if (error) throw error
    return rows.length
  },

  async setChargeStatus(id: string, status: ChargeStatus): Promise<void> {
    if (!isSupabaseConfigured) { await wait(80); const c = demoCharges().find((x) => x.id === id); if (c) c.status = status; return }
    const patch: any = { status }
    if (status === 'paid') patch.paid_at = new Date().toISOString()
    const { error } = await supabase!.from('charges').update(patch).eq('id', id)
    if (error) throw error
  },

  async remindCharge(id: string): Promise<number> {
    if (!isSupabaseConfigured) { await wait(120); return 1 }
    const { data, error } = await supabase!.rpc('remind_charge', { p_charge: id })
    if (error) throw error
    return data as number
  },

  async getBuildingSettings(buildingId: string): Promise<BuildingSettings> {
    if (!isSupabaseConfigured) { await wait(60); return { account: M.payAccount, recipient: M.payRecipient } }
    const { data, error } = await supabase!.from('buildings').select('bank_account, bank_recipient').eq('id', buildingId).maybeSingle()
    if (error) throw error
    return { account: (data as any)?.bank_account || '', recipient: (data as any)?.bank_recipient || '' }
  },

  async saveBuildingSettings(buildingId: string, s: BuildingSettings): Promise<void> {
    if (!isSupabaseConfigured) { await wait(80); return }
    const { error } = await supabase!.from('buildings').update({ bank_account: s.account || null, bank_recipient: s.recipient || null }).eq('id', buildingId)
    if (error) throw error
  },

  // ------- meetings -------
  // Kalendář domu (handoff 7g): sjednocuje schůze, splatnosti, události a služby.
  // Vrací syrová ISO data, aby šla vykreslit do měsíce, ne předformátované řetězce.
  async getCalendar(buildingId: string): Promise<CalEvent[]> {
    if (!isSupabaseConfigured) {
      await wait()
      const now = new Date(); const y = now.getFullYear(); const mo = now.getMonth()
      const iso = (d: number, h = 9, mi = 0) => new Date(y, mo, d, h, mi).toISOString()
      const day = now.getDate()
      return [
        { id: 'c1', kind: 'platba', title: 'Splatnost nájmu a záloh', sub: 'byt B-204 · 24 500 Kč', at: iso(15, 23, 59), route: '/app/najmy' },
        { id: 'c2', kind: 'schuze', title: 'Shromáždění vlastníků', sub: 'sušárna, vchod B', at: iso(Math.min(day + 5, 27), 18), route: '/app/schuze' },
        { id: 'c3', kind: 'odstavka', title: 'Odstávka vody', sub: 'vchody A a B, 8:00–12:00', at: iso(Math.min(day + 2, 27), 8), route: '/app/nastenka' },
        { id: 'c4', kind: 'sluzba', title: 'Úklid společných prostor', sub: 'Tasker · Marek P.', at: iso(Math.min(day + 3, 27), 14), route: '/app/sluzby' },
        { id: 'c5', kind: 'udalost', title: 'Sousedské setkání na dvoře', sub: 'komunitní, dobrovolné', at: iso(Math.min(day + 9, 28), 17), route: '/app/nastenka' },
      ]
    }
    const sb = supabase!
    const out: CalEvent[] = []
    const { data: ms } = await sb.from('meetings').select('id, starts_at, place')
      .eq('building_id', buildingId).gte('starts_at', new Date(Date.now() - 864e5).toISOString()).order('starts_at').limit(20)
    for (const m of ms || []) out.push({ id: 'm' + m.id, kind: 'schuze', title: 'Shromáždění vlastníků', sub: m.place, at: m.starts_at, route: '/app/schuze' })
    const period = currentPeriod()
    const { data: auth } = await sb.auth.getUser()
    const { data: chs } = await sb.from('charges').select('id, label, amount, due_date, unit_id')
      .eq('building_id', buildingId).eq('period', period).eq('status', 'unpaid').limit(30)
    for (const c of chs || []) if (c.due_date) out.push({ id: 'p' + c.id, kind: 'platba', title: 'Splatnost: ' + c.label, sub: (c.amount || 0).toLocaleString('cs-CZ') + ' Kč', at: c.due_date, route: '/app/najmy' })
    void auth
    return out.sort((a, z) => a.at.localeCompare(z.at))
  },

  async getMeetings(buildingId: string): Promise<Meeting[]> {
    if (!isSupabaseConfigured) { await wait(); return clone(db.meetings) }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser(); const me = auth.user?.id
    const { data, error } = await sb.from('meetings')
      .select('id, starts_at, place, agenda, meeting_rsvps(user_id, going)')
      .eq('building_id', buildingId).order('starts_at', { ascending: false }).limit(10)
    if (error) throw error
    return (data || []).map((m: any) => ({
      id: m.id, date: czDateTime(m.starts_at), place: m.place, agenda: m.agenda || [],
      rsvp: (m.meeting_rsvps || []).some((r: any) => r.user_id === me && r.going),
      going: (m.meeting_rsvps || []).filter((r: any) => r.going).length,
    }))
  },

  async rsvp(meetingId: string, going: boolean): Promise<void> {
    if (!isSupabaseConfigured) { await wait(90); const m = db.meetings.find((x) => x.id === meetingId); if (m) m.rsvp = going; return }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const { error } = await sb.from('meeting_rsvps').upsert({ meeting_id: meetingId, user_id: auth.user?.id, going }, { onConflict: 'meeting_id,user_id' })
    if (error) throw error
  },

  async createMeeting(buildingId: string, startsAt: string, place: string, agenda: string[]): Promise<void> {
    if (!isSupabaseConfigured) { await wait(); db.meetings.unshift({ id: rid(), date: startsAt, place, agenda, rsvp: false }); return }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const { error } = await sb.from('meetings').insert({ building_id: buildingId, starts_at: startsAt, place, agenda, created_by: auth.user?.id })
    if (error) throw error
  },

  // ------- polls (hlasování podle podílů) -------
  async getVote(buildingId: string): Promise<VoteData | null> {
    if (!isSupabaseConfigured) {
      await wait()
      return {
        pollId: db.poll.id, q: db.poll.q, quorum: db.poll.quorum, open: db.poll.open,
        roster: M.voteRoster.map((r) => ({ unitId: r.unit, unit: r.unit, owner: r.owner, shares: r.shares })),
        ballots: { ...db.voteBallots }, proxies: { ...db.voteProxies },
      }
    }
    const sb = supabase!
    const { data: polls, error } = await sb.from('polls').select('id, question, quorum, open')
      .eq('building_id', buildingId).order('created_at', { ascending: false }).limit(1)
    if (error) throw error
    const units = await this.getUnitsFull(buildingId)
    const roster = units.map((u) => ({ unitId: u.id, unit: u.label, owner: u.tenant || u.label, shares: u.share }))
    if (!polls || !polls.length) return { pollId: null, q: '', quorum: 50, open: false, roster, ballots: {}, proxies: {} }
    const poll: any = polls[0]
    const [{ data: bs }, { data: ps }] = await Promise.all([
      sb.from('ballots').select('unit_id, choice').eq('poll_id', poll.id),
      sb.from('proxies').select('from_unit, to_unit').eq('poll_id', poll.id),
    ])
    const ballots: Record<string, VoteChoice> = {}
    for (const b of (bs || []) as any[]) ballots[b.unit_id] = b.choice
    const proxies: Record<string, string> = {}
    for (const p of (ps || []) as any[]) proxies[p.from_unit] = p.to_unit
    return { pollId: poll.id, q: poll.question, quorum: poll.quorum, open: poll.open, roster, ballots, proxies }
  },

  async castVote(pollId: string, unitId: string, choice: VoteChoice): Promise<void> {
    if (!isSupabaseConfigured) { await wait(90); db.voteBallots[unitId] = choice; delete db.voteProxies[unitId]; return }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const { error } = await sb.from('ballots').upsert({ poll_id: pollId, unit_id: unitId, choice, voter_id: auth.user?.id }, { onConflict: 'poll_id,unit_id' })
    if (error) throw error
    await sb.from('proxies').delete().eq('poll_id', pollId).eq('from_unit', unitId)
  },

  async setProxy(pollId: string, fromUnit: string, toUnit: string): Promise<void> {
    if (!isSupabaseConfigured) { await wait(90); db.voteProxies[fromUnit] = toUnit; delete db.voteBallots[fromUnit]; return }
    const sb = supabase!
    const { error } = await sb.from('proxies').upsert({ poll_id: pollId, from_unit: fromUnit, to_unit: toUnit }, { onConflict: 'poll_id,from_unit' })
    if (error) throw error
    await sb.from('ballots').delete().eq('poll_id', pollId).eq('unit_id', fromUnit)
  },

  async clearProxy(pollId: string, fromUnit: string): Promise<void> {
    if (!isSupabaseConfigured) { await wait(60); delete db.voteProxies[fromUnit]; return }
    const { error } = await supabase!.from('proxies').delete().eq('poll_id', pollId).eq('from_unit', fromUnit)
    if (error) throw error
  },

  async createPoll(buildingId: string, question: string, quorum: number): Promise<void> {
    if (!isSupabaseConfigured) { await wait(); db.poll = { id: 'demo-' + Date.now(), q: question, quorum, open: true }; db.voteBallots = {}; db.voteProxies = {}; return }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const { error } = await sb.from('polls').insert({ building_id: buildingId, question, quorum, created_by: auth.user?.id })
    if (error) throw error
  },

  // Připomene nehlasujícím vlastníkům; vrací počet oslovených členů.
  async remindPoll(pollId: string): Promise<number> {
    if (!isSupabaseConfigured) { await wait(120); return 1 }
    const { data, error } = await supabase!.rpc('remind_poll', { p_poll: pollId })
    if (error) throw error
    return data as number
  },

  async closePoll(pollId: string): Promise<void> {
    if (!isSupabaseConfigured) { await wait(); db.poll.open = false; return }
    const { error } = await supabase!.from('polls').update({ open: false }).eq('id', pollId)
    if (error) throw error
  },

  // ------- documents -------
  async getDocuments(buildingId: string, _role?: string): Promise<DocItem[]> {
    if (!isSupabaseConfigured) { await wait(); let d = clone(db.documents); if (_role) d = d.filter((x: DocItem) => !x.vis || x.vis.includes(_role as any)); return d }
    const { data, error } = await supabase!.from('documents')
      .select('id, name, kind, category, path, visibility, created_at')
      .eq('building_id', buildingId).order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map((d: any) => ({ id: d.id, name: d.name, kind: d.kind, date: czDate(d.created_at), cat: d.category || undefined, vis: d.visibility as Role[], path: d.path }))
  },

  async openDocument(doc: DocItem): Promise<string> {
    if (!isSupabaseConfigured || !doc.path) { return doc.url || '' }
    const { data, error } = await supabase!.storage.from('docs').createSignedUrl(doc.path, 3600)
    if (error) throw error
    return data.signedUrl
  },

  async uploadDocument(buildingId: string, file: File, meta: { name?: string; cat?: string; vis: string[] }): Promise<void> {
    if (!isSupabaseConfigured) {
      await wait()
      db.documents.unshift({ id: 'd' + rid(), name: meta.name || file.name, kind: (file.name.split('.').pop() || 'PDF').toUpperCase(), date: 'dnes', cat: meta.cat, vis: meta.vis as Role[], url: URL.createObjectURL(file) })
      return
    }
    const sb = supabase!
    const path = `${buildingId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: upErr } = await sb.storage.from('docs').upload(path, file)
    if (upErr) throw upErr
    const { data: auth } = await sb.auth.getUser()
    const { error } = await sb.from('documents').insert({
      building_id: buildingId, name: meta.name || file.name,
      kind: (file.name.split('.').pop() || 'PDF').toUpperCase(), category: meta.cat || null,
      path, visibility: meta.vis, uploaded_by: auth.user?.id,
    })
    if (error) throw error
  },

  async setDocVisibility(id: string, vis: string[]): Promise<void> {
    if (!isSupabaseConfigured) { await wait(60); const d = db.documents.find((x: DocItem) => x.id === id); if (d) d.vis = vis as any; return }
    const { error } = await supabase!.from('documents').update({ visibility: vis }).eq('id', id)
    if (error) throw error
  },

  async deleteDocument(doc: DocItem): Promise<void> {
    if (!isSupabaseConfigured) { await wait(60); db.documents = db.documents.filter((x) => x.id !== doc.id); return }
    const sb = supabase!
    if (doc.path) await sb.storage.from('docs').remove([doc.path])
    const { error } = await sb.from('documents').delete().eq('id', doc.id!)
    if (error) throw error
  },

  // ------- complaints -------
  async getComplaints(buildingId: string): Promise<Record<string, ComplaintItem[]>> {
    if (!isSupabaseConfigured) { await wait(); return clone(db.complaints) }
    const { data, error } = await supabase!.from('complaints')
      .select('unit_label, type, note, created_at').eq('building_id', buildingId).order('created_at', { ascending: false })
    if (error) throw error
    const out: Record<string, ComplaintItem[]> = {}
    for (const c of (data || []) as any[]) {
      if (!out[c.unit_label]) out[c.unit_label] = []
      out[c.unit_label].push({ type: c.type, date: czDate(c.created_at), note: c.note })
    }
    return out
  },

  async getComplaintsCount(buildingId: string): Promise<number> {
    if (!isSupabaseConfigured) { return Object.values(db.complaints).reduce((s, a) => s + a.length, 0) }
    const { count, error } = await supabase!.from('complaints').select('id', { count: 'exact', head: true }).eq('building_id', buildingId)
    if (error) return 0
    return count || 0
  },

  async fileComplaint(buildingId: string, unit: string, type: string, note: string): Promise<void> {
    if (!isSupabaseConfigured) { await wait(); if (!db.complaints[unit]) db.complaints[unit] = []; db.complaints[unit].push({ type, date: 'dnes', note }); return }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const { error } = await sb.from('complaints').insert({ building_id: buildingId, unit_label: unit, type, note, author_id: auth.user?.id })
    if (error) throw error
  },

  async warnUnit(buildingId: string, unitLabel: string): Promise<number> {
    if (!isSupabaseConfigured) { await wait(120); return 1 }
    const sb = supabase!
    const { data: u, error: uErr } = await sb.from('units').select('id').eq('building_id', buildingId).eq('label', unitLabel).maybeSingle()
    if (uErr || !u) throw new Error('Jednotka ' + unitLabel + ' v domě neexistuje')
    const { data, error } = await sb.rpc('notify_unit', { p_unit: (u as any).id, p_icon: 'stiznosti', p_title: 'Upozornění výboru', p_sub: 'Na váš byt byla evidována stížnost. Prosíme o ohleduplnost k sousedům.' })
    if (error) throw error
    return data as number
  },

  // ------- neighbors and my profile -------
  async getNeighbors(buildingId: string): Promise<Neighbor[]> {
    if (!isSupabaseConfigured) { await wait(); return clone(db.neighbors) }
    const sb = supabase!
    const { data: mems, error } = await sb.from('memberships')
      .select('user_id, role, units(label, floor)').eq('building_id', buildingId)
    if (error) throw error
    const ids = (mems || []).map((m: any) => m.user_id)
    const profs: Record<string, any> = {}
    if (ids.length) {
      const { data: ps } = await sb.from('profiles').select('id, full_name, phone, share_contact').in('id', ids)
      for (const p of (ps || []) as any[]) profs[p.id] = p
    }
    return (mems || [])
      .filter((m: any) => m.role === 'rezident' || m.role === 'vybor')
      .map((m: any) => ({
        userId: m.user_id,
        name: profs[m.user_id]?.full_name || 'Rezident',
        unit: m.units?.label || '', floor: m.units?.floor || '',
        phone: profs[m.user_id]?.share_contact ? (profs[m.user_id]?.phone || '') : '',
        shares: !!profs[m.user_id]?.share_contact,
      }))
      .sort((a: Neighbor, b: Neighbor) => a.unit.localeCompare(b.unit))
  },

  async getMyProfile(): Promise<MyProfile> {
    if (!isSupabaseConfigured) { await wait(60); return { ...db.myProfile } }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const { data } = await sb.from('profiles').select('phone, share_contact, email').eq('id', auth.user?.id).maybeSingle()
    return { email: (data as any)?.email || auth.user?.email || '', phone: (data as any)?.phone || '', shareContact: !!(data as any)?.share_contact }
  },

  async saveMyProfile(patch: { phone?: string; shareContact?: boolean }): Promise<void> {
    if (!isSupabaseConfigured) { await wait(80); if (patch.phone !== undefined) db.myProfile.phone = patch.phone; if (patch.shareContact !== undefined) db.myProfile.shareContact = patch.shareContact; const me = db.neighbors.find((n) => n.unit === 'B-204'); if (me && patch.shareContact !== undefined) me.shares = patch.shareContact; return }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const upd: any = {}
    if (patch.phone !== undefined) upd.phone = patch.phone || null
    if (patch.shareContact !== undefined) upd.share_contact = patch.shareContact
    const { error } = await sb.from('profiles').update(upd).eq('id', auth.user?.id)
    if (error) throw error
  },

  async changePassword(newPassword: string): Promise<void> {
    if (!isSupabaseConfigured) { await wait(); return }
    const { error } = await supabase!.auth.updateUser({ password: newPassword })
    if (error) throw error
  },

  // ------- bookings -------
  async getBookings(buildingId: string): Promise<Booking[]> {
    if (!isSupabaseConfigured) { await wait(); return clone(db.bookings) }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const { data, error } = await sb.from('bookings')
      .select('id, service, note, status, worker, scheduled, created_at')
      .eq('building_id', buildingId).eq('user_id', auth.user?.id).order('created_at', { ascending: false }).limit(20)
    if (error) throw error
    return (data || []).map((b: any) => ({
      id: b.id, name: b.service, status: b.status, worker: b.worker || undefined,
      date: b.scheduled || (b.status === 'new' ? 'čeká na přiřazení' : czDate(b.created_at)),
    }))
  },

  async createBooking(buildingId: string, service: string, note: string): Promise<Booking> {
    if (!isSupabaseConfigured) {
      await wait(); const b: Booking = { id: rid(), name: service, date: 'čeká na přiřazení', status: 'new' }
      db.bookings.unshift(b); return clone(b)
    }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const { data, error } = await sb.from('bookings').insert({ building_id: buildingId, user_id: auth.user?.id, service, note: note || null }).select().single()
    if (error) throw error
    return { id: (data as any).id, name: service, date: 'čeká na přiřazení', status: 'new' }
  },

  async demoAssignWorker(id: string): Promise<Booking | null> {
    await wait(1400); const b = db.bookings.find((x) => x.id === id); if (!b) return null
    b.status = 'assigned'; b.worker = 'Marek H.'; b.rating = '4.9'; b.date = 'zítra 9:00 až 12:00'; return clone(b)
  },

  async cancelBooking(id: string): Promise<void> {
    if (!isSupabaseConfigured) { await wait(80); db.bookings = db.bookings.filter((b) => b.id !== id); return }
    const { error } = await supabase!.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    if (error) throw error
  },

  // ------- notifications -------
  async getNotifications(): Promise<AppNotification[]> {
    if (!isSupabaseConfigured) { await wait(60); return clone(M.notifications) }
    const { data, error } = await supabase!.from('notifications')
      .select('id, icon, title, subtitle, read').eq('read', false).order('created_at', { ascending: false }).limit(30)
    if (error) throw error
    return (data || []).map((n: any) => ({ id: n.id, icon: n.icon, t: n.title, s: n.subtitle }))
  },

  async markNotificationsRead(): Promise<void> {
    if (!isSupabaseConfigured) return
    await supabase!.from('notifications').update({ read: true }).eq('read', false)
  },

  subscribeNotifications(userId: string, onNew: (n: AppNotification) => void): () => void {
    if (!isSupabaseConfigured) return () => {}
    const sb = supabase!
    const ch = sb.channel('notif-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload: any) => {
        const n = payload.new
        onNew({ id: n.id, icon: n.icon, t: n.title, s: n.subtitle })
      })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  },
}
