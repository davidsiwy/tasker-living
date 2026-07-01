// Operator (admin) datasets for the management console. Mock for now, shaped the
// way the real Postgres tables will be so the console can move to live data by
// swapping these reads, not the UI.

export interface PBuilding { id: string; name: string; city: string; units: number }
export interface AUnit { id: string; floor: string; area: number; type: 'Byt' | 'Parking' | 'Sklep' | 'Komerce'; owner: string; tenant: string; rent: number; vs: string; paid: boolean; leaseEnd: string; endSoon: boolean; share: number; deposit: number; water: string; heat: string }
export interface AMember { name: string; unit: string; role: 'Vlastník' | 'Nájemník' | 'Výbor'; email: string; phone: string; status: 'Aktivní' | 'Pozván' | 'Čeká'; since: string }
export interface ACode { code: string; unit: string; role: string; status: 'Aktivní' | 'Použit' | 'Zrušen'; expires: string }
export interface ATxn { id: string; date: string; party: string; amount: number; vs: string; unit: string | null }
export interface AExpense { name: string; amount: number; date: string }
export interface ARevize { type: string; last: string; next: string; soon: boolean; provider: string; status: 'Platná' | 'Blíží se' | 'Po termínu' }
export interface AVendor { name: string; field: string; phone: string; rating: string }
export interface AActivity { icon: string; actor: string; action: string; target: string; time: string }
export interface ADoc { name: string; date: string; size: string }
export interface ADocCat { name: string; icon: string; docs: ADoc[] }

export const portfolio: PBuilding[] = [
  { id: 'vp', name: 'Rezidence Vista Park', city: 'Praha 5, Košíře', units: 40 },
  { id: 'hr', name: 'Rezidence Hřebenky', city: 'Praha 5, Smíchov', units: 18 },
  { id: 'nv', name: 'Bytový dům Nový Vojířov', city: 'Nový Vojířov', units: 6 },
]

export const profile = {
  name: 'Rezidence Vista Park',
  address: 'Vrchlického 12, 150 00 Praha 5, Košíře',
  ico: '19 284 771',
  svj: 'Společenství vlastníků Vista Park',
  account: '2402042042 / 2010',
  contactEmail: 'sprava@vistapark.cz',
  contactPhone: '+420 604 100 200',
  unitsCount: 40,
}

export const units: AUnit[] = [
  { id: 'A-101', floor: '1. patro', area: 54, type: 'Byt', owner: 'Petr Kalina', tenant: 'Petr Kalina', rent: 0, vs: '1011011', paid: true, leaseEnd: 'vlastník', endSoon: false, share: 2.1, deposit: 0, water: '124 m³', heat: '4,2 MWh' },
  { id: 'A-102', floor: '1. patro', area: 58, type: 'Byt', owner: 'Gallery Point', tenant: 'Volné', rent: 22000, vs: '1021021', paid: false, leaseEnd: '', endSoon: false, share: 2.3, deposit: 0, water: '0 m³', heat: '0 MWh' },
  { id: 'B-204', floor: '2. patro', area: 68, type: 'Byt', owner: 'Gallery Point', tenant: 'Jana Nováková', rent: 24500, vs: '2042041', paid: true, leaseEnd: '31. 8. 2026', endSoon: false, share: 2.7, deposit: 49000, water: '96 m³', heat: '3,8 MWh' },
  { id: 'B-205', floor: '2. patro', area: 71, type: 'Byt', owner: 'Eva Horáková', tenant: 'Eva Horáková', rent: 0, vs: '2052051', paid: true, leaseEnd: 'vlastník', endSoon: false, share: 2.8, deposit: 0, water: '112 m³', heat: '4,0 MWh' },
  { id: 'C-302', floor: '3. patro', area: 82, type: 'Byt', owner: 'Gallery Point', tenant: 'Jan Kunčík', rent: 26800, vs: '3023021', paid: true, leaseEnd: '30. 6. 2027', endSoon: false, share: 3.2, deposit: 53600, water: '78 m³', heat: '3,4 MWh' },
  { id: 'C-118', floor: '1. patro', area: 63, type: 'Byt', owner: 'Gallery Point', tenant: 'Tomáš Blažek', rent: 23500, vs: '1181181', paid: false, leaseEnd: '28. 2. 2026', endSoon: true, share: 2.5, deposit: 47000, water: '88 m³', heat: '3,6 MWh' },
  { id: 'D-410', floor: '4. patro', area: 95, type: 'Byt', owner: 'Gallery Point', tenant: 'Volné', rent: 31000, vs: '4104101', paid: false, leaseEnd: '', endSoon: false, share: 3.7, deposit: 0, water: '0 m³', heat: '0 MWh' },
  { id: 'PS-12', floor: 'Garáž -1', area: 13, type: 'Parking', owner: 'Jana Nováková', tenant: 'Jana Nováková', rent: 0, vs: '9012901', paid: true, leaseEnd: 'vlastník', endSoon: false, share: 0.4, deposit: 0, water: '', heat: '' },
  { id: 'PS-18', floor: 'Garáž -1', area: 13, type: 'Parking', owner: 'Gallery Point', tenant: 'Jan Kunčík', rent: 2200, vs: '9018901', paid: true, leaseEnd: '30. 6. 2027', endSoon: false, share: 0.4, deposit: 0, water: '', heat: '' },
  { id: 'K-01', floor: 'Přízemí', area: 46, type: 'Komerce', owner: 'Gallery Point', tenant: 'Kavárna Zrno s.r.o.', rent: 38000, vs: '5015011', paid: true, leaseEnd: '31. 12. 2028', endSoon: false, share: 1.9, deposit: 114000, water: '210 m³', heat: '6,1 MWh' },
]

export const members: AMember[] = [
  { name: 'Jana Nováková', unit: 'B-204', role: 'Nájemník', email: 'jana.novakova@email.cz', phone: '+420 604 111 222', status: 'Aktivní', since: '3. 9. 2025' },
  { name: 'Petr Kalina', unit: 'A-101', role: 'Vlastník', email: 'petr.kalina@email.cz', phone: '+420 605 333 444', status: 'Aktivní', since: '1. 6. 2025' },
  { name: 'Eva Horáková', unit: 'B-205', role: 'Výbor', email: 'eva.horakova@email.cz', phone: '+420 608 777 888', status: 'Aktivní', since: '1. 6. 2025' },
  { name: 'Jan Kunčík', unit: 'C-302', role: 'Nájemník', email: 'jan.kuncik@email.cz', phone: '+420 607 555 666', status: 'Aktivní', since: '15. 7. 2025' },
  { name: 'Tomáš Blažek', unit: 'C-118', role: 'Nájemník', email: 'tomas.blazek@email.cz', phone: '+420 602 909 808', status: 'Aktivní', since: '1. 3. 2025' },
  { name: 'Tomáš Dvořák', unit: 'A-304', role: 'Výbor', email: 'tomas.dvorak@email.cz', phone: '+420 603 121 314', status: 'Aktivní', since: '1. 6. 2025' },
  { name: 'Kavárna Zrno s.r.o.', unit: 'K-01', role: 'Nájemník', email: 'provoz@zrno.cz', phone: '+420 776 222 111', status: 'Aktivní', since: '1. 1. 2025' },
  { name: 'Marta Nová', unit: 'D-410', role: 'Nájemník', email: 'marta.nova@email.cz', phone: '', status: 'Pozván', since: 'čeká' },
]

export const codes: ACode[] = [
  { code: 'TL-VP-7F3K', unit: 'B-204', role: 'Rezident', status: 'Použit', expires: 'použit 3. 9.' },
  { code: 'TL-VP-9K2M', unit: 'A-102', role: 'Rezident', status: 'Aktivní', expires: '31. 3. 2026' },
  { code: 'TL-VP-4H8P', unit: 'D-410', role: 'Rezident', status: 'Aktivní', expires: '15. 2. 2026' },
  { code: 'TL-VP-2C5X', unit: 'nepřiřazeno', role: 'Rezident', status: 'Aktivní', expires: '30. 4. 2026' },
  { code: 'TL-VP-VYBOR', unit: 'výbor', role: 'Výbor SVJ', status: 'Aktivní', expires: 'trvalý' },
]

export const transactions: ATxn[] = [
  { id: 't1', date: '1. 2. 2026', party: 'Jana Nováková', amount: 24500, vs: '2042041', unit: 'B-204' },
  { id: 't2', date: '1. 2. 2026', party: 'Jan Kunčík', amount: 26800, vs: '3023021', unit: 'C-302' },
  { id: 't3', date: '2. 2. 2026', party: 'Kavárna Zrno s.r.o.', amount: 38000, vs: '5015011', unit: 'K-01' },
  { id: 't4', date: '2. 2. 2026', party: 'Jan Kunčík', amount: 2200, vs: '9018901', unit: 'PS-18' },
  { id: 't5', date: '3. 2. 2026', party: 'J. Novák', amount: 23500, vs: '0000000', unit: null },
  { id: 't6', date: '3. 2. 2026', party: 'Platba QR', amount: 24500, vs: '2042041', unit: 'B-204' },
  { id: 't7', date: '4. 2. 2026', party: 'T. Blazek', amount: 12000, vs: '1181000', unit: null },
]

export const fund = {
  balance: 842300,
  contributionsMonthly: 48200,
  expenses: [
    { name: 'Oprava stoupačky, vchod C', amount: 18400, date: '28. 1.' },
    { name: 'Úklid společných prostor', amount: 6500, date: '25. 1.' },
    { name: 'Revize hasicích přístrojů', amount: 4200, date: '20. 1.' },
    { name: 'Elektřina společné prostory', amount: 5800, date: '15. 1.' },
  ] as AExpense[],
}

export const revize: ARevize[] = [
  { type: 'Výtah, vchod A a C', last: '14. 3. 2025', next: '14. 3. 2026', soon: true, provider: 'VýtahServis s.r.o.', status: 'Blíží se' },
  { type: 'Hasicí přístroje a hydranty', last: '20. 1. 2026', next: '20. 1. 2027', soon: false, provider: 'PO Bezpečně', status: 'Platná' },
  { type: 'Elektro revize společných částí', last: '8. 6. 2023', next: '8. 6. 2026', soon: false, provider: 'ElektroRevize Praha', status: 'Platná' },
  { type: 'Revize plynového rozvodu', last: '2. 12. 2022', next: '2. 12. 2025', soon: false, provider: 'GasKontrol', status: 'Po termínu' },
  { type: 'Hromosvod a uzemnění', last: '11. 9. 2022', next: '11. 9. 2026', soon: false, provider: 'ElektroRevize Praha', status: 'Platná' },
  { type: 'Kontrola vzduchotechniky', last: '5. 5. 2025', next: '5. 5. 2026', soon: true, provider: 'KlimaTech', status: 'Blíží se' },
]

export const vendors: AVendor[] = [
  { name: 'VýtahServis s.r.o.', field: 'Výtahy', phone: '+420 731 400 500', rating: '4.8' },
  { name: 'Instalatér Novák', field: 'Voda a topení', phone: '+420 604 700 800', rating: '4.9' },
  { name: 'ElektroRevize Praha', field: 'Elektro a revize', phone: '+420 720 300 100', rating: '4.7' },
  { name: 'Tasker Úklid', field: 'Úklid a údržba', phone: '+420 800 100 100', rating: '4.9' },
  { name: 'PO Bezpečně', field: 'Požární ochrana', phone: '+420 777 909 090', rating: '4.6' },
]

export const activity: AActivity[] = [
  { icon: 'zavady', actor: 'Jana Nováková', action: 'nahlásila závadu', target: 'Výtah C', time: 'před 2 h' },
  { icon: 'bank', actor: 'Systém', action: 'spároval platbu', target: 'B-204, dle VS', time: 'před 5 h' },
  { icon: 'nastenka', actor: 'Výbor SVJ', action: 'publikoval oznámení', target: 'Odstávka vody', time: 'včera' },
  { icon: 'sluzby', actor: 'Eva Horáková', action: 'objednala úklid', target: 'B-205', time: 'včera' },
  { icon: 'kontakty', actor: 'Tomáš Blažek', action: 'se připojil do aplikace', target: 'C-118', time: 'před 2 dny' },
  { icon: 'stiznosti', actor: 'Anonymně', action: 'podal stížnost', target: 'A-101, hluk', time: 'před 3 dny' },
  { icon: 'schuze', actor: 'Výbor SVJ', action: 'naplánoval schůzi', target: '24. dubna', time: 'před 4 dny' },
  { icon: 'najmy', actor: 'Systém', action: 'upozornil na konec smlouvy', target: 'C-118', time: 'před 5 dny' },
]

export const docCats: ADocCat[] = [
  { name: 'Stanovy a právní', icon: 'doc', docs: [{ name: 'Stanovy SVJ Vista Park', date: 'platné', size: '320 kB' }, { name: 'Prohlášení vlastníka', date: '2024', size: '1,1 MB' }] },
  { name: 'Zápisy ze schůzí', icon: 'schuze', docs: [{ name: 'Zápis 11/2025', date: '18. 11. 2025', size: '210 kB' }, { name: 'Zápis 05/2025', date: '12. 5. 2025', size: '198 kB' }] },
  { name: 'Vyúčtování', icon: 'bank', docs: [{ name: 'Vyúčtování služeb 2024', date: '5. 5. 2025', size: '540 kB' }] },
  { name: 'Revize a technika', icon: 'sprava', docs: [{ name: 'Revize výtahu 2025', date: '14. 3. 2025', size: '160 kB' }, { name: 'Elektro revize 2023', date: '8. 6. 2023', size: '145 kB' }] },
  { name: 'Pojištění', icon: 'check', docs: [{ name: 'Pojistná smlouva domu', date: 'platná do 2027', size: '380 kB' }] },
  { name: 'Nájemní smlouvy', icon: 'najmy', docs: [{ name: 'Smlouva B-204', date: '2025', size: '290 kB' }, { name: 'Smlouva K-01 Kavárna', date: '2025', size: '410 kB' }] },
]

export const integrations = [
  { id: 'fio', name: 'Fio banka', desc: 'Automatické párování plateb podle VS', on: true, tag: 'Připojeno' },
  { id: 'tasker', name: 'Tasker dispatch', desc: 'Odesílání ověřených pracovníků k rezidentům', on: true, tag: 'Aktivní' },
  { id: 'stripe', name: 'Stripe', desc: 'Platby kartou za služby a nájem', on: false, tag: 'Nepřipojeno' },
  { id: 'gocardless', name: 'GoCardless', desc: 'Bankovní data podle PSD2 pro ostatní banky', on: false, tag: 'Nepřipojeno' },
]
