import { api, feed, currentPeriod } from './api'
import { adminApi } from './adminApi'
import { supabase, isSupabaseConfigured } from './supabase'

// Kompletní export dat domu (slib z webu: „data vám vyexportujeme").
// Jeden ZIP: čitelné CSV pro lidi, export.json pro stroje, soubory dokumentů.
// Nic z toho nezůstává u nás jako rukojmí — proto je to samoobslužné tlačítko.

type Prog = (msg: string) => void

const BOM = '\uFEFF'
const cell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
const csv = (head: string[], rows: unknown[][]): string =>
  BOM + head.join(';') + '\n' + rows.map((r) => r.map(cell).join(';')).join('\n') + (rows.length ? '\n' : '')

const stamp = () => {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'soubor'

export async function exportBuilding(
  buildingId: string,
  buildingName: string,
  onProgress: Prog,
): Promise<{ blob: Blob; filename: string; note?: string }> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const full: Record<string, unknown> = { building: buildingName, exportedAt: new Date().toISOString() }

  onProgress('Načítám jednotky a členy…')
  const [units, members, neighbors, settings] = await Promise.all([
    api.getUnitsFull(buildingId),
    adminApi.listMembers(buildingId).catch(() => []),
    api.getNeighbors(buildingId).catch(() => []),
    api.getBuildingSettings(buildingId).catch(() => ({ account: '', recipient: '' })),
  ])
  const unitLabel = new Map(units.map((u) => [u.id, u.label]))
  full.units = units; full.members = members; full.neighbors = neighbors; full.settings = settings
  zip.file('jednotky.csv', csv(
    ['jednotka', 'patro', 'najemnik_vlastnik', 'najem_kc', 'vs', 'podil_pct', 'konec_smlouvy'],
    units.map((u) => [u.label, u.floor, u.tenant, u.rent || '', u.vs, u.share || '', u.leaseEnd]),
  ))
  zip.file('clenove.csv', csv(
    ['jmeno', 'email', 'jednotka', 'role', 'clenem_od'],
    (members as any[]).map((m) => [m.name, m.email || '', m.unit || '', m.role, m.since || '']),
  ))
  zip.file('sousede.csv', csv(
    ['jmeno', 'jednotka', 'patro', 'telefon', 'sdili_kontakt'],
    (neighbors as any[]).map((n) => [n.name, n.unit, n.floor, n.shares ? n.phone : '', n.shares ? 'ano' : 'ne']),
  ))

  onProgress('Načítám platby…')
  let chargeRows: unknown[][] = []
  if (isSupabaseConfigured) {
    const { data } = await supabase!.from('charges')
      .select('label, amount, vs, period, due_date, status, units(label)')
      .eq('building_id', buildingId).order('period').order('created_at')
    chargeRows = (data || []).map((c: any) => [c.units?.label || '', c.period, c.label, c.amount, c.vs || '', c.due_date || '', c.status])
    full.charges = data || []
  } else {
    const cs = await api.getCharges(buildingId, currentPeriod())
    chargeRows = cs.map((c) => [c.unitLabel, c.period, c.label, c.amount, c.vs, c.due, c.status])
    full.charges = cs
  }
  zip.file('platby.csv', csv(['jednotka', 'obdobi', 'polozka', 'castka_kc', 'vs', 'splatnost', 'stav'], chargeRows))

  onProgress('Načítám oznámení a čtenost…')
  const posts = await feed.list(buildingId).catch(() => [])
  full.posts = posts
  zip.file('oznameni.csv', csv(
    ['nadpis', 'text', 'komu', 'push', 'autor', 'odeslano', 'precetlo_bytu'],
    posts.map((p) => [p.title || '', p.body, p.audience || 'all', p.push === false ? 'ne' : 'ano', p.authorName, p.createdAt, p.reads ?? '']),
  ))
  const readRows: unknown[][] = []
  for (const p of posts) {
    const rs = await feed.readStats(p.id).catch(() => [])
    for (const r of rs) readRows.push([p.title || p.body.slice(0, 40), r.unitLabel, r.state, r.readAt || ''])
  }
  if (readRows.length) zip.file('ctenost.csv', csv(['oznameni', 'jednotka', 'stav', 'precteno_kdy'], readRows))

  onProgress('Načítám závady a hlasování…')
  const faults = await api.getFaults(buildingId).catch(() => [])
  full.faults = faults
  zip.file('zavady.csv', csv(
    ['popis', 'kategorie', 'misto', 'nahlasil', 'datum', 'stav', 'dodavatel', 'fotky_url'],
    faults.map((f) => [f.desc, f.cat, f.loc, f.by, f.date, f.status, f.vendor || '', (f.photos || []).join(' ')]),
  ))

  let polls: any[] = []
  if (isSupabaseConfigured) {
    const { data: ps } = await supabase!.from('polls')
      .select('id, question, quorum, open, created_at').eq('building_id', buildingId).order('created_at')
    const ids = (ps || []).map((p: any) => p.id)
    const [{ data: bs }, { data: xs }] = ids.length
      ? await Promise.all([
          supabase!.from('ballots').select('poll_id, unit_id, choice').in('poll_id', ids),
          supabase!.from('proxies').select('poll_id, from_unit, to_unit').in('poll_id', ids),
        ])
      : [{ data: [] }, { data: [] }] as any
    polls = (ps || []).map((p: any) => ({
      question: p.question, quorum: p.quorum, open: p.open, created: p.created_at,
      ballots: (bs || []).filter((b: any) => b.poll_id === p.id).map((b: any) => ({ unit: unitLabel.get(b.unit_id) || b.unit_id, choice: b.choice })),
      proxies: (xs || []).filter((x: any) => x.poll_id === p.id).map((x: any) => ({ from: unitLabel.get(x.from_unit) || x.from_unit, to: unitLabel.get(x.to_unit) || x.to_unit })),
    }))
  } else {
    const v = await api.getVote(buildingId)
    if (v) polls = [{
      question: v.q, quorum: v.quorum, open: v.open,
      ballots: Object.entries(v.ballots).map(([unit, choice]) => ({ unit, choice })),
      proxies: Object.entries(v.proxies).map(([from, to]) => ({ from, to })),
    }]
  }
  full.polls = polls
  zip.file('hlasovani.csv', csv(
    ['usneseni', 'kvorum_pct', 'stav', 'jednotka', 'hlas', 'plna_moc_od'],
    polls.flatMap((p) => {
      const proxyFor = new Map(p.proxies.map((x: any) => [x.to, x.from]))
      const rows = p.ballots.map((b: any) => [p.question, p.quorum, p.open ? 'otevřené' : 'uzavřené', b.unit, b.choice, proxyFor.get(b.unit) || ''])
      return rows.length ? rows : [[p.question, p.quorum, p.open ? 'otevřené' : 'uzavřené', '', '', '']]
    }),
  ))

  onProgress('Načítám schůze, soužití a objednávky…')
  const [meetings, complaints, bookings] = await Promise.all([
    api.getMeetings(buildingId).catch(() => []),
    api.getComplaints(buildingId).catch(() => ({} as Record<string, any[]>)),
    api.getBookings(buildingId).catch(() => []),
  ])
  full.meetings = meetings; full.complaints = complaints; full.bookings = bookings
  zip.file('schuze.csv', csv(['termin', 'misto', 'program'], meetings.map((m) => [m.date, m.place, m.agenda.join(' | ')])))
  zip.file('souziti.csv', csv(
    ['jednotka', 'typ', 'datum', 'poznamka'],
    Object.entries(complaints).flatMap(([u, items]) => (items as any[]).map((c) => [u, c.type, c.date, c.note || ''])),
  ))
  zip.file('objednavky.csv', csv(
    ['sluzba', 'termin', 'pracovnik', 'hodnoceni', 'stav'],
    (bookings as any[]).map((b) => [b.name, b.date, b.worker || '', b.rating || '', b.status]),
  ))

  onProgress('Stahuji dokumenty…')
  const docs = await api.getDocuments(buildingId, 'vybor').catch(() => [])
  full.documents = docs.map((d) => ({ name: d.name, cat: d.cat, date: d.date, vis: d.vis }))
  zip.file('dokumenty.csv', csv(
    ['nazev', 'kategorie', 'datum', 'viditelnost'],
    docs.map((d) => [d.name, d.cat || '', d.date, (d.vis || []).join(', ')]),
  ))
  let filesIn = 0
  const missing: string[] = []
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i]
    onProgress(`Stahuji dokumenty… (${i + 1}/${docs.length})`)
    try {
      const url = await api.openDocument(d)
      if (!url) { missing.push(d.name); continue }
      const res = await fetch(url)
      if (!res.ok) throw new Error(String(res.status))
      zip.file(`dokumenty/${String(i + 1).padStart(2, '0')}-${slug(d.name)}`, await res.blob())
      filesIn++
    } catch { missing.push(d.name) }
  }
  if (missing.length) zip.file('dokumenty-chybejici.txt', BOM + 'Tyto dokumenty se nepodařilo přibalit (ukázkové nebo nedostupné):\n' + missing.map((m) => '- ' + m).join('\n') + '\n')

  zip.file('export.json', JSON.stringify(full, null, 2))
  zip.file('README.txt', BOM + `Kompletní export dat domu ${buildingName}
Vygenerováno aplikací Tasker Living, ${new Date().toLocaleString('cs-CZ')}.

Obsah:
- jednotky.csv, clenove.csv, sousede.csv — kdo v domě je
- platby.csv — všechny předpisy a jejich stav
- oznameni.csv + ctenost.csv — co se poslalo a kdo si to přečetl (po bytech)
- zavady.csv — historie závad včetně odkazů na fotky
- hlasovani.csv — usnesení, hlasy po jednotkách, plné moci
- schuze.csv, souziti.csv, objednavky.csv
- dokumenty.csv + složka dokumenty/ se soubory
- export.json — všechna data strojově čitelně

CSV jsou oddělená středníkem s UTF-8 BOM, otevřou se správně v Excelu.
Osobní notifikace jednotlivých uživatelů se neexportují.

Ukončení služby: napište na info@tasker.cz a do 30 dnů smažeme všechna
data domu z databáze i úložiště. Tento export je váš — data nedržíme.
`)

  onProgress('Balím ZIP…')
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const note = docs.length && !filesIn ? 'dokumenty jen jako seznam (ukázková data)' : filesIn ? `${filesIn} souborů dokumentů přibaleno` : undefined
  return { blob, filename: `tasker-living-export-${slug(buildingName)}-${stamp()}.zip`, note }
}
