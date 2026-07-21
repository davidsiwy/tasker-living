import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import type { ComplaintItem } from '../../lib/types'
import { can, complaintTypeLabel } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { SIcon } from '../../components/AppShell'

const TYPES = ['Hluk', 'Nepořádek', 'Kouření', 'Parkování', 'Zvířata', 'Jiné']

// Soužití (handoff 6d): stížnost se eviduje k bytu, ne ke jménu. Soused, na
// kterého míří, zůstává výboru skrytý — řeší se problém, ne osoba.
export default function ComplaintsPage() {
  const { t } = useTranslation(['complaints', 'common'])
  const { user } = useSession()
  const toast = useToast()
  const role = user?.role
  const bid = user?.buildingId || ''
  const showLog = role ? can(role, 'complaint_log') : false
  const showForm = role ? can(role, 'file_complaint') : false

  const [log, setLog] = useState<Record<string, ComplaintItem[]>>({})
  const [open, setOpen] = useState<string | null>(null)
  const [unit, setUnit] = useState('')
  const [type, setType] = useState(TYPES[0])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [warned, setWarned] = useState<Record<string, boolean>>({})

  useEffect(() => { if (showLog && bid) api.getComplaints(bid).then(setLog).catch(console.error) }, [showLog, bid])

  const rows = useMemo(() => Object.entries(log).sort((a, b) => b[1].length - a[1].length), [log])
  const totals = useMemo(() => {
    const all = rows.reduce((s, [, i]) => s + i.length, 0)
    const repeat = rows.filter(([, i]) => i.length >= 3).length
    return { all, repeat, units: rows.length }
  }, [rows])

  async function file() {
    if (!unit.trim()) { toast(t('complaints:toastEnterUnit')); return }
    if (busy) return
    setBusy(true)
    const u = unit.trim().toUpperCase()
    try {
      await api.fileComplaint(bid, u, type, note.trim())
      toast(t('complaints:toastFiled', { unit: u }))
      setUnit(''); setNote('')
      if (showLog) setLog(await api.getComplaints(bid))
    } catch (e: any) { toast(e.message || t('complaints:toastFileFailed')) } finally { setBusy(false) }
  }
  async function warn(u: string) {
    try {
      const n = await api.warnUnit(bid, u)
      setWarned((w) => ({ ...w, [u]: true }))
      toast(n > 0 ? t('complaints:toastWarnSent', { unit: u }) : t('complaints:toastWarnNoApp', { unit: u }))
    } catch (e: any) { toast(e.message || t('complaints:toastWarnFailed')) }
  }

  if (!user) return null

  if (!showLog && !showForm) {
    return (
      <div className="d-mini an" style={{ maxWidth: 520 }}>
        <div className="h"><b>{t('complaints:noAccessTitle')}</b></div>
        <p style={{ fontSize: 12.5, color: 'var(--s-ink-2)', marginTop: 8, lineHeight: 1.55 }}>
          {t('complaints:noAccessBody')}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>{t('complaints:title')}</h2>
          <p>{t('complaints:subtitle')}</p>
        </div>
      </div>

      {showLog && (
        <div className="d-kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 18 }}>
          <div className="d-kpi an"><div className="k">{t('complaints:kpiOpen')}</div><b>{totals.all}</b><span className="note">{t('complaints:kpiOpenNote', { count: totals.units })}</span></div>
          <div className="d-kpi an" style={{ ['--d' as string]: '.07s' }}><div className="k">{t('complaints:kpiRepeat')}</div><b style={{ color: totals.repeat ? 'var(--s-warn)' : undefined }}>{totals.repeat}</b><span className="note">{totals.repeat ? t('complaints:kpiRepeatNoteYes') : t('complaints:kpiRepeatNoteNo')}</span></div>
          <div className="d-kpi an" style={{ ['--d' as string]: '.14s' }}><div className="k">{t('complaints:kpiAnon')}</div><b className="g">100 %</b><span className="note">{t('complaints:kpiAnonNote')}</span></div>
        </div>
      )}

      <div className="co-grid" style={{ marginTop: 14 }}>
        {showForm ? (
          <div className="s-card co-form an" style={{ padding: '18px 20px' }}>
            <b>{t('complaints:formTitle')}</b>
            <div className="a-f">
              <label htmlFor="co-u">{t('complaints:unitLabel')}</label>
              <input id="co-u" className="s-mono" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="B-112" />
            </div>
            <div className="a-f">
              <label>{t('complaints:typeLabel')}</label>
              <div className="a-chips">
                {TYPES.map((ty) => <button key={ty} className={'a-chip' + (type === ty ? ' on' : '')} onClick={() => setType(ty)}>{complaintTypeLabel(ty, t)}</button>)}
              </div>
            </div>
            <div className="a-f">
              <label htmlFor="co-n">{t('complaints:whatLabel')}</label>
              <textarea id="co-n" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('complaints:whatPlaceholder')} />
            </div>
            <div className="co-anon">
              <SIcon n="shield" s={16} />
              <div><b>{t('complaints:anonTitle')}</b> {t('complaints:anonBody')}</div>
            </div>
            <button className="s-btn s-primary" style={{ width: '100%', marginTop: 14 }} onClick={file} disabled={busy}>
              {busy ? t('complaints:sending') : t('complaints:submit')}
            </button>
          </div>
        ) : (
          <div className="s-card co-form an" style={{ padding: '18px 20px' }}>
            <b>{t('complaints:howItWorksTitle')}</b>
            <p style={{ fontSize: 12.5, color: 'var(--s-ink-2)', marginTop: 8, lineHeight: 1.55 }}>
              {t('complaints:howItWorksBody')}
            </p>
          </div>
        )}

        {showLog && (
          <div className="s-card an" style={{ overflow: 'hidden' }}>
            <div className="d-ch"><b>{t('complaints:byUnit')}</b><span className="d-link" style={{ cursor: 'default' }}>{t('complaints:sortedByCount')}</span></div>
            {rows.length === 0 && <div className="d-empty">{t('complaints:noComplaints')}</div>}
            {rows.map(([u, items]) => {
              const cls = items.length >= 3 ? 'c3' : items.length === 2 ? 'c2' : 'c1'
              const isOpen = open === u
              return (
                <div key={u}>
                  <button className={'co-row' + (isOpen ? ' on' : '')} onClick={() => setOpen(isOpen ? null : u)}>
                    <b className="u">{u}</b>
                    <span className="k">{complaintTypeLabel(items[0]?.type, t)}{items.length > 1 ? ' ' + t('complaints:andMore', { count: items.length - 1 }) : ''} · {t('complaints:lastOn', { date: items[0]?.date })}</span>
                    <span className={'co-count ' + cls}>{items.length}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 16px 14px' }}>
                      <div className="co-hist">
                        {items.map((c, i) => (
                          <div className="co-item" key={i}>
                            <span className="dot" />
                            <div>
                              <b>{complaintTypeLabel(c.type, t)}<span className="dt">{c.date}</span></b>
                              {c.note && <p>{c.note}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="a-acts">
                        <button className="s-btn s-dark sm" onClick={() => warn(u)} disabled={warned[u]}>
                          {warned[u] ? t('complaints:warningSent') : t('complaints:warnUnit', { unit: u })}
                        </button>
                        <span className="a-note">{items.length >= 3 ? t('complaints:repeatAdvice') : t('complaints:warningEnough')}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
