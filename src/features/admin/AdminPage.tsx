import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, currentPeriod, periodLabel } from '../../lib/api'
import { can } from '../../lib/types'
import type { Role, Fault, UnitFull, Charge, FundEntry } from '../../lib/types'
import { czPlural, faultStatusLabel, chargeStatusLabel } from '../../lib/types'
import { adminApi } from '../../lib/adminApi'
import type { LiveMember, LiveCode, LiveUnit } from '../../lib/adminApi'
import * as A from '../../lib/adminData'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'
import { SIcon } from '../../components/AppShell'
import { exportBuilding } from '../../lib/exportBuilding'
import { BankCard } from '../../components/BankCard'

const money = (n: number, lng: string) => n.toLocaleString(lng) + ' Kč'
type Toast = (m: string) => void
type T = (k: string, o?: Record<string, unknown>) => string

const TAB_IDS = ['prehled', 'jednotky', 'lide', 'finance', 'fond', 'udrzba', 'schuze', 'nastenka', 'dokumenty', 'nastaveni']

export default function AdminPage() {
  const { t } = useTranslation(['admin', 'common'])
  const { user, isDemo } = useSession()
  const toast = useToast()
  const [params] = useSearchParams()
  const initialTab = params.get('tab')
  const [tab, setTab] = useState(TAB_IDS.includes(initialTab || '') ? initialTab! : 'prehled')

  if (!user || !can(user.role as Role, 'admin')) {
    return (
      <div className="d-mini an" style={{ maxWidth: 520 }}>
        <div className="h"><b>{t('admin:noAccessTitle')}</b></div>
        <p style={{ fontSize: 12.5, color: 'var(--s-ink-2)', marginTop: 8, lineHeight: 1.55 }}>
          {t('admin:noAccessBody')}
        </p>
      </div>
    )
  }
  const bid = user.buildingId

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>{t('admin:title')}</h2>
          <p>{t('admin:subtitle')}</p>
        </div>
        <span className="s-badge neutral">{user.buildingName}</span>
      </div>

      <div className="ad-tabs">
        {TAB_IDS.map((id) => <button key={id} className={'ad-tab' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>{t(`admin:tabs.${id}`)}</button>)}
      </div>

      <div className="ad-wrap">
        {tab === 'prehled' && <Overview toast={toast} bid={bid} />}
        {tab === 'jednotky' && <Units toast={toast} bid={bid} />}
        {tab === 'lide' && <People toast={toast} />}
        {tab === 'finance' && <Finance toast={toast} bid={bid} />}
        {tab === 'fond' && <ReserveFundTab toast={toast} bid={bid} />}
        {tab === 'udrzba' && <Maintenance toast={toast} bid={bid} isDemo={isDemo} />}
        {tab === 'schuze' && <MeetingsAdmin />}
        {tab === 'nastenka' && <Board />}
        {tab === 'dokumenty' && <DocumentsAdmin />}
        {tab === 'nastaveni' && <BuildingSettingsTab toast={toast} bid={bid} isDemo={isDemo} buildingName={user.buildingName} />}
      </div>
    </>
  )
}

/* ---------------- Přehled ---------------- */
function Overview({ toast, bid }: { toast: Toast; bid: string }) {
  const { t, i18n } = useTranslation(['admin', 'common'])
  const [units, setUnits] = useState<UnitFull[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [faults, setFaults] = useState<Fault[]>([])
  const [complaints, setComplaints] = useState(0)
  const [codes, setCodes] = useState<LiveCode[]>([])
  const period = currentPeriod()

  useEffect(() => {
    Promise.all([
      api.getUnitsFull(bid), api.getCharges(bid, period), api.getFaults(bid),
      api.getComplaintsCount(bid), adminApi.listCodes(bid),
    ]).then(([u, c, f, cc, cd]) => { setUnits(u); setCharges(c); setFaults(f); setComplaints(cc); setCodes(cd) })
      .catch((e: any) => toast(t('admin:overview.loadFailed', { err: e.message || e })))
  }, [bid])

  const occupied = units.filter((u) => u.tenant)
  const rentRoll = charges.reduce((s, c) => s + c.amount, 0)
  const collected = charges.filter((c) => c.status === 'paid').reduce((s, c) => s + c.amount, 0)
  const unpaid = charges.filter((c) => c.status !== 'paid')
  const faultsOpen = faults.filter((f) => f.status !== 'Vyřešeno')
  const noVendor = faultsOpen.filter((f) => !f.vendor)
  const codesFree = codes.filter((c) => !c.used).length
  const soon = (d: string) => { if (!d) return false; const p = d.split('. '); if (p.length < 3) return false; const dt = new Date(+p[2], +p[1] - 1, +p[0]); const diff = dt.getTime() - Date.now(); return diff > 0 && diff < 60 * 86400000 }
  const ending = units.filter((u) => soon(u.leaseEnd))

  const kpis = [
    { l: t('admin:overview.occupancy'), v: `${occupied.length}/${units.length}`, i: 'people' },
    { l: t('admin:overview.collectedIn', { period: periodLabel(period, i18n.language) }), v: rentRoll ? `${Math.round((collected / rentRoll) * 100)} %` : t('admin:overview.noCharges'), i: 'card', g: true },
    { l: t('admin:overview.monthlyCharge'), v: money(rentRoll, i18n.language), i: 'card' },
    { l: t('admin:overview.openFaults'), v: String(faultsOpen.length), i: 'wrench' },
    { l: t('admin:overview.totalComplaints'), v: String(complaints), i: 'shield' },
    { l: t('admin:overview.freeCodes'), v: String(codesFree), i: 'people' },
  ]
  const alerts: { c: string; t: string; s: string }[] = []
  if (unpaid.length) alerts.push({ c: 'warn', t: t('admin:overview.alertUnpaid', { count: unpaid.length }), s: unpaid.map((c) => c.unitLabel).join(', ') })
  if (noVendor.length) alerts.push({ c: 'warn', t: t('admin:overview.alertNoVendor', { count: noVendor.length }), s: noVendor.map((f) => f.cat).join(', ') })
  if (ending.length) alerts.push({ c: 'warn', t: t('admin:overview.alertLeaseEnding'), s: ending.map((u) => `${u.label} (${u.leaseEnd})`).join(', ') })
  if (!charges.length && occupied.some((u) => u.rent > 0)) alerts.push({ c: 'warn', t: t('admin:overview.alertNoChargesTitle'), s: t('admin:overview.alertNoChargesBody') })
  if (codesFree) alerts.push({ c: 'ok', t: t('admin:overview.alertCodesFree', { count: codesFree }), s: t('admin:overview.alertCodesFreeBody') })

  return (
    <>
      <div className="d-kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 0 }}>
        {kpis.map((k) => (
          <div className="d-kpi" key={k.l}>
            <div className="k">{k.l}</div>
            <b className={k.g ? 'g' : ''}>{k.v}</b>
          </div>
        ))}
      </div>
      <div className="ad-2" style={{ marginTop: 14 }}>
        <div className="s-card" style={{ overflow: 'hidden' }}>
          <div className="ad-hd"><b>{t('admin:overview.attention')}</b><span className={'s-badge ' + (alerts.length ? 'warn' : 'ok')}>{alerts.length || t('admin:overview.allGood')}</span></div>
          {alerts.length === 0 && <div className="ad-empty">{t('admin:overview.nothingWrong')}</div>}
          {alerts.map((al, i) => (
            <div className="ad-code" key={i}>
              <span className={'ic ' + (al.c === 'ok' ? 'used' : 'open')} style={{ width: 10, height: 10, borderRadius: '50%', background: al.c === 'ok' ? 'var(--s-green)' : 'var(--s-warn)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, letterSpacing: 0 }}>{al.t}</b>
                <span>{al.s}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="s-card" style={{ overflow: 'hidden' }}>
          <div className="ad-hd"><b>{t('admin:overview.recentFaults')}</b><span className="s-mono" style={{ fontSize: 11, color: 'var(--s-muted)' }}>{faults.length} {t('admin:overview.total')}</span></div>
          {faults.slice(0, 6).map((f) => (
            <div className="ad-code" key={f.id}>
              <span className="ic open"><SIcon n="wrench" s={15} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, letterSpacing: 0 }}>{f.cat}</b>
                <span>{f.loc} · {f.by} · {f.date}</span>
              </div>
              <span className={'s-badge ' + (f.status === 'Vyřešeno' ? 'ok' : f.status === 'V řešení' ? 'warn' : 'neutral')}>{faultStatusLabel(f.status, t)}</span>
            </div>
          ))}
          {faults.length === 0 && <div className="ad-empty">{t('admin:overview.noFaultsReported')}</div>}
        </div>
      </div>
    </>
  )
}

/* ---------------- Jednotky ---------------- */
function Units({ toast, bid }: { toast: Toast; bid: string }) {
  const { t } = useTranslation(['admin', 'common'])
  const [units, setUnits] = useState<UnitFull[]>([])
  const [edit, setEdit] = useState<UnitFull | null>(null)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = () => api.getUnitsFull(bid).then(setUnits).catch((e: any) => toast(t('admin:units.loadFailed', { err: e.message || e })))
  useEffect(() => { reload() }, [bid])

  async function add() {
    if (!newLabel.trim() || busy) return
    setBusy(true)
    try { await api.addUnit(bid, newLabel.trim().toUpperCase()); setNewLabel(''); setAdding(false); await reload(); toast(t('admin:units.toastAdded')) }
    catch (e: any) { toast(e.message || t('admin:units.toastAddFailed')) } finally { setBusy(false) }
  }
  async function save() {
    if (!edit || busy) return
    setBusy(true)
    try {
      await api.saveUnit(edit.id, {
        label: edit.label, floor: edit.floor, tenant: edit.tenant, rent: edit.rent, vs: edit.vs, share: edit.share,
        leaseEnd: edit.leaseEnd ? toIso(edit.leaseEnd) : '',
      })
      setEdit(null); await reload(); toast(t('admin:units.toastSaved'))
    } catch (e: any) { toast(e.message || t('admin:units.toastSaveFailed')) } finally { setBusy(false) }
  }
  async function del(u: UnitFull) {
    if (!window.confirm(t('admin:units.confirmDelete', { label: u.label }))) return
    try { await api.deleteUnit(u.id); await reload(); toast(t('admin:units.toastDeleted')) }
    catch (e: any) { toast(e.message || t('admin:units.toastDeleteFailed')) }
  }
  const toIso = (cz: string) => {
    const m = cz.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return cz
    const p = cz.split('.').map((x) => x.trim()).filter(Boolean)
    if (p.length === 3) return `${p[2]}-${String(+p[1]).padStart(2, '0')}-${String(+p[0]).padStart(2, '0')}`
    return ''
  }
  const totalShare = units.reduce((s, u) => s + u.share, 0)

  return (
    <>
      <div className="s-card" style={{ overflow: 'hidden' }}>
        <div className="ad-hd">
          <b>{t('admin:units.title')}</b>
          <button className="s-btn s-primary sm" onClick={() => setAdding(true)}>{t('admin:units.add')}</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ad-tbl">
            <thead><tr><th>{t('admin:units.colUnit')}</th><th>{t('admin:units.colFloor')}</th><th>{t('admin:units.colTenant')}</th><th>{t('admin:units.colRent')}</th><th>{t('admin:units.colVs')}</th><th>{t('admin:units.colShare')}</th><th>{t('admin:units.colLeaseEnd')}</th><th></th></tr></thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td className="mono" style={{ fontWeight: 700 }}>{u.label}</td>
                  <td>{u.floor}</td>
                  <td>{u.tenant || <span className="sub">{t('admin:units.vacant')}</span>}</td>
                  <td className="mono">{u.rent ? money(u.rent, 'cs') : ''}</td>
                  <td className="mono">{u.vs}</td>
                  <td className="mono">{u.share || ''}</td>
                  <td>{u.leaseEnd}</td>
                  <td className="rt">
                    <button className="s-btn s-ghost sm" onClick={() => setEdit({ ...u })}>{t('admin:units.edit')}</button>{' '}
                    <button className="s-btn s-ghost sm" onClick={() => del(u)}>{t('admin:units.delete')}</button>
                  </td>
                </tr>
              ))}
              {units.length === 0 && <tr><td colSpan={8} className="ad-empty">{t('admin:units.empty')}</td></tr>}
            </tbody>
          </table>
        </div>
        {units.length > 0 && <div className="ad-tot">{t('admin:units.totalShare', { pct: totalShare.toFixed(1) })}</div>}
      </div>

      {adding && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setAdding(false) }}>
          <div className="modal">
            <div className="modal-h"><h3>{t('admin:units.newUnitTitle')}</h3><button className="s-btn s-ghost sm" onClick={() => setAdding(false)}>{t('admin:units.cancel')}</button></div>
            <div className="modal-b">
              <div className="a-f"><label>{t('admin:units.labelDesignation')}</label><input className="s-mono" placeholder={t('admin:units.placeholderDesignation')} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} autoFocus /></div>
            </div>
            <div className="modal-f"><button className="s-btn s-ghost" onClick={() => setAdding(false)}>{t('admin:units.cancel')}</button><button className="s-btn s-primary" onClick={add} disabled={busy}>{t('admin:units.addAction')}</button></div>
          </div>
        </div>
      )}

      {edit && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setEdit(null) }}>
          <div className="modal">
            <div className="modal-h"><h3>{t('admin:units.editUnitTitle', { label: edit.label })}</h3><button className="s-btn s-ghost sm" onClick={() => setEdit(null)}>{t('admin:units.cancel')}</button></div>
            <div className="modal-b">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="a-f"><label>{t('admin:units.labelDesignation')}</label><input className="s-mono" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></div>
                <div className="a-f"><label>{t('admin:units.labelFloor')}</label><input value={edit.floor} onChange={(e) => setEdit({ ...edit, floor: e.target.value })} /></div>
              </div>
              <div className="a-f"><label>{t('admin:units.labelTenant')}</label><input placeholder={t('admin:units.placeholderTenant')} value={edit.tenant} onChange={(e) => setEdit({ ...edit, tenant: e.target.value })} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="a-f"><label>{t('admin:units.labelRent')}</label><input type="number" value={edit.rent || ''} onChange={(e) => setEdit({ ...edit, rent: Number(e.target.value) || 0 })} /></div>
                <div className="a-f"><label>{t('admin:units.labelVs')}</label><input className="s-mono" value={edit.vs} onChange={(e) => setEdit({ ...edit, vs: e.target.value })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="a-f"><label>{t('admin:units.labelShare')}</label><input type="number" step="0.1" value={edit.share || ''} onChange={(e) => setEdit({ ...edit, share: Number(e.target.value) || 0 })} /></div>
                <div className="a-f"><label>{t('admin:units.labelLeaseEnd')}</label><input placeholder={t('admin:units.placeholderLeaseEnd')} value={edit.leaseEnd} onChange={(e) => setEdit({ ...edit, leaseEnd: e.target.value })} /></div>
              </div>
            </div>
            <div className="modal-f"><button className="s-btn s-ghost" onClick={() => setEdit(null)}>{t('admin:units.cancel')}</button><button className="s-btn s-primary" onClick={save} disabled={busy}>{t('admin:units.save')}</button></div>
          </div>
        </div>
      )}
    </>
  )
}

/* ---------------- Lidé (live) ---------------- */
function People({ toast }: { toast: Toast }) {
  const { t, i18n } = useTranslation(['admin', 'common'])
  const { user } = useSession()
  const bid = user?.buildingId || 'demo'
  const [members, setMembers] = useState<LiveMember[]>([])
  const [codes, setCodes] = useState<LiveCode[]>([])
  const [units, setUnits] = useState<LiveUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [newRole, setNewRole] = useState<Role>('rezident')
  const [newUnit, setNewUnit] = useState('')
  const [busy, setBusy] = useState(false)
  const roleLabel = (r: Role) => t(`common:roles.${r}`)

  async function reload() {
    const [m, c, u] = await Promise.all([adminApi.listMembers(bid), adminApi.listCodes(bid), adminApi.listUnits(bid)])
    setMembers(m); setCodes(c); setUnits(u); setLoading(false)
  }
  useEffect(() => { reload().catch((e: any) => { setLoading(false); toast(t('admin:people.loadFailed', { err: e.message || e })) }) }, [bid])

  async function gen() {
    setBusy(true)
    try {
      const code = await adminApi.createCode(bid, newRole, newRole === 'rezident' && newUnit ? newUnit : null, 'TLV', i18n.language)
      toast(t('admin:people.toastCodeCreated', { code })); await reload()
    } catch (e: any) { toast(t('admin:people.genericError', { err: e.message || e })) } finally { setBusy(false) }
  }
  async function del(code: string) {
    try { await adminApi.deleteCode(code); toast(t('admin:people.toastCodeDeleted')); await reload() }
    catch (e: any) { toast(t('admin:people.genericError', { err: e.message || e })) }
  }
  async function changeRole(m: LiveMember, role: Role) {
    try { await adminApi.setRole(m.membershipId, role); toast(t('admin:people.toastRoleChanged', { name: m.name, role: roleLabel(role) })); await reload() }
    catch (e: any) { toast(t('admin:people.genericError', { err: e.message || e })) }
  }
  async function remove(m: LiveMember) {
    if (!window.confirm(t('admin:people.confirmRemove', { name: m.name }))) return
    try { await adminApi.removeMember(m.membershipId); toast(t('admin:people.toastMemberRemoved')); await reload() }
    catch (e: any) { toast(t('admin:people.genericError', { err: e.message || e })) }
  }

  return (
    <div className="ad-2">
      <div className="s-card" style={{ overflow: 'hidden' }}>
        <div className="ad-hd"><b>{t('admin:people.residentsTitle')}</b><span className="s-mono" style={{ fontSize: 11, color: 'var(--s-muted)' }}>{t('admin:people.people', { count: members.length })}</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ad-tbl">
            <thead><tr><th>{t('admin:people.colName')}</th><th>{t('admin:people.colUnit')}</th><th>{t('admin:people.colRole')}</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="ad-empty">{t('admin:people.loading')}</td></tr>}
              {!loading && members.length === 0 && (
                <tr><td colSpan={4} className="ad-empty">{t('admin:people.noneYet')}</td></tr>
              )}
              {members.map((m) => (
                <tr key={m.membershipId}>
                  <td><b style={{ fontWeight: 700 }}>{m.name}</b><div className="sub">{m.email || t('admin:people.noEmail')} · {t('admin:people.since', { date: m.since })}</div></td>
                  <td className="mono">{m.unit || <span className="sub">—</span>}</td>
                  <td>
                    <select className="ad-mini-sel" value={m.role} onChange={(e) => changeRole(m, e.target.value as Role)} disabled={m.userId === user?.userId}>
                      {(['rezident', 'vybor', 'developer', 'investor'] as Role[]).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                  </td>
                  <td className="rt">
                    {m.userId !== user?.userId && <button className="s-btn s-ghost sm" onClick={() => remove(m)}>{t('admin:people.remove')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="s-card" style={{ overflow: 'hidden' }}>
        <div className="ad-hd"><b>{t('admin:people.codesTitle')}</b></div>
        <div className="ad-gen">
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
            {(['rezident', 'vybor', 'developer', 'investor'] as Role[]).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
          {newRole === 'rezident' && (
            <select value={newUnit} onChange={(e) => setNewUnit(e.target.value)}>
              <option value="">{t('admin:people.noUnit')}</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          )}
          <button className="s-btn s-primary sm" onClick={gen} disabled={busy}>{t('admin:people.generate')}</button>
        </div>
        {!loading && codes.length === 0 && <div className="ad-empty">{t('admin:people.noCodesYet')}</div>}
        {codes.map((c) => (
          <div className="ad-code" key={c.code}>
            <span className={'ic ' + (c.used ? 'used' : 'open')}><SIcon n={c.used ? 'vote' : 'people'} s={15} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{c.code}</b>
              <span>{roleLabel(c.role)}{c.unit ? ' · ' + c.unit : ''} · {c.created}</span>
            </div>
            {c.used ? <span className="s-badge ok">{t('admin:people.used')}</span> : <button className="s-btn s-ghost sm" onClick={() => del(c.code)}>{t('admin:people.delete')}</button>}
          </div>
        ))}
        <div className="ad-hint">
          <SIcon n="shield" s={15} />
          <span>{t('admin:people.hint')}</span>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Finance ---------------- */
function Finance({ toast, bid }: { toast: Toast; bid: string }) {
  const { t, i18n } = useTranslation(['admin', 'common'])
  const [period, setPeriod] = useState(currentPeriod())
  const [charges, setCharges] = useState<Charge[]>([])
  const [busy, setBusy] = useState(false)

  const reload = (p = period) => api.getCharges(bid, p).then(setCharges).catch((e: any) => toast(t('admin:finance.loadFailed', { err: e.message || e })))
  useEffect(() => { reload(period) }, [bid, period])

  const periods = (() => {
    const out: string[] = []
    const d = new Date()
    for (let i = -1; i < 6; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')) }
    return out
  })()

  async function generate() {
    if (busy) return
    setBusy(true)
    try {
      const n = await api.generateCharges(bid, period)
      await reload()
      toast(n ? t('admin:finance.toastGenerated', { count: n, period: periodLabel(period, i18n.language) }) : t('admin:finance.toastNoRent'))
    } catch (e: any) { toast(e.message || t('admin:finance.toastGenerateFailed')) } finally { setBusy(false) }
  }
  async function setStatus(c: Charge, status: 'paid' | 'unpaid') {
    try { await api.setChargeStatus(c.id, status); await reload(); toast(status === 'paid' ? t('admin:finance.toastMarkedPaid', { unit: c.unitLabel }) : t('admin:finance.toastRevertedUnpaid')) }
    catch (e: any) { toast(e.message || t('admin:finance.toastSaveFailed')) }
  }
  async function remind(c: Charge) {
    try { const n = await api.remindCharge(c.id); toast(n > 0 ? t('admin:finance.toastReminderSent', { unit: c.unitLabel }) : t('admin:finance.toastNoMember', { unit: c.unitLabel })) }
    catch (e: any) { toast(e.message || t('admin:finance.toastReminderFailed')) }
  }

  const total = charges.reduce((s, c) => s + c.amount, 0)
  const paid = charges.filter((c) => c.status === 'paid').reduce((s, c) => s + c.amount, 0)
  const awaiting = charges.filter((c) => c.status === 'awaiting')
  const unpaid = charges.filter((c) => c.status === 'unpaid')

  return (
    <>
      <div className="d-kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 0 }}>
        <div className="d-kpi"><div className="k">{t('admin:finance.chargeFor', { period: periodLabel(period, i18n.language) })}</div><b>{money(total, i18n.language)}</b></div>
        <div className="d-kpi"><div className="k">{t('admin:finance.collected')}</div><b className="g">{money(paid, i18n.language)}</b></div>
        <div className="d-kpi"><div className="k">{t('admin:finance.owed')}</div><b style={{ color: unpaid.length + awaiting.length ? 'var(--s-warn)' : undefined }}>{unpaid.length + awaiting.length}</b></div>
      </div>

      <div className="s-card" style={{ overflow: 'hidden', marginTop: 14 }}>
        <div className="ad-hd" style={{ flexWrap: 'wrap', gap: 10 }}>
          <b>{t('admin:finance.chargesTitle')}</b>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="ad-mini-sel" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {periods.map((p) => <option key={p} value={p}>{periodLabel(p, i18n.language)}</option>)}
            </select>
            <button className="s-btn s-primary sm" onClick={generate} disabled={busy}>{t('admin:finance.generate')}</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ad-tbl">
            <thead><tr><th>{t('admin:finance.colUnit')}</th><th>{t('admin:finance.colCharge')}</th><th>{t('admin:finance.colAmount')}</th><th>{t('admin:finance.colVs')}</th><th>{t('admin:finance.colDue')}</th><th>{t('admin:finance.colStatus')}</th><th></th></tr></thead>
            <tbody>
              {charges.map((c) => (
                <tr key={c.id}>
                  <td className="mono" style={{ fontWeight: 700 }}>{c.unitLabel}</td>
                  <td>{c.label}</td>
                  <td className="mono">{money(c.amount, i18n.language)}</td>
                  <td className="mono">{c.vs}</td>
                  <td>{c.due}</td>
                  <td>{c.status === 'paid' ? <span className="s-badge ok">{chargeStatusLabel(c.status, t)}</span> : <span className="s-badge warn">{chargeStatusLabel(c.status, t)}</span>}</td>
                  <td className="rt">
                    {c.status !== 'paid' && <button className="s-btn s-dark sm" onClick={() => setStatus(c, 'paid')}>{t('admin:finance.confirmPayment')}</button>}
                    {c.status === 'unpaid' && <button className="s-btn s-ghost sm" style={{ marginLeft: 6 }} onClick={() => remind(c)}>{t('admin:finance.remind')}</button>}
                    {c.status === 'paid' && <button className="s-btn s-ghost sm" onClick={() => setStatus(c, 'unpaid')}>{t('admin:finance.revert')}</button>}
                  </td>
                </tr>
              ))}
              {charges.length === 0 && <tr><td colSpan={7} className="ad-empty">{t('admin:finance.emptyFor', { period: periodLabel(period, i18n.language) })}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="ad-tot">{t('admin:finance.note')}</div>
      </div>
    </>
  )
}

/* ---------------- Údržba ---------------- */
function Maintenance({ toast, bid, isDemo }: { toast: Toast; bid: string; isDemo: boolean }) {
  const { t, i18n } = useTranslation(['admin', 'common'])
  const [faults, setFaults] = useState<Fault[]>([])
  const nav = useNavigate()
  useEffect(() => { api.getFaults(bid).then(setFaults).catch(() => setFaults([])) }, [bid])
  const open = faults.filter((f) => f.status !== 'Vyřešeno')
  const noVendor = open.filter((f) => !f.vendor)
  void toast

  const revizeStatusLabel = (s: string) => s === 'Platná' ? t('admin:maintenance.inspValid') : s === 'Blíží se' ? t('admin:maintenance.inspSoon') : t('admin:maintenance.inspOverdue')

  return (
    <>
      <div className="d-kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 0 }}>
        <div className="d-kpi"><div className="k">{t('admin:maintenance.openFaults')}</div><b>{open.length}</b></div>
        <div className="d-kpi"><div className="k">{t('admin:maintenance.noVendor')}</div><b style={{ color: noVendor.length ? 'var(--s-warn)' : undefined }}>{noVendor.length}</b></div>
        <div className="d-kpi"><div className="k">{t('admin:maintenance.resolvedTotal')}</div><b className="g">{faults.length - open.length}</b></div>
      </div>

      <div className="s-card" style={{ marginTop: 14, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="ic" style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--s-green-050)', color: 'var(--s-green-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><SIcon n="wrench" /></span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <b style={{ fontSize: 14, fontWeight: 800, display: 'block' }}>{t('admin:maintenance.pointerTitle')}</b>
          <span style={{ fontSize: 12.5, color: 'var(--s-ink-2)' }}>{t('admin:maintenance.pointerBody')}</span>
        </div>
        <button className="s-btn s-primary sm" onClick={() => nav('/app/zavady')}>{t('admin:maintenance.openFaultsBtn')}</button>
      </div>

      {isDemo && (
        <div className="s-card" style={{ overflow: 'hidden', marginTop: 14 }}>
          <div className="ad-hd"><b>{t('admin:maintenance.inspectionsTitle')}</b><span className="s-badge purple">{t('admin:maintenance.inspectionsTag')}</span></div>
          {A.revize.map((r) => (
            <div className="ad-code" key={r.type}>
              <span className="ic open"><SIcon n="shield" s={15} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, letterSpacing: 0 }}>{r.type}</b>
                <span>{r.provider} · {t('admin:maintenance.inspectionNext', { date: r.next })}</span>
              </div>
              <span className={'s-badge ' + (r.status === 'Platná' ? 'ok' : r.status === 'Blíží se' ? 'warn' : 'warn')}>{revizeStatusLabel(r.status)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/* ---------------- Schůze a hlasování ---------------- */
function AdminPointer({ icon, title, desc, to, label, nav }: { icon: string; title: string; desc: string; to: string; label: string; nav: (p: string) => void }) {
  return (
    <div className="s-card" style={{ padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="ic" style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--s-green-050)', color: 'var(--s-green-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><SIcon n={icon} /></span>
      <div style={{ flex: 1, minWidth: 220 }}>
        <b style={{ fontSize: 14, fontWeight: 800, display: 'block' }}>{title}</b>
        <span style={{ fontSize: 12.5, color: 'var(--s-ink-2)' }}>{desc}</span>
      </div>
      <button className="s-btn s-primary sm" onClick={() => nav(to)}>{label}</button>
    </div>
  )
}
function MeetingsAdmin() {
  const { t } = useTranslation('admin')
  const nav = useNavigate()
  return <AdminPointer nav={nav} icon="vote" title={t('pointers.meetingsTitle')} desc={t('pointers.meetingsBody')} to="/app/schuze" label={t('pointers.meetingsBtn')} />
}
function Board() {
  const { t } = useTranslation('admin')
  const nav = useNavigate()
  return <AdminPointer nav={nav} icon="bell" title={t('pointers.boardTitle')} desc={t('pointers.boardBody')} to="/app/nastenka" label={t('pointers.boardBtn')} />
}
function DocumentsAdmin() {
  const { t } = useTranslation('admin')
  const nav = useNavigate()
  return <AdminPointer nav={nav} icon="doc" title={t('pointers.docsTitle')} desc={t('pointers.docsBody')} to="/app/dokumenty" label={t('pointers.docsBtn')} />
}

/* ---------------- Fond oprav ---------------- */
function ReserveFundTab({ toast, bid }: { toast: Toast; bid: string }) {
  const { t, i18n } = useTranslation(['admin', 'common'])
  const [visible, setVisible] = useState(false)
  const [target, setTarget] = useState('')
  const [balance, setBalance] = useState(0)
  const [entries, setEntries] = useState<FundEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<'in' | 'out'>('in')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  async function reload() {
    try {
      const f = await api.getReserveFund(bid)
      setVisible(f.visible); setTarget(f.target != null ? String(f.target) : ''); setBalance(f.balance); setEntries(f.entries)
    } catch (e: any) { toast(t('admin:fund.loadFailed', { err: e.message || e })) } finally { setLoading(false) }
  }
  useEffect(() => { reload() }, [bid])

  async function saveSettings(nextVisible: boolean) {
    setBusy(true)
    try {
      await api.setReserveFundSettings(bid, { visible: nextVisible, target: target.trim() ? Number(target) : null })
      setVisible(nextVisible)
      toast(nextVisible ? t('admin:fund.toastShown') : t('admin:fund.toastHidden'))
    } catch (e: any) { toast(e.message || t('admin:fund.toastSaveFailed')) } finally { setBusy(false) }
  }
  async function saveTarget() {
    setBusy(true)
    try { await api.setReserveFundSettings(bid, { visible, target: target.trim() ? Number(target) : null }); toast(t('admin:fund.toastTargetSaved')) }
    catch (e: any) { toast(e.message || t('admin:fund.toastSaveFailed')) } finally { setBusy(false) }
  }

  async function addEntry() {
    const n = Number(amount.replace(',', '.'))
    if (!n || n <= 0) { toast(t('admin:fund.toastEnterAmount')); return }
    if (busy) return
    setBusy(true)
    try {
      await api.addReserveEntry(bid, { date, amount: kind === 'in' ? n : -n, note: note.trim() || (kind === 'in' ? t('admin:fund.defaultNoteIncome') : t('admin:fund.defaultNoteExpense')) })
      setAmount(''); setNote('')
      await reload()
      toast(t('admin:fund.toastEntryAdded'))
    } catch (e: any) { toast(e.message || t('admin:fund.toastAddFailed')) } finally { setBusy(false) }
  }

  async function removeEntry(id: string) {
    if (!window.confirm(t('admin:fund.confirmDeleteEntry'))) return
    try { await api.deleteReserveEntry(id); await reload(); toast(t('admin:fund.toastEntryDeleted')) }
    catch (e: any) { toast(e.message || t('admin:fund.toastDeleteFailed')) }
  }

  const targetNum = target.trim() ? Number(target) : null
  const pct = targetNum ? Math.max(0, Math.min(100, Math.round((balance / targetNum) * 100))) : null

  if (loading) return <p className="spin">{t('admin:fund.loading')}</p>

  return (
    <>
      <div className="d-kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 0 }}>
        <div className="d-kpi"><div className="k">{t('admin:fund.balance')}</div><b className="g">{money(balance, i18n.language)}</b></div>
        <div className="d-kpi"><div className="k">{t('admin:fund.target')}</div><b>{targetNum ? money(targetNum, i18n.language) : t('admin:fund.notSet')}</b></div>
        <div className="d-kpi"><div className="k">{t('admin:fund.filled')}</div><b>{pct != null ? `${pct} %` : '—'}</b></div>
      </div>

      <div className="s-card" style={{ padding: '18px 20px', marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--s-green-050)', color: 'var(--s-green-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><SIcon n="fund" /></span>
          <div style={{ flex: 1, minWidth: 240 }}>
            <b style={{ fontSize: 14, fontWeight: 800, display: 'block' }}>{t('admin:fund.visibleTitle')}</b>
            <p style={{ fontSize: 12.5, color: 'var(--s-ink-2)', lineHeight: 1.55, margin: '6px 0 0' }}>
              {t('admin:fund.visibleBody')}
            </p>
          </div>
          <button className={'s-btn sm ' + (visible ? 's-dark' : 's-primary')} disabled={busy} onClick={() => saveSettings(!visible)}>
            {visible ? t('admin:fund.hide') : t('admin:fund.show')}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <label htmlFor="rf-target" style={{ fontSize: 12, fontWeight: 700, color: 'var(--s-ink-2)' }}>{t('admin:fund.targetLabel')}</label>
          <input id="rf-target" className="s-mono" style={{ maxWidth: 160 }} placeholder={t('admin:fund.targetPlaceholder')} value={target}
            onChange={(e) => setTarget(e.target.value.replace(/[^\d]/g, ''))} />
          <button className="s-btn s-ghost sm" disabled={busy} onClick={saveTarget}>{t('admin:fund.saveTarget')}</button>
        </div>
      </div>

      <div className="s-card" style={{ padding: '18px 20px', marginTop: 14 }}>
        <b style={{ fontSize: 14, fontWeight: 800, display: 'block', marginBottom: 12 }}>{t('admin:fund.newEntryTitle')}</b>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="a-chips">
            <button className={'a-chip' + (kind === 'in' ? ' on' : '')} onClick={() => setKind('in')}>{t('admin:fund.income')}</button>
            <button className={'a-chip' + (kind === 'out' ? ' on' : '')} onClick={() => setKind('out')}>{t('admin:fund.expense')}</button>
          </div>
          <input className="s-mono" style={{ maxWidth: 140 }} placeholder={t('admin:fund.amountPlaceholder')} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ''))} />
          <input type="date" style={{ maxWidth: 160 }} value={date} onChange={(e) => setDate(e.target.value)} />
          <input style={{ flex: 1, minWidth: 200 }} placeholder={kind === 'in' ? t('admin:fund.notePlaceholderIncome') : t('admin:fund.notePlaceholderExpense')} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="s-btn s-primary sm" disabled={busy} onClick={addEntry}>{t('admin:fund.addEntry')}</button>
        </div>
      </div>

      <div className="s-card" style={{ overflow: 'hidden', marginTop: 14 }}>
        <div className="ad-hd"><b>{t('admin:fund.historyTitle')}</b><span className="s-mono" style={{ fontSize: 11, color: 'var(--s-muted)' }}>{t('admin:fund.entries', { count: entries.length })}</span></div>
        {entries.map((e) => (
          <div className="ad-code" key={e.id}>
            <span className="ic open" style={{ color: e.amount >= 0 ? 'var(--s-green-ink)' : 'var(--s-warn)' }}>
              <SIcon n={e.amount >= 0 ? 'plus' : 'fund'} s={15} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, letterSpacing: 0 }}>{e.note}</b>
              <span>{new Date(e.date).toLocaleDateString(i18n.language)}</span>
            </div>
            <b className="s-mono" style={{ fontSize: 13, color: e.amount >= 0 ? 'var(--s-green-ink)' : 'var(--s-warn)' }}>
              {e.amount >= 0 ? '+' : ''}{money(e.amount, i18n.language)}
            </b>
            <button className="s-btn s-ghost sm" style={{ marginLeft: 8 }} onClick={() => removeEntry(e.id)}>{t('admin:fund.delete')}</button>
          </div>
        ))}
        {entries.length === 0 && <div className="ad-empty">{t('admin:fund.noEntriesYet')}</div>}
      </div>
    </>
  )
}

function BuildingSettingsTab({ toast, bid, isDemo, buildingName }: { toast: Toast; bid: string; isDemo: boolean; buildingName: string }) {
  const { t } = useTranslation(['admin', 'common'])
  const [exp, setExp] = useState('')
  async function doExport() {
    if (exp) return
    setExp(t('admin:settings.preparingExport'))
    try {
      const { blob, filename, note } = await exportBuilding(bid, buildingName, setExp)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      toast(t('admin:settings.toastExportDownloaded') + (note ? ' · ' + note : ''))
    } catch (e: any) { toast(e.message || t('admin:settings.toastExportFailed')) } finally { setExp('') }
  }
  const [account, setAccount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.getBuildingSettings(bid).then((s) => { setAccount(s.account); setRecipient(s.recipient) }).catch(() => {})
  }, [bid])

  async function save() {
    if (busy) return
    setBusy(true)
    try { await api.saveBuildingSettings(bid, { account: account.trim(), recipient: recipient.trim() }); toast(t('admin:settings.toastPaymentSettingsSaved')) }
    catch (e: any) { toast(e.message || t('admin:settings.toastSaveFailed')) } finally { setBusy(false) }
  }

  const integrations = [
    { id: 'stripe', name: t('admin:settings.integrationStripeName'), desc: t('admin:settings.integrationStripeDesc'), tag: t('admin:settings.comingSoon') },
    { id: 'email', name: t('admin:settings.integrationEmailName'), desc: t('admin:settings.integrationEmailDesc'), tag: t('admin:settings.comingSoon') },
  ]

  return (
    <div className="ad-2">
      <div className="s-card" style={{ padding: '18px 20px' }}>
        <b style={{ fontSize: 14, fontWeight: 800 }}>{t('admin:settings.accountTitle')}</b>
        <div className="a-f" style={{ marginTop: 12 }}>
          <label htmlFor="bs-a">{t('admin:settings.labelAccount')}</label>
          <input id="bs-a" className="s-mono" placeholder="123456789/0100" value={account} onChange={(e) => setAccount(e.target.value)} />
        </div>
        <div className="a-f">
          <label htmlFor="bs-r">{t('admin:settings.labelRecipient')}</label>
          <input id="bs-r" placeholder={buildingName} value={recipient} onChange={(e) => setRecipient(e.target.value)} />
        </div>
        <button className="s-btn s-primary sm" onClick={save} disabled={busy || isDemo}>{t('admin:settings.save')}</button>
        <p className="a-note" style={{ marginTop: 10 }}>
          {t('admin:settings.accountNote')}
        </p>
      </div>
      <div className="s-card" style={{ overflow: 'hidden' }}>
        <div className="ad-hd"><b>{t('admin:settings.integrationsTitle')}</b><span className="s-mono" style={{ fontSize: 10, color: 'var(--s-muted)' }}>ROADMAP</span></div>
        {integrations.map((i) => (
          <div className="ad-code" key={i.id}>
            <span className="ic open"><SIcon n="card" s={15} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, letterSpacing: 0 }}>{i.name}</b>
              <span>{i.desc}</span>
            </div>
            <span className="s-badge purple">{i.tag}</span>
          </div>
        ))}
        <p className="a-note" style={{ padding: '4px 16px 14px' }}>{t('admin:settings.integrationsNote')}</p>
      </div>

      <div className="s-card" style={{ gridColumn: '1 / -1', padding: '18px 20px' }}>
        <b style={{ fontSize: 14, fontWeight: 800, display: 'block', marginBottom: 10 }}>{t('admin:settings.bankTitle')}</b>
        <BankCard buildingId={bid} variant="sh" toast={toast} />
      </div>

      <div className="s-card" style={{ gridColumn: '1 / -1', padding: '18px 20px' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--s-green-050)', color: 'var(--s-green-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><SIcon n="shield" /></span>
          <div style={{ flex: 1, minWidth: 260 }}>
            <b style={{ fontSize: 14, fontWeight: 800, display: 'block' }}>{t('admin:settings.dataOwnershipTitle')}</b>
            <p style={{ fontSize: 12.5, color: 'var(--s-ink-2)', lineHeight: 1.55, margin: '6px 0 0' }}>
              {t('admin:settings.dataOwnershipBody')}
            </p>
            <div className="a-acts" style={{ marginTop: 12 }}>
              <button className="s-btn s-dark sm" onClick={doExport} disabled={!!exp}>
                {exp || t('admin:settings.downloadExport')}
              </button>
              {isDemo && <span className="a-note">{t('admin:settings.demoNoDocs')}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
