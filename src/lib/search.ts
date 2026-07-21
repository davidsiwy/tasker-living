// Globální vyhledávání v hlavičce. Načte (jednou, lazy) sousedy, dokumenty,
// oznámení a závady domu — u výboru/developera i jednotky — a pak filtruje
// lokálně při psaní. Žádné psaní vlastních SQL dotazů: znovupoužívá stejná
// api volání jako zbytek appky, takže respektuje stejná viditelnostní
// pravidla (např. dokumenty podle role) bez duplikace logiky.
import { api, feed } from './api'
import type { Neighbor, DocItem, FeedPost, Fault, UnitFull } from './types'

export interface SearchIndex {
  neighbors: Neighbor[]
  documents: DocItem[]
  posts: FeedPost[]
  faults: Fault[]
  units: UnitFull[]
}

export async function buildSearchIndex(buildingId: string, isCommittee: boolean): Promise<SearchIndex> {
  const [neighbors, documents, posts, faults, units] = await Promise.all([
    api.getNeighbors(buildingId).catch(() => []),
    api.getDocuments(buildingId).catch(() => []),
    feed.list(buildingId).catch(() => []),
    api.getFaults(buildingId).catch(() => []),
    isCommittee ? api.getUnitsFull(buildingId).catch(() => []) : Promise.resolve([] as UnitFull[]),
  ])
  return { neighbors, documents, posts, faults, units }
}

export type SearchKind = 'neighbor' | 'document' | 'post' | 'fault' | 'unit'
export interface SearchHit { kind: SearchKind; id: string; title: string; subtitle: string; icon: string; doc?: DocItem }

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const PER_KIND = 4

export function runSearch(idx: SearchIndex, query: string): SearchHit[] {
  const q = norm(query.trim())
  if (q.length < 2) return []
  const hit = (s: string) => norm(s || '').includes(q)
  const out: SearchHit[] = []

  let n = 0
  for (const x of idx.neighbors) {
    if (n >= PER_KIND) break
    if (hit(x.name) || hit(x.unit)) { out.push({ kind: 'neighbor', id: 'n' + x.unit + x.name, title: x.name, subtitle: `byt ${x.unit}`, icon: 'people' }); n++ }
  }
  n = 0
  for (const x of idx.documents) {
    if (n >= PER_KIND) break
    if (hit(x.name) || hit(x.cat || '')) { out.push({ kind: 'document', id: 'd' + (x.id || x.name), title: x.name, subtitle: x.cat || 'Dokument', icon: 'doc', doc: x }); n++ }
  }
  n = 0
  for (const x of idx.posts) {
    if (n >= PER_KIND) break
    if (hit(x.title || '') || hit(x.body)) { out.push({ kind: 'post', id: x.id, title: x.title || x.body.slice(0, 60), subtitle: 'Oznámení · ' + x.authorName, icon: 'bell' }); n++ }
  }
  n = 0
  for (const x of idx.faults) {
    if (n >= PER_KIND) break
    if (hit(x.desc) || hit(x.cat) || hit(x.loc)) { out.push({ kind: 'fault', id: x.id, title: x.desc.slice(0, 60), subtitle: `Závada · ${x.cat} · ${x.status}`, icon: 'wrench' }); n++ }
  }
  n = 0
  for (const x of idx.units) {
    if (n >= PER_KIND) break
    if (hit(x.label) || hit(x.tenant)) { out.push({ kind: 'unit', id: 'u' + x.id, title: x.label, subtitle: x.tenant || 'volná jednotka', icon: 'grid' }); n++ }
  }
  return out
}

export const KIND_LABEL: Record<SearchKind, string> = {
  neighbor: 'Sousedé', document: 'Dokumenty', post: 'Oznámení', fault: 'Závady', unit: 'Jednotky',
}
