// Operátor / Aktivita a Operátoři.
import { useEffect, useState } from 'react'
import { platformApi, operatorApi } from '../../lib/platformApi'
import type { ActivityRow, OperatorRow, PlatformUser } from '../../lib/platformApi'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'
import { useSession } from '../../state/session'
import { ActRow, KIND_LABEL } from './OperatorShell'

export function ActivityPage() {
  const toast = useToast()
  const [acts, setActs] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    platformApi.activity()
      .then(setActs)
      .catch((e: any) => toast('Načtení selhalo: ' + (e.message || e)))
      .finally(() => setLoading(false))
  }, [])

  const filtered = acts.filter((a) =>
    (!kind || a.kind === kind) &&
    (!q || a.actor.toLowerCase().includes(q.toLowerCase()) || a.detail.toLowerCase().includes(q.toLowerCase())))

  return (
    <div>
      <div className="view-head"><div><h1>Aktivita</h1><div className="desc">Dění napříč celou platformou</div></div></div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 2, minWidth: 180 }} placeholder="Hledat osobu nebo obsah" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" style={{ flex: 1, minWidth: 140 }} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Všechny typy</option>
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h3>Události</h3><span className="adm-mini">{filtered.length}</span></div>
        {loading && <p className="spin">Načítání</p>}
        {!loading && filtered.map((a, i) => <ActRow key={i} a={a} />)}
        {!loading && filtered.length === 0 && <p className="adm-mini">Nic nenalezeno.</p>}
      </div>
    </div>
  )
}

export function OperatorsPage() {
  const toast = useToast()
  const { user } = useSession()
  const me = user?.userId || ''
  const [ops, setOps] = useState<OperatorRow[]>([])
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [pick, setPick] = useState('')
  const [loading, setLoading] = useState(true)

  async function reload() {
    const [o, u] = await Promise.all([operatorApi.listOperators(), platformApi.listUsers()])
    setOps(o); setUsers(u); setLoading(false)
  }
  useEffect(() => { reload().catch((e: any) => { setLoading(false); toast('Načtení selhalo: ' + (e.message || e)) }) }, [])

  const candidates = users.filter((u) => !ops.some((o) => o.userId === u.id))

  async function run(fn: () => Promise<void>, ok: string) {
    try { await fn(); toast(ok); await reload() } catch (e: any) { toast('Chyba: ' + (e.message || e)) }
  }

  return (
    <div>
      <div className="view-head"><div><h1>Operátoři</h1><div className="desc">Kdo má přístup do této konzole a správě celé platformy</div></div></div>
      <div className="grid-2">
        <div className="card">
          <div className="card-h"><h3>Aktivní operátoři</h3><span className="adm-mini">{ops.length}</span></div>
          {loading && <p className="spin">Načítání</p>}
          {ops.map((o) => (
            <div className="doc-row" key={o.userId}>
              <span className="cf-ic"><Icon name="sprava" small /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontWeight: 600 }}>{o.name || o.email || 'Bez jména'}{o.userId === me ? ' (vy)' : ''}</b>
                <span>{o.email}{o.since ? ' · od ' + o.since : ''}</span>
              </div>
              {o.userId !== me && (
                <button className="btn btn-ghost btn-sm"
                  onClick={() => window.confirm('Odebrat operátorský přístup pro ' + (o.name || o.email) + '?') && run(() => operatorApi.removeOperator(o.userId), 'Přístup odebrán')}>
                  Odebrat
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-h"><h3>Přidat operátora</h3></div>
          <p className="adm-mini" style={{ marginBottom: 10 }}>Operátor vidí a spravuje všechny organizace, účty a data platformy. Dávejte jen důvěryhodným lidem.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input" style={{ flex: 1 }} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Vyberte účet</option>
              {candidates.map((u) => <option key={u.id} value={u.id}>{(u.name ? u.name + ' · ' : '') + u.email}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" disabled={!pick}
              onClick={() => run(() => operatorApi.addOperator(pick), 'Operátor přidán').then(() => setPick(''))}>
              Přidat
            </button>
          </div>
          <p className="adm-mini" style={{ marginTop: 10 }}>Účet pro nového operátora nejdřív založte v Klientech, pak ho tady povyšte.</p>
        </div>
      </div>
    </div>
  )
}
