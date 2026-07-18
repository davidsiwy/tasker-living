import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import type { ComplaintItem } from '../../lib/types'
import { can } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { SIcon } from '../../components/AppShell'

const TYPES = ['Hluk', 'Nepořádek', 'Kouření', 'Parkování', 'Zvířata', 'Jiné']
const czCount = (n: number) => (n === 1 ? 'stížnost' : n < 5 ? 'stížnosti' : 'stížností')

// Soužití (handoff 6d): stížnost se eviduje k bytu, ne ke jménu. Soused, na
// kterého míří, zůstává výboru skrytý — řeší se problém, ne osoba.
export default function ComplaintsPage() {
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
    if (!unit.trim()) { toast('Zadejte číslo bytu'); return }
    if (busy) return
    setBusy(true)
    const u = unit.trim().toUpperCase()
    try {
      await api.fileComplaint(bid, u, type, note.trim())
      toast(`Zaznamenáno k bytu ${u}. Soused se nedozví, kdo to podal.`)
      setUnit(''); setNote('')
      if (showLog) setLog(await api.getComplaints(bid))
    } catch (e: any) { toast(e.message || 'Odeslání selhalo') } finally { setBusy(false) }
  }
  async function warn(u: string) {
    try {
      const n = await api.warnUnit(bid, u)
      setWarned((w) => ({ ...w, [u]: true }))
      toast(n > 0 ? `Upozornění odesláno bytu ${u}` : `Byt ${u} zatím nemá v aplikaci člena — vytiskne se dopis`)
    } catch (e: any) { toast(e.message || 'Upozornění selhalo') }
  }

  if (!user) return null

  if (!showLog && !showForm) {
    return (
      <div className="d-mini an" style={{ maxWidth: 520 }}>
        <div className="h"><b>Soužití</b></div>
        <p style={{ fontSize: 12.5, color: 'var(--s-ink-2)', marginTop: 8, lineHeight: 1.55 }}>
          Sousedské spory řeší výbor. Když vás něco ruší, řekněte to výboru — stížnost se eviduje k bytu, ne k vám.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>Soužití</h2>
          <p>Stížnost míří na byt, ne na jméno. Soused, kterého se týká, se nedozví, kdo ji podal.</p>
        </div>
      </div>

      {showLog && (
        <div className="d-kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 18 }}>
          <div className="d-kpi an"><div className="k">Otevřené podněty</div><b>{totals.all}</b><span className="note">napříč {totals.units} byty</span></div>
          <div className="d-kpi an" style={{ ['--d' as string]: '.07s' }}><div className="k">Opakované (3+)</div><b style={{ color: totals.repeat ? 'var(--s-warn)' : undefined }}>{totals.repeat}</b><span className="note">{totals.repeat ? 'stojí za osobní řešení' : 'nic se neopakuje'}</span></div>
          <div className="d-kpi an" style={{ ['--d' as string]: '.14s' }}><div className="k">Anonymita</div><b className="g">100 %</b><span className="note">soused nevidí, kdo podal</span></div>
        </div>
      )}

      <div className="co-grid" style={{ marginTop: 14 }}>
        {showForm ? (
          <div className="s-card co-form an" style={{ padding: '18px 20px' }}>
            <b>Nahlásit rušení</b>
            <div className="a-f">
              <label htmlFor="co-u">Kterého bytu se to týká</label>
              <input id="co-u" className="s-mono" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="B-112" />
            </div>
            <div className="a-f">
              <label>Typ</label>
              <div className="a-chips">
                {TYPES.map((t) => <button key={t} className={'a-chip' + (type === t ? ' on' : '')} onClick={() => setType(t)}>{t}</button>)}
              </div>
            </div>
            <div className="a-f">
              <label htmlFor="co-n">Co se děje</label>
              <textarea id="co-n" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hlasitá hudba po 22:00, opakovaně o víkendu…" />
            </div>
            <div className="co-anon">
              <SIcon n="shield" s={16} />
              <div><b>Anonymní vůči sousedovi.</b> Výbor vidí, že podnět přišel, ne od koho. Řeší se problém, ne vy proti němu.</div>
            </div>
            <button className="s-btn s-primary" style={{ width: '100%', marginTop: 14 }} onClick={file} disabled={busy}>
              {busy ? 'Odesílám…' : 'Odeslat výboru'}
            </button>
          </div>
        ) : (
          <div className="s-card co-form an" style={{ padding: '18px 20px' }}>
            <b>Jak to funguje</b>
            <p style={{ fontSize: 12.5, color: 'var(--s-ink-2)', marginTop: 8, lineHeight: 1.55 }}>
              Každý podnět je veden u bytu, kterého se týká, ne u konkrétní osoby. U opakovaných případů (3+)
              výbor upozorní jedním tlačítkem. Nikdo se nehádá na chodbě.
            </p>
          </div>
        )}

        {showLog && (
          <div className="s-card an" style={{ overflow: 'hidden' }}>
            <div className="d-ch"><b>Podle bytů</b><span className="d-link" style={{ cursor: 'default' }}>řazeno podle počtu</span></div>
            {rows.length === 0 && <div className="d-empty">Žádné stížnosti. V domě je klid.</div>}
            {rows.map(([u, items]) => {
              const cls = items.length >= 3 ? 'c3' : items.length === 2 ? 'c2' : 'c1'
              const isOpen = open === u
              return (
                <div key={u}>
                  <button className={'co-row' + (isOpen ? ' on' : '')} onClick={() => setOpen(isOpen ? null : u)}>
                    <b className="u">{u}</b>
                    <span className="k">{items[0]?.type}{items.length > 1 ? ` a ${items.length - 1} další` : ''} · naposledy {items[0]?.date}</span>
                    <span className={'co-count ' + cls}>{items.length}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 16px 14px' }}>
                      <div className="co-hist">
                        {items.map((c, i) => (
                          <div className="co-item" key={i}>
                            <span className="dot" />
                            <div>
                              <b>{c.type}<span className="dt">{c.date}</span></b>
                              {c.note && <p>{c.note}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="a-acts">
                        <button className="s-btn s-dark sm" onClick={() => warn(u)} disabled={warned[u]}>
                          {warned[u] ? 'Upozornění odesláno' : `Upozornit byt ${u}`}
                        </button>
                        <span className="a-note">{items.length >= 3 ? 'opakovaně — zvažte osobní jednání' : 'zatím stačí upozornění'}</span>
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
