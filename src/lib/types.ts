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

// Skloňování "upomínka" v akuzativu podle počtu (1 / 2–4 / 5+), sdílené napříč
// stránkami — dřív si to Platby a Přehled řešily každá po svém a Přehled to
// mělo špatně u 1 a u 5+.
export const reminderWord = (n: number): string => czPlural(n, 'upomínku', 'upomínky', 'upomínek')

// Obecné skloňování počtu v češtině podle pravidla 1 / 2–4 / 5+ (a 0, které se
// chová jako 5+). Použití: czPlural(n, 'byt', 'byty', 'bytů').
export const czPlural = (n: number, one: string, few: string, many: string): string =>
  n === 1 ? one : n >= 2 && n <= 4 ? few : many

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

// Zobrazitelný popisek pro FaultStatus. Hodnota samotná (f.status) zůstává
// česky napříč appkou — je to porovnávaná data, ne text pro čtenáře — tahle
// funkce jen mapuje na přeložený štítek při vykreslení. Sdíleno mezi
// AdminPage, hledáním a (až se převede) FaultsPage.
export const faultStatusLabel = (s: string, t: (k: string) => string): string =>
  s === 'Vyřešeno' ? t('common:faultStatus.faultResolved') : s === 'V řešení' ? t('common:faultStatus.faultInProgress') : t('common:faultStatus.faultReported')

// Časová osa závady má navíc krok "Přiřazen dodavatel", který není součástí
// FaultStatus (ten má jen 3 hodnoty) — použije se pro zobrazení jednotlivých
// kroků v historii, faultStatusLabel zůstává pro samotný current stav.
export const faultEventLabel = (s: string, t: (k: string) => string): string =>
  s === 'Přiřazen dodavatel' ? t('common:faultStatus.vendorAssigned') : faultStatusLabel(s, t)

// Sedm pevných kategorií závad — hodnota uložená v datech zůstává česky
// (viz faultStatusLabel výše), tohle je jen zobrazovací mapování.
export const FAULT_CAT_KEYS: Record<string, string> = {
  'Osvětlení': 'lighting', 'Výtah': 'elevator', 'Voda': 'water', 'Topení': 'heating',
  'Dveře a zámky': 'doorsLocks', 'Úklid': 'cleaning', 'Jiné': 'other',
}
export const catLabel = (cat: string, t: (k: string) => string): string =>
  FAULT_CAT_KEYS[cat] ? t(`common:faultCat.${FAULT_CAT_KEYS[cat]}`) : cat

// Šest pevných typů stížností — hodnota uložená v datech zůstává česky,
// stejný důvod a stejný vzor jako u FAULT_CAT_KEYS výše.
export const COMPLAINT_TYPE_KEYS: Record<string, string> = {
  'Hluk': 'noise', 'Nepořádek': 'mess', 'Kouření': 'smoking', 'Parkování': 'parking', 'Zvířata': 'pets', 'Jiné': 'other',
}
export const complaintTypeLabel = (ty: string, t: (k: string) => string): string =>
  COMPLAINT_TYPE_KEYS[ty] ? t(`common:complaintType.${COMPLAINT_TYPE_KEYS[ty]}`) : ty

// Stejný vzor jako faultStatusLabel — 'paid'/'awaiting'/'unpaid' jsou
// hodnoty ChargeStatus používané k porovnávání napříč appkou (Dashboard,
// Sprava, Platby), tohle je jen sdílené zobrazovací mapování, aby se
// štítky "Zaplaceno/Čeká na potvrzení/Po splatnosti" nepsaly na třech
// místech zvlášť.
export const chargeStatusLabel = (s: string, t: (k: string) => string): string =>
  t(`common:chargeStatus.${s === 'paid' ? 'paid' : s === 'awaiting' ? 'awaiting' : 'unpaid'}`)
export interface FaultEvent { status: string; at: string; note?: string }
export interface Fault { id: string; cat: string; loc: string; desc: string; status: FaultStatus; date: string; by: string; photos?: string[]; vendor?: string; timeline?: FaultEvent[] }

// Real units and payments
export interface UnitFull { id: string; label: string; floor: string; tenant: string; rent: number; vs: string; leaseEnd: string; share: number }
export type ChargeStatus = 'unpaid' | 'awaiting' | 'paid'
export interface Charge { id: string; unitId: string; unitLabel: string; label: string; amount: number; vs: string; period: string; due: string; status: ChargeStatus }
export interface BuildingSettings { account: string; recipient: string }

export interface FundEntry { id: string; date: string; amount: number; note: string }
export interface ReserveFund { visible: boolean; target: number | null; balance: number; entries: FundEntry[] }

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
