// Operátor / Přehled: platform metrics, 14 day activity chart, latest events.
import { useEffect, useState } from 'react'
import { platformApi } from '../../lib/platformApi'
import type { PlatformUser, PlatformBuilding, ActivityRow } from '../../lib/platformApi'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'
import { ActRow } from './OperatorShell'

export default function OverviewPage() {
  const toast = useToast()
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [buildings, setBuildings] = useState<PlatformBuilding[]>([])
  const [acts, setActs] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([platformApi.listUsers(), platformApi.listBuildings(), platformApi.activity()])
      .then(([u, b, a]) => { setUsers(u); setBuildings(b); setActs(a) })
      .catch((e: any) => toast('Načtení selhalo: ' + (e.message || e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="card"><p className="adm-mini">Načítání platformy...</p></div>

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)
  const active7 = new Set(users.filter((u) => u.lastLoginIso && new Date(u.lastLoginIso) > weekAgo).map((u) => u.id)).size
  const new7 = users.filter((u) => u.createdIso && new Date(u.createdIso) > weekAgo).length
  const totalUnits = buildings.reduce((s, b) => s + b.units, 0)
  const totalPosts = buildings.reduce((s, b) => s + b.posts, 0)

  const stats = [
    { k: 'Účty celkem', v: users.length, ic: 'kontakty' },
    { k: 'Aktivní za 7 dní', v: active7, ic: 'check' },
    { k: 'Noví za 7 dní', v: new7, ic: 'plus' },
    { k: 'Organizace', v: buildings.length, ic: 'bank' },
    { k: 'Jednotky', v: totalUnits, ic: 'najmy' },
    { k: 'Příspěvky', v: totalPosts, ic: 'nastenka' },
  ]

  // 14 day event chart from raw timestamps
  const days: { label: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const next = new Date(d.getTime() + 86400000)
    const count = acts.filter((a) => { const t = new Date(a.iso); return t >= d && t < next }).length
    days.push({ label: d.getDate() + '.', count })
  }
  const max = Math.max(1, ...days.map((d) => d.count))

  return (
    <div>
      <div className="view-head"><div><h1>Přehled</h1><div className="desc">Stav celé platformy Tasker Living</div></div></div>

      <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {stats.map((s) => (
          <div className="card" key={s.k}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="cf-ic"><Icon name={s.ic} small /></span>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{s.v}</div><div className="adm-mini">{s.k}</div></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-h"><h3>Dění za 14 dní</h3><span className="adm-mini">{days.reduce((s, d) => s + d.count, 0)} událostí</span></div>
          <svg viewBox="0 0 280 70" style={{ width: '100%', height: 90 }} preserveAspectRatio="none">
            {days.map((d, i) => {
              const h = Math.round((d.count / max) * 52)
              return <rect key={i} x={i * 20 + 3} y={56 - h} width={14} height={Math.max(h, 2)} rx={2}
                fill="var(--brand, #2f9e63)" opacity={d.count ? 0.9 : 0.25} />
            })}
            {days.map((d, i) => (i % 2 === 0
              ? <text key={'t' + i} x={i * 20 + 10} y={68} fontSize={7} textAnchor="middle" fill="currentColor" opacity={0.5}>{d.label}</text>
              : null))}
          </svg>
          <p className="adm-mini">Registrace, přihlášení, příspěvky a nová členství dohromady.</p>
        </div>

        <div className="card">
          <div className="card-h"><h3>Organizace</h3></div>
          {buildings.map((b) => (
            <div className="doc-row" key={b.id}>
              <span className="cf-ic"><Icon name="bank" small /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontWeight: 600 }}>{b.name}</b>
                <span>{b.members} členů · {b.units} jednotek · {b.posts} příspěvků</span>
              </div>
            </div>
          ))}
          {buildings.length === 0 && <p className="adm-mini">Žádné organizace.</p>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><h3>Poslední dění</h3></div>
        {acts.slice(0, 10).map((a, i) => <ActRow key={i} a={a} />)}
        {acts.length === 0 && <p className="adm-mini">Zatím žádná aktivita.</p>}
      </div>
    </div>
  )
}
