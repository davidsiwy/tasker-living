// Domain types. These mirror the Postgres tables the real backend holds. The
// data layer in api.ts and lib/supabase return exactly these shapes.

export type Role = 'rezident' | 'vybor' | 'developer' | 'investor'

export const roleNames: Record<Role, string> = {
  rezident: 'Rezident', vybor: 'Výbor SVJ', developer: 'Developer', investor: 'Investor',
}

export type FeedType = 'ozn' | 'kom' | 'udal' | 'zav'
export const feedLabels: Record<FeedType, string> = {
  ozn: 'Oznámení', kom: 'Komunita', udal: 'Událost', zav: 'Závada',
}

// Social feed, timeline style
export interface FeedComment { id: string; authorName: string; handle: string; body: string; createdAt: string }
export type Audience = 'all' | 'owners' | 'garages' | `entrance:${string}`
export const audienceLabel = (a: string): string =>
  a === 'all' ? 'Celý dům' : a === 'owners' ? 'Vlastníci' : a === 'garages' ? 'Garáže'
  : a.startsWith('entrance:') ? 'Vchod ' + a.slice(9) : a

export type ReadState = 'read' | 'delivered' | 'unconnected'
export interface ReadRow { unitId: string; unitLabel: string; state: ReadState; readAt: string | null }

export interface FeedPost {
  id: string
  title?: string | null
  audience?: string
  push?: boolean
  authorName: string
  handle: string          // unit label like B-204, or role for the committee
  role: string
  kind: FeedType
  body: string
  imageUrl?: string | null
  createdAt: string       // ISO timestamp
  likes: number
  liked: boolean
  commentCount: number
  comments: FeedComment[]
  reads?: number
}

export type FaultStatus = 'Nahlášeno' | 'V řešení' | 'Vyřešeno'
export interface FaultEvent { status: string; at: string; note?: string }
export interface Fault { id: string; cat: string; loc: string; desc: string; status: FaultStatus; date: string; by: string; photos?: string[]; vendor?: string; timeline?: FaultEvent[] }

// Real units and payments
export interface UnitFull { id: string; label: string; floor: string; tenant: string; rent: number; vs: string; leaseEnd: string; share: number }
export type ChargeStatus = 'unpaid' | 'awaiting' | 'paid'
export interface Charge { id: string; unitId: string; unitLabel: string; label: string; amount: number; vs: string; period: string; due: string; status: ChargeStatus }
export interface BuildingSettings { account: string; recipient: string }

// legacy demo shape used by the developer/investor mock table
export interface Unit { id: string; floor: string; tenant: string; rent: number; vs: string; paid: boolean; due: string; end: string; endSoon: boolean }

export interface Service { id: string; name: string; from: number; icon: string; unit: string; desc: string }
export interface Booking { id: string; name: string; date: string; status: 'new' | 'assigned' | 'done' | 'cancelled'; worker?: string; rating?: string }
export interface ComplaintItem { type: string; date: string; note: string }
export interface Meeting { id: string; date: string; place: string; agenda: string[]; rsvp: boolean; going?: number }
export type CalKind = 'schuze' | 'platba' | 'udalost' | 'sluzba' | 'odstavka'
export interface CalEvent { id: string; kind: CalKind; title: string; sub?: string; at: string; route: string }
export interface DocItem { id?: string; name: string; kind: string; date: string; cat?: string; vis?: Role[]; url?: string; path?: string }
export interface Poll { q: string; yes: number; no: number; voted: boolean }
export type VoteChoice = 'ano' | 'ne' | 'zdrzel'
export interface VoteRosterRow { unitId: string; unit: string; owner: string; shares: number }
export interface VoteData { pollId: string | null; q: string; quorum: number; open: boolean; roster: VoteRosterRow[]; ballots: Record<string, VoteChoice>; proxies: Record<string, string> }
export interface Neighbor { userId?: string; name: string; unit: string; floor: string; phone: string; shares: boolean }
export interface Resident { name: string; unit: string; role: string }
export interface AccessCode { code: string; unit: string; used: boolean }
export interface AppNotification { id?: string; icon: string; t: string; s: string }
export interface MyProfile { email: string; phone: string; shareContact: boolean }

export type Cap =
  | 'post_announcement' | 'post_community' | 'manage_faults' | 'own_rent'
  | 'svj_contrib' | 'portfolio' | 'file_complaint' | 'complaint_log'
  | 'admin' | 'manage_meetings'

const MATRIX: Record<Cap, Role[]> = {
  post_announcement: ['vybor', 'developer'],
  post_community: ['rezident', 'vybor', 'developer'],
  manage_faults: ['vybor', 'developer'],
  own_rent: ['rezident'],
  svj_contrib: ['vybor'],
  portfolio: ['developer', 'investor'],
  file_complaint: ['rezident', 'vybor'],
  complaint_log: ['vybor', 'developer'],
  admin: ['vybor', 'developer'],
  manage_meetings: ['vybor', 'developer'],
}
export const can = (role: Role, cap: Cap): boolean => MATRIX[cap].includes(role)

export interface NavEntry { id: string; label: string; icon: string; adminOnly?: boolean }
export const NAV: NavEntry[] = [
  { id: 'nastenka', label: 'Nástěnka', icon: 'nastenka' },
  { id: 'zavady', label: 'Závady', icon: 'zavady' },
  { id: 'najmy', label: 'Nájmy', icon: 'najmy' },
  { id: 'sluzby', label: 'Služby', icon: 'sluzby' },
  { id: 'schuze', label: 'Schůze', icon: 'schuze' },
  { id: 'kontakty', label: 'Kontakty', icon: 'kontakty' },
  { id: 'stiznosti', label: 'Stížnosti', icon: 'stiznosti' },
  { id: 'sprava', label: 'Správa', icon: 'sprava', adminOnly: true },
]
