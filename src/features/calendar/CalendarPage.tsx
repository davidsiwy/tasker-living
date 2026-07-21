import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import type { CalEvent, CalKind } from '../../lib/types'
import { useSession } from '../../state/session'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const dowShort = (lng: string, d: Date) => cap(new Intl.DateTimeFormat(lng, { weekday: 'short' }).format(d))
const dayKey = (d: Date) => d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()
const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b)

// Kalendář domu (handoff 7g): měsíc vlevo s tečkami událostí, agenda vpravo.
// Sjednocuje schůze, splatnosti, události a služby na jedno místo.
export default function CalendarPage() {
  const { t, i18n } = useTranslation(['calendar', 'common'])
  const KIND: Record<CalKind, string> = {
    schuze: t('calendar:kind.schuze'), platba: t('calendar:kind.platba'), udalost: t('calendar:kind.udalost'),
    sluzba: t('calendar:kind.sluzba'), odstavka: t('calendar:kind.odstavka'),
  }
  const { user } = useSession()
  const nav = useNavigate()
  const [events, setEvents] = useState<CalEvent[]>([])
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [sel, setSel] = useState<Date | null>(new Date())

  useEffect(() => { if (user) api.getCalendar(user.buildingId).then(setEvents).catch(() => setEvents([])) }, [user?.buildingId])

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const e of events) {
      const k = dayKey(new Date(e.at))
      const arr = map.get(k) || []; arr.push(e); map.set(k, arr)
    }
    return map
  }, [events])

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const lead = (first.getDay() + 6) % 7 // pondělí = 0
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    const out: (Date | null)[] = []
    for (let i = 0; i < lead; i++) out.push(null)
    for (let d = 1; d <= days; d++) out.push(new Date(cursor.getFullYear(), cursor.getMonth(), d))
    while (out.length % 7) out.push(null)
    return out
  }, [cursor])

  // agenda: od vybraného dne dál, seskupeno po dnech
  const agenda = useMemo(() => {
    const from = sel ? new Date(sel.getFullYear(), sel.getMonth(), sel.getDate()) : new Date()
    const items = events.filter((e) => new Date(e.at) >= from).slice(0, 20)
    const groups: { key: string; label: string; date: Date; items: CalEvent[] }[] = []
    for (const e of items) {
      const d = new Date(e.at); const k = dayKey(d)
      let g = groups.find((x) => x.key === k)
      if (!g) { g = { key: k, label: d.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }), date: d, items: [] }; groups.push(g) }
      g.items.push(e)
    }
    return groups
  }, [events, sel, i18n.language])

  const today = new Date()
  const monthLabel = cursor.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))
  const DOW = useMemo(() => {
    // pondělí (2026-01-05) až neděle (2026-01-11), stejné pořadí jako lead-výpočet výše
    const out: string[] = []
    for (let d = 5; d <= 11; d++) out.push(dowShort(i18n.language, new Date(2026, 0, d)))
    return out
  }, [i18n.language])

  if (!user) return null

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>{t('calendar:title')}</h2>
          <p>{t('calendar:subtitle')}</p>
        </div>
        <button className="s-btn s-ghost sm" onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSel(new Date()) }}>{t('calendar:today')}</button>
      </div>

      <div className="cal-grid">
        <div className="cal-card an">
          <div className="cal-top">
            <b>{monthLabel}</b>
            <div className="cal-nav">
              <button onClick={() => shift(-1)} aria-label={t('calendar:prevMonth')}>‹</button>
              <button onClick={() => shift(1)} aria-label={t('calendar:nextMonth')}>›</button>
            </div>
          </div>
          <div className="cal-dow">{DOW.map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="cal-days">
            {cells.map((d, i) => {
              if (!d) return <div className="cal-day pad" key={'p' + i} />
              const evs = byDay.get(dayKey(d)) || []
              const kinds = [...new Set(evs.map((e) => e.kind))].slice(0, 4)
              return (
                <button key={dayKey(d)}
                  className={'cal-day' + (sameDay(d, today) ? ' today' : '') + (sel && sameDay(d, sel) ? ' sel' : '')}
                  onClick={() => setSel(d)}>
                  <span className="dn">{d.getDate()}</span>
                  {kinds.length > 0 && <span className="cal-dots">{kinds.map((k) => <i key={k} className={'k-' + k} />)}</span>}
                </button>
              )
            })}
          </div>
          <div className="cal-legend">
            {(Object.keys(KIND) as CalKind[]).map((k) => (
              <span key={k}><i className={'k-' + k} />{KIND[k]}</span>
            ))}
          </div>
        </div>

        <div className="cal-card an" style={{ ['--d' as string]: '.06s' }}>
          <div className="ag-h">{sel ? (sameDay(sel, today) ? t('calendar:fromToday') : t('calendar:fromDate', { date: sel.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' }) })) : t('calendar:upcoming')}</div>
          <div className="ag-sub">{t('calendar:eventCount', { count: events.length })}</div>
          {agenda.length === 0 && <div className="ag-empty">{t('calendar:emptyAgenda')}</div>}
          {agenda.map((g) => (
            <div key={g.key}>
              <div className="ag-day">{sameDay(g.date, today) ? t('calendar:todayPrefix') + ' · ' : ''}{g.label}</div>
              {g.items.map((e) => (
                <button className="ag-ev" key={e.id} onClick={() => nav(e.route)}>
                  <span className="tm">{new Date(e.at).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className={'kd k-' + e.kind} />
                  <span className="bd">
                    <b>{e.title}</b>
                    <span>{KIND[e.kind]}{e.sub ? ' · ' + e.sub : ''}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
