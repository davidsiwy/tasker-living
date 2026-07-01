// Demo data for one building, used when Supabase is not configured.
import type {
  FeedPost, Fault, Unit, Service, Booking, Meeting, DocItem, Poll,
  Neighbor, Resident, AccessCode, AppNotification, ComplaintItem,
} from './types'

export const buildingName = 'Rezidence Vista Park'
export const myUnit = 'B-204'

const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString()

const DOG_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='340'>" +
  "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#274b43'/><stop offset='1' stop-color='#1e3a34'/></linearGradient></defs>" +
  "<rect width='600' height='340' fill='url(#g)'/>" +
  "<g fill='#e3cd94'><ellipse cx='300' cy='196' rx='48' ry='42'/><ellipse cx='248' cy='132' rx='20' ry='30'/><ellipse cx='352' cy='132' rx='20' ry='30'/><ellipse cx='206' cy='180' rx='17' ry='25'/><ellipse cx='394' cy='180' rx='17' ry='25'/></g>" +
  "<text x='300' y='300' fill='#f5f0e6' font-family='monospace' font-size='17' text-anchor='middle'>ztraceny pes, vchod C</text></svg>")

export const feed: FeedPost[] = [
  { id: 'p1', authorName: 'Výbor SVJ', handle: 'vybor', role: 'vybor', kind: 'ozn', body: 'Ve čtvrtek 8 až 12 bude odstávka teplé i studené vody kvůli opravě stoupačky. Doporučujeme předzásobit se pitnou vodou.', createdAt: ago(85), likes: 6, liked: false, commentCount: 2, comments: [
    { id: 'c1', authorName: 'Jana Nováková', handle: 'B-204', body: 'Díky za info, dám vědět sousedům na patře.', createdAt: ago(74) },
    { id: 'c2', authorName: 'Petr Kalina', handle: 'A-101', body: 'Bude teplá voda večer zase v provozu?', createdAt: ago(55) },
  ] },
  { id: 'p2', authorName: 'Jana Nováková', handle: 'B-204', role: 'rezident', kind: 'kom', body: 'Našel se pes u vchodu C, menší hnědý bez známky. Hlídám ho zatím u sebe, ozvěte se.', imageUrl: DOG_IMG, createdAt: ago(210), likes: 12, liked: true, commentCount: 1, comments: [
    { id: 'c3', authorName: 'Eva Horáková', handle: 'B-205', body: 'To je snad Bára od Novotných ze třetího patra.', createdAt: ago(190) },
  ] },
  { id: 'p3', authorName: 'Výbor SVJ', handle: 'vybor', role: 'vybor', kind: 'udal', body: 'Jarní schůze vlastníků 24. dubna od 18:00 ve společenské místnosti. Podklady najdete v sekci Schůze.', createdAt: ago(400), likes: 9, liked: false, commentCount: 0, comments: [] },
  { id: 'p4', authorName: 'Petr Kalina', handle: 'A-101', role: 'rezident', kind: 'kom', body: 'Prodám dětskou autosedačku, skupina 1, zachovalá. Cena dohodou, napište přes kontakty.', createdAt: ago(760), likes: 3, liked: false, commentCount: 0, comments: [] },
  { id: 'p5', authorName: 'Správa', handle: 'sprava', role: 'developer', kind: 'zav', body: 'Výtah C je opět v provozu, servis dokončen. Děkujeme za trpělivost.', createdAt: ago(1600), likes: 8, liked: false, commentCount: 0, comments: [] },
]

export const faults: Fault[] = [
  { id: 1, cat: 'Osvětlení', loc: 'Chodba, 3. patro', desc: 'Nesvítí světlo u výtahu, čidlo nereaguje.', status: 'V řešení', date: 'před 2 dny', by: 'A-304' },
  { id: 2, cat: 'Výtah', loc: 'Vchod C', desc: 'Občas nedojede do přízemí, zasekne se mezi patry.', status: 'Nahlášeno', date: 'včera', by: 'C-118' },
  { id: 3, cat: 'Voda', loc: 'Garáž -1', desc: 'Kapající kohout u stání 12.', status: 'Vyřešeno', date: 'před týdnem', by: 'B-204' },
]

export const units: Unit[] = [
  { id: 'B-204', floor: '2. patro', tenant: 'Jana Nováková', rent: 24500, vs: '2042041', paid: true, due: '15.', end: '31. 8. 2026', endSoon: false },
  { id: 'A-101', floor: '1. patro', tenant: 'Petr Kalina', rent: 21000, vs: '1011011', paid: false, due: '15.', end: '28. 2. 2026', endSoon: true },
  { id: 'C-302', floor: '3. patro', tenant: 'Jan Kunčík', rent: 26800, vs: '3023021', paid: true, due: '20.', end: '30. 6. 2027', endSoon: false },
  { id: 'A-102', floor: '1. patro', tenant: 'Volné', rent: 22000, vs: '1021021', paid: false, due: '15.', end: '', endSoon: false },
  { id: 'B-205', floor: '2. patro', tenant: 'Eva Horáková', rent: 25200, vs: '2052051', paid: true, due: '10.', end: '15. 4. 2026', endSoon: true },
]

export const services: Service[] = [
  { id: 'uklid', name: 'Úklid domácnosti', from: 210, icon: 'sluzby', unit: '/h', desc: 'Pravidelný nebo jednorázový úklid bytu ověřeným pracovníkem.' },
  { id: 'handyman', name: 'Údržbář a drobné opravy', from: 390, icon: 'zavady', unit: '/h', desc: 'Montáže, drobné opravy, výměny. Přijedeme s nářadím.' },
  { id: 'okna', name: 'Mytí oken', from: 290, icon: 'water', unit: '/h', desc: 'Okna, rámy i parapety do čista, včetně těžko dostupných.' },
  { id: 'koberce', name: 'Čištění koberců', from: 350, icon: 'sluzby', unit: '/m²', desc: 'Hloubkové čištění koberců a čalounění přímo u vás.' },
  { id: 'odpad', name: 'Odvoz odpadu', from: 250, icon: 'doc', unit: '', desc: 'Vyklizení a odvoz objemného odpadu ze sklepa či bytu.' },
  { id: 'malovani', name: 'Malování', from: 450, icon: 'plus', unit: '/m²', desc: 'Vymalování bytu nebo společných prostor, materiál zajistíme.' },
]

export const bookings: Booking[] = [
  { id: 1, name: 'Úklid domácnosti', date: 'dokončeno 3. 3.', status: 'done', worker: 'Marek H.', rating: '4.9' },
]
export const meetings: Meeting[] = [
  { id: 1, date: '24. dubna 2026, 18:00', place: 'Společenská místnost', agenda: ['Roční vyúčtování za 2025', 'Stav fondu oprav', 'Rekonstrukce střechy'], rsvp: false },
]
export const documents: DocItem[] = [
  { name: 'Zápis ze schůze 11/2025', kind: 'PDF', date: '18. 11. 2025' },
  { name: 'Stanovy SVJ', kind: 'PDF', date: 'platné' },
  { name: 'Vyúčtování služeb 2024', kind: 'PDF', date: '5. 5. 2025' },
]
export const poll: Poll = { q: 'Souhlasíte s rekonstrukcí střechy za 1,8 mil. Kč z fondu oprav?', yes: 14, no: 5, voted: false }
export const neighbors: Neighbor[] = [
  { name: 'Jana Nováková', unit: 'B-204', floor: '2. patro', phone: '+420 604 111 222', shares: true },
  { name: 'Petr Kalina', unit: 'A-101', floor: '1. patro', phone: '+420 605 333 444', shares: true },
  { name: 'Jan Kunčík', unit: 'C-302', floor: '3. patro', phone: '+420 607 555 666', shares: false },
  { name: 'Eva Horáková', unit: 'B-205', floor: '2. patro', phone: '+420 608 777 888', shares: true },
]
export const residents: Resident[] = [
  { name: 'Jana Nováková', unit: 'B-204', role: 'Rezident' },
  { name: 'Petr Kalina', unit: 'A-101', role: 'Rezident' },
  { name: 'Jan Kunčík', unit: 'C-302', role: 'Rezident' },
  { name: 'Tomáš Dvořák', unit: 'A-304', role: 'Výbor SVJ' },
]
export const codes: AccessCode[] = [
  { code: 'TL-VP-7F3K', unit: 'B-204', used: true },
  { code: 'TL-VP-9K2M', unit: 'A-102', used: false },
]
export const notifications: AppNotification[] = [
  { icon: 'water', t: 'Odstávka vody', s: 'Čtvrtek 8 až 12' },
  { icon: 'bank', t: 'Platba přijata', s: 'Nájem B-204 spárován' },
  { icon: 'zavady', t: 'Závada aktualizována', s: 'Výtah C, v řešení' },
]
export const complaints: Record<string, ComplaintItem[]> = {
  'A-101': [
    { type: 'Hluk', date: '12. 1.', note: 'Hlasitá hudba po 22:00' },
    { type: 'Hluk', date: '3. 2.', note: 'Večírek do pozdních hodin' },
  ],
  'C-118': [{ type: 'Nepořádek', date: '20. 1.', note: 'Odpadky ponechané na chodbě' }],
}

// Payments (resident facing). payAccount is the account the QR platba points to.
export const payAccount = '2402042042/2010'
export const payRecipient = 'SV Vista Park'
export interface PayItemData { id: string; label: string; kind: string; amount: number; vs: string; due: string; recurring: boolean; status: 'unpaid' | 'paid'; msg: string }
export const myPayments: PayItemData[] = [
  { id: 'p-rent', label: 'Nájem, únor 2026', kind: 'najem', amount: 24500, vs: '2042041', due: '15.', recurring: true, status: 'unpaid', msg: 'Najem B-204 unor 2026' },
  { id: 'p-zal', label: 'Zálohy na služby', kind: 'zaloha', amount: 3200, vs: '2042042', due: '15.', recurring: true, status: 'unpaid', msg: 'Zalohy sluzby B-204' },
  { id: 'p-fond', label: 'Příspěvek do fondu oprav', kind: 'fond', amount: 1800, vs: '2042043', due: '15.', recurring: true, status: 'paid', msg: 'Fond oprav B-204' },
]
export const payHistory = [
  { id: 'h1', label: 'Nájem, leden 2026', amount: 24500, date: '3. 1. 2026' },
  { id: 'h2', label: 'Zálohy, leden 2026', amount: 3200, date: '3. 1. 2026' },
  { id: 'h3', label: 'Nájem, prosinec 2025', amount: 24500, date: '2. 12. 2025' },
]
