// Data layer. The feed is real when Supabase is configured and mocked otherwise.
// The other sections stay mocked for now. Screens import only from here, so
// wiring the rest to Supabase later is a change in this file, not in the UI.
import * as M from './mockData'
import type {
  FeedPost, FeedComment, FeedType, Fault, Unit, Service, Booking, Meeting,
  DocItem, Poll, Neighbor, Resident, AccessCode, AppNotification, ComplaintItem, FaultStatus, VoteChoice,
} from './types'
import { supabase, isSupabaseConfigured } from './supabase'

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)) }
const wait = (ms = 160) => new Promise((r) => setTimeout(r, ms))
const rid = () => Math.random().toString(36).slice(2, 10)

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
      .select('id, author_name, handle, role, kind, body, image_url, created_at, post_likes(user_id), post_comments(id)')
      .eq('building_id', buildingId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return (data || []).map((p: any) => ({
      id: p.id, authorName: p.author_name, handle: p.handle, role: p.role || '',
      kind: p.kind, body: p.body, imageUrl: p.image_url, createdAt: p.created_at,
      likes: (p.post_likes || []).length,
      liked: (p.post_likes || []).some((l: any) => l.user_id === me),
      commentCount: (p.post_comments || []).length, comments: [],
    }))
  },

  async createPost(input: { buildingId: string; author: Author; kind: FeedType; body: string; imageUrl?: string }): Promise<FeedPost> {
    if (!isSupabaseConfigured) {
      await wait()
      const p: FeedPost = { id: rid(), authorName: input.author.name, handle: input.author.handle, role: input.author.role || '', kind: input.kind, body: input.body, imageUrl: input.imageUrl, createdAt: new Date().toISOString(), likes: 0, liked: false, commentCount: 0, comments: [] }
      mockFeed.unshift(p); return clone(p)
    }
    const sb = supabase!
    const { data: auth } = await sb.auth.getUser()
    const { data, error } = await sb.from('posts').insert({
      building_id: input.buildingId, author_id: auth.user?.id, author_name: input.author.name,
      handle: input.author.handle, role: input.author.role, kind: input.kind, body: input.body, image_url: input.imageUrl || null,
    }).select().single()
    if (error) throw error
    return { id: data.id, authorName: data.author_name, handle: data.handle, role: data.role || '', kind: data.kind, body: data.body, imageUrl: data.image_url, createdAt: data.created_at, likes: 0, liked: false, commentCount: 0, comments: [] }
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

  // live updates, returns an unsubscribe function
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

// ---------------- everything below is still mock ----------------
const db = {
  faults: clone(M.faults), units: clone(M.units), services: clone(M.services),
  bookings: clone(M.bookings), meetings: clone(M.meetings), documents: clone(M.documents),
  poll: clone(M.poll), neighbors: clone(M.neighbors), residents: clone(M.residents),
  codes: clone(M.codes), notifications: clone(M.notifications),
  complaints: clone(M.complaints) as Record<string, ComplaintItem[]>,
  voteBallots: { 'A-101': 'ano', 'B-205': 'ano', 'C-302': 'ne', 'D-410': 'ano' } as Record<string, VoteChoice>,
  voteProxies: {} as Record<string, string>,
}
const rnd = () => Math.random().toString(36).slice(2, 6).toUpperCase()

export const api = {
  async getFaults(): Promise<Fault[]> { await wait(); return clone(db.faults) },
  async reportFault(input: { cat: string; loc: string; desc: string; by: string }): Promise<Fault> {
    await wait(); const f: Fault = { id: Date.now(), status: 'Nahlášeno', date: 'právě teď', ...input }; db.faults.unshift(f); return clone(f)
  },
  async setFaultStatus(id: number, status: FaultStatus): Promise<void> { await wait(90); const f = db.faults.find((x) => x.id === id); if (f) f.status = status },

  async getUnits(): Promise<Unit[]> { await wait(); return clone(db.units) },
  async remind(_unitId: string): Promise<void> { await wait(120) },

  async getServices(): Promise<Service[]> { await wait(); return clone(db.services) },
  async getBookings(): Promise<Booking[]> { await wait(); return clone(db.bookings) },
  async createBooking(name: string): Promise<Booking> { await wait(); const b: Booking = { id: Date.now(), name, date: 'čeká na přiřazení', status: 'new' }; db.bookings.unshift(b); return clone(b) },
  async assignWorker(id: number): Promise<Booking | null> {
    await wait(1400); const b = db.bookings.find((x) => x.id === id); if (!b) return null
    b.status = 'assigned'; b.worker = 'Marek H.'; b.rating = '4.9'; b.date = 'zítra 9:00 až 12:00'; return clone(b)
  },

  async getComplaints(): Promise<Record<string, ComplaintItem[]>> { await wait(); return clone(db.complaints) },
  async fileComplaint(unit: string, type: string, note: string): Promise<void> { await wait(); if (!db.complaints[unit]) db.complaints[unit] = []; db.complaints[unit].push({ type, date: 'dnes', note }) },

  async getMeetings(): Promise<Meeting[]> { await wait(); return clone(db.meetings) },
  async rsvp(id: number): Promise<void> { await wait(90); const m = db.meetings.find((x) => x.id === id); if (m) m.rsvp = !m.rsvp },
  async getPoll(): Promise<Poll> { await wait(); return clone(db.poll) },
  async vote(choice: 'yes' | 'no'): Promise<Poll> { await wait(120); if (!db.poll.voted) { db.poll[choice] += 1; db.poll.voted = true } return clone(db.poll) },
  async getDocuments(role?: string): Promise<DocItem[]> { await wait(); let d = clone(db.documents); if (role) d = d.filter((x: DocItem) => !x.vis || x.vis.includes(role as any)); return d },

  async getNeighbors(): Promise<Neighbor[]> { await wait(); return clone(db.neighbors) },
  async setVisibility(name: string, shares: boolean): Promise<void> { await wait(80); const n = db.neighbors.find((x) => x.name === name); if (n) n.shares = shares },

  async getResidents(): Promise<Resident[]> { await wait(); return clone(db.residents) },
  async getCodes(): Promise<AccessCode[]> { await wait(); return clone(db.codes) },
  async generateCode(): Promise<AccessCode> { await wait(); const c: AccessCode = { code: 'TL-VP-' + rnd(), unit: 'nepřiřazeno', used: false }; db.codes.unshift(c); return clone(c) },

  async getNotifications(): Promise<AppNotification[]> { await wait(60); return clone(db.notifications) },

  // faults: timeline, vendor, photos
  async advanceFault(id: number, status: FaultStatus, note?: string): Promise<void> {
    await wait(90); const f = db.faults.find((x) => x.id === id); if (!f) return
    f.status = status; f.timeline = f.timeline || []; f.timeline.push({ status, at: 'právě teď', note })
  },
  async assignVendor(id: number, vendor: string): Promise<void> {
    await wait(90); const f = db.faults.find((x) => x.id === id); if (!f) return
    f.vendor = vendor; f.timeline = f.timeline || []; f.timeline.push({ status: 'Přiřazen dodavatel', at: 'právě teď', note: vendor })
  },
  async addFaultPhoto(id: number, url: string): Promise<void> {
    await wait(60); const f = db.faults.find((x) => x.id === id); if (!f) return; f.photos = f.photos || []; f.photos.push(url)
  },

  // owners voting: share-weighted ballots + proxies
  async getVote(): Promise<{ q: string; quorum: number; roster: M.VoteRow[]; ballots: Record<string, VoteChoice>; proxies: Record<string, string> }> {
    await wait(); return { q: M.voteQuestion, quorum: M.voteQuorum, roster: clone(M.voteRoster), ballots: { ...db.voteBallots }, proxies: { ...db.voteProxies } }
  },
  async castVote(unit: string, choice: VoteChoice): Promise<void> { await wait(90); db.voteBallots[unit] = choice; delete db.voteProxies[unit] },
  async setProxy(fromUnit: string, toUnit: string): Promise<void> { await wait(90); db.voteProxies[fromUnit] = toUnit; delete db.voteBallots[fromUnit] },
  async clearProxy(fromUnit: string): Promise<void> { await wait(60); delete db.voteProxies[fromUnit] },

  // documents: per-role visibility + upload
  async uploadDocument(doc: { name: string; kind: string; date: string; cat?: string; vis?: string[]; url?: string }): Promise<DocItem> {
    await wait(); const nd: DocItem = { id: 'd' + rid(), ...(doc as any) }; db.documents.unshift(nd); return clone(nd)
  },
  async setDocVisibility(id: string, vis: string[]): Promise<void> { await wait(60); const d = db.documents.find((x: DocItem) => x.id === id); if (d) d.vis = vis as any },
}
