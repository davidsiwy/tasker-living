import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import type { Meeting, DocItem, VoteChoice, VoteData } from '../../lib/types'
import { can } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { SIcon } from '../../components/AppShell'

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const TAG: Record<VoteChoice, { l: string; c: string }> = {
  ano: { l: 'PRO', c: 'pro' }, ne: { l: 'PROTI', c: 'proti' }, zdrzel: { l: 'ZDRŽEL SE', c: 'zdr' },
}

// Schůze a hlasování (handoff 4c): per rollam podle podílů, plné moci,
// zápis se generuje z výsledků. Vlastník hlasuje, nájemník vidí jen výsledek.
export default function MeetingsPage() {
  const { user } = useSession()
  const toast = useToast()
  const bid = user?.buildingId || ''
  const role = user?.role
  const myUnitId = user?.unitId ?? ''
  const manage = role ? can(role, 'manage_meetings') : false

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [vote, setVote] = useState<VoteData | null>(null)
  const [docs, setDocs] = useState<DocItem[]>([])
  const [newVote, setNewVote] = useState(false)
  const [q, setQ] = useState(''); const [quorum, setQuorum] = useState(50)
  const [remindBusy, setRemindBusy] = useState(false)
  const [newMeeting, setNewMeeting] = useState(false)
  const [mDate, setMDate] = useState(''); const [mPlace, setMPlace] = useState(''); const [mAgenda, setMAgenda] = useState('')

  async function reload() {
    if (!bid || !role) return
    const [ms, v, ds] = await Promise.all([api.getMeetings(bid), api.getVote(bid), api.getDocuments(bid, role)])
    setMeetings(ms); setVote(v); setDocs(ds)
  }
  useEffect(() => { reload().catch(console.error) }, [bid, role])

  const t = useMemo(() => {
    const roster = vote?.roster || []
    const total = roster.reduce((s, r) => s + r.shares, 0)
    const eff = (uid: string): VoteChoice | undefined => {
      if (!vote) return
      if (vote.ballots[uid]) return vote.ballots[uid]
      const p = vote.proxies[uid]
      return p && vote.ballots[p] ? vote.ballots[p] : undefined
    }
    const tally: Record<VoteChoice, number> = { ano: 0, ne: 0, zdrzel: 0 }
    let voted = 0
    const silent: typeof roster = []
    for (const r of roster) {
      const c = eff(r.unitId)
      if (c) { tally[c] += r.shares; voted += r.shares } else silent.push(r)
    }
    return {
      roster, total, tally, eff, silent,
      yes: pct(tally.ano, total), no: pct(tally.ne, total), zdr: pct(tally.zdrzel, total),
      votedPct: pct(voted, total),
      quorumMet: total > 0 && pct(voted, total) >= (vote?.quorum || 0),
      proxies: Object.keys(vote?.proxies || {}).length,
    }
  }, [vote])

  const myRow = t.roster.find((r) => r.unitId === myUnitId)
  const mine = vote && myUnitId ? vote.ballots[myUnitId] : undefined
  const myProxy = vote && myUnitId ? vote.proxies[myUnitId] : undefined
  const ownerOf = (uid: string) => t.roster.find((x) => x.unitId === uid)?.owner || uid
  const hasPoll = Boolean(vote?.pollId)

  async function cast(c: VoteChoice) {
    if (!vote?.pollId || !myUnitId) return
    try { await api.castVote(vote.pollId, myUnitId, c); setVote(await api.getVote(bid)); toast('Hlas započítán, změnit ho můžete do konce') }
    catch (e: any) { toast(e.message || 'Hlasování selhalo') }
  }
  async function grant(to: string) {
    if (!to || !vote?.pollId || !myUnitId) return
    try { await api.setProxy(vote.pollId, myUnitId, to); setVote(await api.getVote(bid)); toast('Plná moc udělena') }
    catch (e: any) { toast(e.message || 'Nepodařilo se') }
  }
  async function revoke() {
    if (!vote?.pollId || !myUnitId) return
    await api.clearProxy(vote.pollId, myUnitId); setVote(await api.getVote(bid)); toast('Plná moc zrušena')
  }
  async function rsvp(m: Meeting) {
    try { await api.rsvp(m.id, !m.rsvp); setMeetings(await api.getMeetings(bid)); toast('Účast upravena') }
    catch (e: any) { toast(e.message || 'Uložení selhalo') }
  }
  async function createVote() {
    if (!q.trim()) { toast('Napište, o čem se hlasuje'); return }
    try { await api.createPoll(bid, q.trim(), quorum); setNewVote(false); setQ(''); await reload(); toast('Hlasování vypsáno, vlastníci dostali notifikaci') }
    catch (e: any) { toast(e.message || 'Vypsání selhalo') }
  }
  async function remindSilent() {
    if (!vote?.pollId || remindBusy) return
    setRemindBusy(true)
    try {
      const n = await api.remindPoll(vote.pollId)
      toast(n > 0 ? `Připomínka odešla ${n} lidem` : 'Nehlasující nemají v aplikaci účet — vytisknou se dopisy')
    } catch (e: any) { toast(e.message || 'Připomínka selhala') } finally { setRemindBusy(false) }
  }

  async function close() {
    if (!vote?.pollId) return
    try { await api.closePoll(vote.pollId); setVote(await api.getVote(bid)); toast('Hlasování uzavřeno') }
    catch (e: any) { toast(e.message || 'Nepodařilo se uzavřít') }
  }
  async function createMeeting() {
    if (!mDate || !mPlace.trim()) { toast('Vyplňte termín a místo'); return }
    try {
      await api.createMeeting(bid, new Date(mDate).toISOString(), mPlace.trim(), mAgenda.split('\n').map((a) => a.trim()).filter(Boolean))
      setNewMeeting(false); setMDate(''); setMPlace(''); setMAgenda('')
      await reload(); toast('Schůze vytvořena, sousedé dostali notifikaci')
    } catch (e: any) { toast(e.message || 'Vytvoření selhalo') }
  }

  // zápis se píše sám: výsledky, podíly i plné moci jdou rovnou do šablony
  function zapis() {
    if (!vote) return
    const dec = t.quorumMet ? (t.tally.ano > t.tally.ne ? 'SCHVÁLENO' : 'NESCHVÁLENO') : 'NEUSNÁŠENÍSCHOPNÉ'
    const row = (l: string, v: string) => `<tr><td style="padding:6px 12px;color:#48515C">${l}</td><td style="padding:6px 12px;font-weight:600">${v}</td></tr>`
    const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Zápis z hlasování</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:40px auto;color:#12161D">
<h1 style="color:#12161D">Zápis z hlasování</h1>
<p style="color:#48515C">${user?.buildingName || ''} · ${new Date().toLocaleDateString('cs-CZ')}</p>
<h3>${vote.q}</h3>
<table style="border-collapse:collapse;font-size:14px">
${row('Pro', t.yes + ' % podílů')}
${row('Proti', t.no + ' % podílů')}
${row('Zdrželo se', t.zdr + ' % podílů')}
${row('Nehlasovalo', (100 - t.votedPct) + ' % podílů')}
${row('Potřebné kvórum', (vote.quorum || 0) + ' %')}
${row('Stav', t.quorumMet ? 'Usnášeníschopné' : 'Neusnášeníschopné')}
${row('Evidované plné moci', String(t.proxies))}
</table>
<h3>Hlasy po jednotkách</h3>
<table style="border-collapse:collapse;font-size:13px">
<tr><th style="text-align:left;padding:6px 12px">Jednotka</th><th style="text-align:left;padding:6px 12px">Vlastník</th><th style="text-align:left;padding:6px 12px">Podíl</th><th style="text-align:left;padding:6px 12px">Hlas</th></tr>
${t.roster.map((r) => {
      const c = t.eff(r.unitId)
      const p = vote.proxies[r.unitId]
      return `<tr><td style="padding:5px 12px">${r.unit}</td><td style="padding:5px 12px">${r.owner || ''}${p ? ' (plná moc: ' + ownerOf(p) + ')' : ''}</td><td style="padding:5px 12px">${r.shares} %</td><td style="padding:5px 12px">${c ? TAG[c].l : 'NEHLASOVAL'}</td></tr>`
    }).join('')}
</table>
<p style="margin-top:16px;font-size:18px"><b>Rozhodnutí: ${dec}</b></p>
<p style="color:#8b93a0;font-size:12px;margin-top:40px">Vygenerováno aplikací Tasker Living, ${new Date().toLocaleString('cs-CZ')}</p>
</body></html>`
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    const a = document.createElement('a'); a.href = url; a.download = 'zapis-hlasovani.html'; a.click()
    URL.revokeObjectURL(url)
    toast('Průběžný zápis stažen')
  }

  if (!user) return null
  const podklady = docs.filter((d) => (d.cat || '').toLowerCase().includes('schůze') || (d.cat || '').toLowerCase().includes('hlas'))

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>Schůze a hlasování</h2>
          <p>Hlasuje se podle podílů, plné moci počítá aplikace. Zápis se generuje z výsledků.</p>
        </div>
        {manage && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="s-btn s-ghost sm" onClick={() => setNewMeeting(true)}>Nová schůze</button>
            <button className="s-btn s-primary" onClick={() => setNewVote(true)}>Nové hlasování</button>
          </div>
        )}
      </div>

      <div className="v-grid" style={{ marginTop: 18 }}>
        {/* běžící usnesení */}
        <div className="s-card an" style={{ overflow: 'hidden' }}>
          {!hasPoll ? (
            <div className="d-empty" style={{ padding: '38px 20px' }}>
              <b style={{ display: 'block', fontSize: 15, color: 'var(--s-ink)' }}>Žádné hlasování neběží</b>
              <p style={{ marginTop: 6, maxWidth: '30em', marginInline: 'auto', lineHeight: 1.55 }}>
                {manage
                  ? 'Vypište první — per rollam se dům sejde i bez obcházení pater. Kvórum a podíly počítá aplikace.'
                  : 'Až výbor něco vypíše, přijde vám notifikace a odhlasujete z telefonu.'}
              </p>
              {manage && <button className="s-btn s-primary" style={{ marginTop: 14 }} onClick={() => setNewVote(true)}>Nové hlasování</button>}
            </div>
          ) : (
            <>
              <div className="v-head">
                <div className="v-h">
                  <b>{vote!.q}</b>
                  <span className={'s-badge ' + (!vote!.open ? 'neutral' : t.quorumMet ? 'ok' : 'warn')}>
                    {!vote!.open ? 'Uzavřeno' : t.quorumMet ? 'Usnášeníschopné' : 'Zatím bez kvóra'}
                  </span>
                </div>
                <p>
                  Hlasuje se per rollam podle podílů. Potřebné kvórum {vote!.quorum} %, zatím hlasovalo {t.votedPct} % podílů.
                </p>
                <div className="v-bar">
                  <i style={{ width: `${t.yes}%`, background: '#06C40A' }} />
                  <i style={{ width: `${t.no}%`, background: '#B26A00', ['--d' as string]: '.4s' }} />
                  <i style={{ width: `${t.zdr}%`, background: '#D7DDE7', ['--d' as string]: '.6s' }} />
                </div>
                <div className="v-legend">
                  <span><b>{t.yes} %</b> podílů pro</span>
                  <span>{t.no} % proti</span>
                  <span>{100 - t.votedPct} % nehlasovalo</span>
                  <span className="v-ends">{vote!.open ? 'HLASOVÁNÍ BĚŽÍ' : 'UZAVŘENO'}</span>
                </div>
              </div>

              {/* můj hlas — vlastník hlasuje rovnou odsud */}
              {myRow && vote!.open && (
                <>
                  <div className="v-me">
                    <button className={'s-btn ' + (mine === 'ano' ? 's-primary' : 's-ghost')} onClick={() => cast('ano')} disabled={!!myProxy}>
                      JSEM PRO
                    </button>
                    <button className={'s-btn ' + (mine === 'ne' ? 's-dark' : 's-ghost')} onClick={() => cast('ne')} disabled={!!myProxy}>
                      Jsem proti
                    </button>
                    <button className={'s-btn ' + (mine === 'zdrzel' ? 's-dark' : 's-ghost')} onClick={() => cast('zdrzel')} disabled={!!myProxy}>
                      Zdržím se
                    </button>
                  </div>
                  {myProxy ? (
                    <div className="v-mine">
                      Plnou moc za vás ({myRow.shares} %) má <b>{ownerOf(myProxy)}</b>.{' '}
                      <button className="d-link" onClick={revoke}>Zrušit plnou moc</button>
                    </div>
                  ) : (
                    <div className="v-proxy">
                      <span>váš podíl {myRow.shares} % · nebo udělte plnou moc:</span>
                      <select defaultValue="" onChange={(e) => grant(e.target.value)}>
                        <option value="">vyberte vlastníka</option>
                        {t.roster.filter((r) => r.unitId !== myUnitId).map((r) => (
                          <option key={r.unitId} value={r.unitId}>{r.owner || r.unit} ({r.unit})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              {!myRow && !manage && (
                <div className="v-mine">
                  Hlas patří vlastníkovi bytu, jako nájemník nehlasujete. Výsledek uvidíte tady.
                </div>
              )}

              {/* hlasy po bytech s podíly a plnými mocemi */}
              {manage && t.roster.map((r) => {
                const c = t.eff(r.unitId)
                const p = vote!.proxies[r.unitId]
                return (
                  <div className="v-row" key={r.unitId}>
                    <b className="u">{r.unit}</b>
                    <span className="who">{r.owner || '—'}{p ? ` · plná moc: ${ownerOf(p)}` : ''}</span>
                    <span className="sh-p">{r.shares} %</span>
                    <span className={'v-tag ' + (c ? TAG[c].c : 'non')}>{c ? TAG[c].l : 'NEHLASOVAL'}</span>
                  </div>
                )
              })}

              {manage && (
                <div className="d-foot">
                  {vote!.open && t.silent.length > 0 && (
                    <button className="s-btn s-dark sm" onClick={remindSilent} disabled={remindBusy}>
                      {remindBusy ? 'Odesílám…' : `Připomenout ${t.silent.length} ${t.silent.length === 1 ? 'nehlasujícímu' : 'nehlasujícím'}`}
                    </button>
                  )}
                  <button className="s-btn s-ghost sm" onClick={zapis}>Stáhnout průběžný zápis</button>
                  {vote!.open && <button className="s-btn s-ghost sm" onClick={close}>Uzavřít hlasování</button>}
                  <span className="m" style={{ marginLeft: 'auto' }}>
                    {t.proxies} {t.proxies === 1 ? 'plná moc evidována' : t.proxies >= 2 && t.proxies <= 4 ? 'plné moci evidovány' : 'plných mocí evidováno'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="d-col">
          {/* nadcházející shromáždění */}
          {meetings.map((m, i) => (
            <div className="d-mini an" key={m.id} style={{ ['--d' as string]: `${i * 0.07}s` }}>
              <div className="h">
                <b>Shromáždění</b>
                <span className={'s-badge ' + (m.rsvp ? 'ok' : 'purple')}>{m.rsvp ? 'Přijdu' : 'Osobně v domě'}</span>
              </div>
              <div className="v-mtg" style={{ marginTop: 11 }}>
                <span className="ic"><SIcon n="vote" s={15} /></span>
                <div>
                  <b>{m.date}</b>
                  <span>{m.place}{typeof m.going === 'number' ? ` · ${m.going} přijde` : ''}</span>
                </div>
              </div>
              {m.agenda.length > 0 && (
                <div className="v-ag">
                  {m.agenda.map((a, k) => (
                    <span key={k}>
                      <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, flex: 'none', marginTop: 2 }} fill="none"
                        stroke="#12901E" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7" />
                      </svg>{a}
                    </span>
                  ))}
                </div>
              )}
              <div className="a-acts">
                <button className="s-btn s-dark sm" onClick={() => rsvp(m)}>{m.rsvp ? 'Zrušit účast' : 'Přijdu'}</button>
              </div>
            </div>
          ))}
          {meetings.length === 0 && (
            <div className="d-mini an">
              <div className="h"><b>Shromáždění</b></div>
              <p style={{ fontSize: 12, color: 'var(--s-muted)', marginTop: 10, lineHeight: 1.5 }}>
                {manage ? 'Zatím nic naplánovaného. Většinu věcí vyřídíte per rollam bez schůze.' : 'Zatím není naplánované žádné shromáždění.'}
              </p>
            </div>
          )}

          {podklady.length > 0 && (
            <div className="d-mini an" style={{ ['--d' as string]: '.07s' }}>
              <div className="h"><b>Podklady</b></div>
              <div className="v-arch">
                {podklady.slice(0, 4).map((d) => (
                  <div key={d.id || d.name}>
                    <span style={{ color: 'var(--s-ink-2)', minWidth: 0 }}>{d.name}</span>
                    <button className="d-link" onClick={async () => {
                      const url = await api.openDocument(d)
                      if (url) window.open(url, '_blank'); else toast('Dokument je ukázkový')
                    }}>{(d.kind || 'PDF').toUpperCase()}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="v-ok an" style={{ ['--d' as string]: '.14s' }}>
            <b>Zápis se píše sám.</b> Výsledky, podíly i plné moci se vkládají do šablony zápisu automaticky — vy jen podepíšete.
          </div>
        </div>
      </div>

      {newVote && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setNewVote(false) }}>
          <div className="modal">
            <div className="modal-h"><h3>Nové hlasování</h3><button className="s-btn s-ghost sm" onClick={() => setNewVote(false)}>Zrušit</button></div>
            <div className="modal-b">
              <div className="a-f">
                <label htmlFor="v-q">O čem se hlasuje</label>
                <input id="v-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Oprava střechy vchodu C za 486 000 Kč z fondu oprav" />
              </div>
              <div className="a-f">
                <label htmlFor="v-k">Kvórum dle stanov (% podílů)</label>
                <input id="v-k" type="number" min={1} max={100} value={quorum} onChange={(e) => setQuorum(Number(e.target.value))} />
              </div>
              <div className="v-ok" style={{ marginTop: 12 }}>
                <b>Připomínky odešleme za vás:</b> 3 dny před koncem nehlasujícím, 24 h poslední výzva, po konci výsledek všem se zápisem.
              </div>
            </div>
            <div className="modal-f">
              <button className="s-btn s-ghost" onClick={() => setNewVote(false)}>Zrušit</button>
              <button className="s-btn s-primary" onClick={createVote}>Vypsat hlasování</button>
            </div>
          </div>
        </div>
      )}

      {newMeeting && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setNewMeeting(false) }}>
          <div className="modal">
            <div className="modal-h"><h3>Nová schůze</h3><button className="s-btn s-ghost sm" onClick={() => setNewMeeting(false)}>Zrušit</button></div>
            <div className="modal-b">
              <div className="a-f"><label htmlFor="m-d">Termín</label><input id="m-d" type="datetime-local" value={mDate} onChange={(e) => setMDate(e.target.value)} /></div>
              <div className="a-f"><label htmlFor="m-p">Místo</label><input id="m-p" value={mPlace} onChange={(e) => setMPlace(e.target.value)} placeholder="Sušárna, vchod B" /></div>
              <div className="a-f"><label htmlFor="m-a">Program (bod na řádek)</label><textarea id="m-a" rows={4} value={mAgenda} onChange={(e) => setMAgenda(e.target.value)} placeholder={'Rozpočet 2027 a výše záloh\nVolba nového člena výboru'} /></div>
            </div>
            <div className="modal-f">
              <button className="s-btn s-ghost" onClick={() => setNewMeeting(false)}>Zrušit</button>
              <button className="s-btn s-primary" onClick={createMeeting}>Vytvořit a oznámit</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
