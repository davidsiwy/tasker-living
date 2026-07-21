import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import type { Meeting, DocItem, VoteChoice, VoteData } from '../../lib/types'
import { can } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { SIcon } from '../../components/AppShell'

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

// Schůze a hlasování (handoff 4c): per rollam podle podílů, plné moci,
// zápis se generuje z výsledků. Vlastník hlasuje, nájemník vidí jen výsledek.
//
// Zápis z hlasování (funkce minutes() níže) zůstává generovaný česky bez
// ohledu na jazyk rozhraní — je to formální dokument k hlasování SVJ podle
// českého občanského zákoníku, ne UI text. Stejná zásada jako u CSV exportu
// pro účetní a interního e-mailu s poptávkou.
export default function MeetingsPage() {
  const { t, i18n } = useTranslation(['meetings', 'common'])
  const TAG: Record<VoteChoice, { l: string; c: string }> = {
    ano: { l: t('meetings:tag.for'), c: 'pro' }, ne: { l: t('meetings:tag.against'), c: 'proti' }, zdrzel: { l: t('meetings:tag.abstain'), c: 'zdr' },
  }
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

  const vt = useMemo(() => {
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

  const myRow = vt.roster.find((r) => r.unitId === myUnitId)
  const mine = vote && myUnitId ? vote.ballots[myUnitId] : undefined
  const myProxy = vote && myUnitId ? vote.proxies[myUnitId] : undefined
  const ownerOf = (uid: string) => vt.roster.find((x) => x.unitId === uid)?.owner || uid
  const hasPoll = Boolean(vote?.pollId)

  async function cast(c: VoteChoice) {
    if (!vote?.pollId || !myUnitId) return
    try { await api.castVote(vote.pollId, myUnitId, c); setVote(await api.getVote(bid)); toast(t('meetings:toastVoteCast')) }
    catch (e: any) { toast(e.message || t('meetings:toastVoteFailed')) }
  }
  async function grant(to: string) {
    if (!to || !vote?.pollId || !myUnitId) return
    try { await api.setProxy(vote.pollId, myUnitId, to); setVote(await api.getVote(bid)); toast(t('meetings:toastProxyGranted')) }
    catch (e: any) { toast(e.message || t('meetings:toastActionFailed')) }
  }
  async function revoke() {
    if (!vote?.pollId || !myUnitId) return
    await api.clearProxy(vote.pollId, myUnitId); setVote(await api.getVote(bid)); toast(t('meetings:toastProxyRevoked'))
  }
  async function rsvp(m: Meeting) {
    try { await api.rsvp(m.id, !m.rsvp); setMeetings(await api.getMeetings(bid)); toast(t('meetings:toastAttendanceUpdated')) }
    catch (e: any) { toast(e.message || t('meetings:toastSaveFailed')) }
  }
  async function createVote() {
    if (!q.trim()) { toast(t('meetings:toastEnterQuestion')); return }
    try { await api.createPoll(bid, q.trim(), quorum); setNewVote(false); setQ(''); await reload(); toast(t('meetings:toastVoteCreated')) }
    catch (e: any) { toast(e.message || t('meetings:toastVoteCreateFailed')) }
  }
  async function remindSilent() {
    if (!vote?.pollId || remindBusy) return
    setRemindBusy(true)
    try {
      const n = await api.remindPoll(vote.pollId)
      toast(n > 0 ? t('meetings:toastReminderSent', { count: n }) : t('meetings:toastReminderNoApp'))
    } catch (e: any) { toast(e.message || t('meetings:toastReminderFailed')) } finally { setRemindBusy(false) }
  }

  async function close() {
    if (!vote?.pollId) return
    try { await api.closePoll(vote.pollId); setVote(await api.getVote(bid)); toast(t('meetings:toastVoteClosed')) }
    catch (e: any) { toast(e.message || t('meetings:toastCloseFailed')) }
  }
  async function createMeeting() {
    if (!mDate || !mPlace.trim()) { toast(t('meetings:toastFillDateAndPlace')); return }
    try {
      await api.createMeeting(bid, new Date(mDate).toISOString(), mPlace.trim(), mAgenda.split('\n').map((a) => a.trim()).filter(Boolean))
      setNewMeeting(false); setMDate(''); setMPlace(''); setMAgenda('')
      await reload(); toast(t('meetings:toastMeetingCreated'))
    } catch (e: any) { toast(e.message || t('meetings:toastMeetingCreateFailed')) }
  }

  // zápis se píše sám: výsledky, podíly i plné moci jdou rovnou do šablony
  // (zůstává česky natrvalo, viz poznámka nahoře souboru)
  function minutes() {
    if (!vote) return
    const dec = vt.quorumMet ? (vt.tally.ano > vt.tally.ne ? 'SCHVÁLENO' : 'NESCHVÁLENO') : 'NEUSNÁŠENÍSCHOPNÉ'
    const row = (l: string, v: string) => `<tr><td style="padding:6px 12px;color:#48515C">${l}</td><td style="padding:6px 12px;font-weight:600">${v}</td></tr>`
    const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Zápis z hlasování</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:40px auto;color:#12161D">
<h1 style="color:#12161D">Zápis z hlasování</h1>
<p style="color:#48515C">${user?.buildingName || ''} · ${new Date().toLocaleDateString('cs-CZ')}</p>
<h3>${vote.q}</h3>
<table style="border-collapse:collapse;font-size:14px">
${row('Pro', vt.yes + ' % podílů')}
${row('Proti', vt.no + ' % podílů')}
${row('Zdrželo se', vt.zdr + ' % podílů')}
${row('Nehlasovalo', (100 - vt.votedPct) + ' % podílů')}
${row('Potřebné kvórum', (vote.quorum || 0) + ' %')}
${row('Stav', vt.quorumMet ? 'Usnášeníschopné' : 'Neusnášeníschopné')}
${row('Evidované plné moci', String(vt.proxies))}
</table>
<h3>Hlasy po jednotkách</h3>
<table style="border-collapse:collapse;font-size:13px">
<tr><th style="text-align:left;padding:6px 12px">Jednotka</th><th style="text-align:left;padding:6px 12px">Vlastník</th><th style="text-align:left;padding:6px 12px">Podíl</th><th style="text-align:left;padding:6px 12px">Hlas</th></tr>
${vt.roster.map((r) => {
      const c = vt.eff(r.unitId)
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
    toast(t('meetings:toastMinutesDownloaded'))
  }

  if (!user) return null
  const podklady = docs.filter((d) => (d.cat || '').toLowerCase().includes('schůze') || (d.cat || '').toLowerCase().includes('hlas'))

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>{t('meetings:title')}</h2>
          <p>{t('meetings:subtitle')}</p>
        </div>
        {manage && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="s-btn s-ghost sm" onClick={() => setNewMeeting(true)}>{t('meetings:newMeeting')}</button>
            <button className="s-btn s-primary" onClick={() => setNewVote(true)}>{t('meetings:newVote')}</button>
          </div>
        )}
      </div>

      <div className="v-grid" style={{ marginTop: 18 }}>
        {/* běžící usnesení */}
        <div className="s-card an" style={{ overflow: 'hidden' }}>
          {!hasPoll ? (
            <div className="d-empty" style={{ padding: '38px 20px' }}>
              <b style={{ display: 'block', fontSize: 15, color: 'var(--s-ink)' }}>{t('meetings:noVoteTitle')}</b>
              <p style={{ marginTop: 6, maxWidth: '30em', marginInline: 'auto', lineHeight: 1.55 }}>
                {manage ? t('meetings:noVoteManage') : t('meetings:noVoteResident')}
              </p>
              {manage && <button className="s-btn s-primary" style={{ marginTop: 14 }} onClick={() => setNewVote(true)}>{t('meetings:newVote')}</button>}
            </div>
          ) : (
            <>
              <div className="v-head">
                <div className="v-h">
                  <b>{vote!.q}</b>
                  <span className={'s-badge ' + (!vote!.open ? 'neutral' : vt.quorumMet ? 'ok' : 'warn')}>
                    {!vote!.open ? t('meetings:closed') : vt.quorumMet ? t('meetings:quorumOk') : t('meetings:quorumMissing')}
                  </span>
                </div>
                <p>
                  {t('meetings:voteBody', { quorum: vote!.quorum, voted: vt.votedPct })}
                </p>
                <div className="v-bar">
                  <i style={{ width: `${vt.yes}%`, background: '#06C40A' }} />
                  <i style={{ width: `${vt.no}%`, background: '#B26A00', ['--d' as string]: '.4s' }} />
                  <i style={{ width: `${vt.zdr}%`, background: '#D7DDE7', ['--d' as string]: '.6s' }} />
                </div>
                <div className="v-legend">
                  <span><b>{vt.yes} %</b> {t('meetings:forPct')}</span>
                  <span>{vt.no} % {t('meetings:against')}</span>
                  <span>{100 - vt.votedPct} % {t('meetings:abstained')}</span>
                  <span className="v-ends">{vote!.open ? t('meetings:voteRunningTag') : t('meetings:voteClosedTag')}</span>
                </div>
              </div>

              {/* můj hlas — vlastník hlasuje rovnou odsud */}
              {myRow && vote!.open && (
                <>
                  <div className="v-me">
                    <button className={'s-btn ' + (mine === 'ano' ? 's-primary' : 's-ghost')} onClick={() => cast('ano')} disabled={!!myProxy}>
                      {t('meetings:voteFor')}
                    </button>
                    <button className={'s-btn ' + (mine === 'ne' ? 's-dark' : 's-ghost')} onClick={() => cast('ne')} disabled={!!myProxy}>
                      {t('meetings:voteAgainst')}
                    </button>
                    <button className={'s-btn ' + (mine === 'zdrzel' ? 's-dark' : 's-ghost')} onClick={() => cast('zdrzel')} disabled={!!myProxy}>
                      {t('meetings:voteAbstain')}
                    </button>
                  </div>
                  {myProxy ? (
                    <div className="v-mine">
                      {t('meetings:proxyHeldBy', { shares: myRow.shares, owner: ownerOf(myProxy) })}{' '}
                      <button className="d-link" onClick={revoke}>{t('meetings:revokeProxy')}</button>
                    </div>
                  ) : (
                    <div className="v-proxy">
                      <span>{t('meetings:myShare', { shares: myRow.shares })}</span>
                      <select defaultValue="" onChange={(e) => grant(e.target.value)}>
                        <option value="">{t('meetings:chooseOwner')}</option>
                        {vt.roster.filter((r) => r.unitId !== myUnitId).map((r) => (
                          <option key={r.unitId} value={r.unitId}>{r.owner || r.unit} ({r.unit})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              {!myRow && !manage && (
                <div className="v-mine">
                  {t('meetings:tenantNoVote')}
                </div>
              )}

              {/* hlasy po bytech s podíly a plnými mocemi */}
              {manage && vt.roster.map((r) => {
                const c = vt.eff(r.unitId)
                const p = vote!.proxies[r.unitId]
                return (
                  <div className="v-row" key={r.unitId}>
                    <b className="u">{r.unit}</b>
                    <span className="who">{r.owner || '—'}{p ? ' · ' + t('meetings:proxyFor', { owner: ownerOf(p) }) : ''}</span>
                    <span className="sh-p">{r.shares} %</span>
                    <span className={'v-tag ' + (c ? TAG[c].c : 'non')}>{c ? TAG[c].l : t('meetings:notVoted')}</span>
                  </div>
                )
              })}

              {manage && (
                <div className="d-foot">
                  {vote!.open && vt.silent.length > 0 && (
                    <button className="s-btn s-dark sm" onClick={remindSilent} disabled={remindBusy}>
                      {remindBusy ? t('meetings:remindSending') : t('meetings:remindNonVoters', { count: vt.silent.length })}
                    </button>
                  )}
                  <button className="s-btn s-ghost sm" onClick={minutes}>{t('meetings:downloadMinutes')}</button>
                  {vote!.open && <button className="s-btn s-ghost sm" onClick={close}>{t('meetings:closeVote')}</button>}
                  <span className="m" style={{ marginLeft: 'auto' }}>
                    {t('meetings:proxiesRecorded', { count: vt.proxies })}
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
                <b>{t('meetings:assembly')}</b>
                <span className={'s-badge ' + (m.rsvp ? 'ok' : 'purple')}>{m.rsvp ? t('meetings:attending') : t('meetings:inPerson')}</span>
              </div>
              <div className="v-mtg" style={{ marginTop: 11 }}>
                <span className="ic"><SIcon n="vote" s={15} /></span>
                <div>
                  <b>{m.date}</b>
                  <span>{m.place}{typeof m.going === 'number' ? ` · ${t('meetings:attendingCount', { count: m.going })}` : ''}</span>
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
                <button className="s-btn s-dark sm" onClick={() => rsvp(m)}>{m.rsvp ? t('meetings:cancelAttendance') : t('meetings:attending')}</button>
              </div>
            </div>
          ))}
          {meetings.length === 0 && (
            <div className="d-mini an">
              <div className="h"><b>{t('meetings:assembly')}</b></div>
              <p style={{ fontSize: 12, color: 'var(--s-muted)', marginTop: 10, lineHeight: 1.5 }}>
                {manage ? t('meetings:noMeetingManage') : t('meetings:noMeetingResident')}
              </p>
            </div>
          )}

          {podklady.length > 0 && (
            <div className="d-mini an" style={{ ['--d' as string]: '.07s' }}>
              <div className="h"><b>{t('meetings:materials')}</b></div>
              <div className="v-arch">
                {podklady.slice(0, 4).map((d) => (
                  <div key={d.id || d.name}>
                    <span style={{ color: 'var(--s-ink-2)', minWidth: 0 }}>{d.name}</span>
                    <button className="d-link" onClick={async () => {
                      const url = await api.openDocument(d)
                      if (url) window.open(url, '_blank'); else toast(t('meetings:demoDoc'))
                    }}>{(d.kind || 'PDF').toUpperCase()}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="v-ok an" style={{ ['--d' as string]: '.14s' }}>
            <b>{t('meetings:autoMinutes')}</b> {t('meetings:autoMinutesBody')}
          </div>
        </div>
      </div>

      {newVote && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setNewVote(false) }}>
          <div className="modal">
            <div className="modal-h"><h3>{t('meetings:modal.newVoteTitle')}</h3><button className="s-btn s-ghost sm" onClick={() => setNewVote(false)}>{t('meetings:modal.cancel')}</button></div>
            <div className="modal-b">
              <div className="a-f">
                <label htmlFor="v-q">{t('meetings:modal.question')}</label>
                <input id="v-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('meetings:modal.questionPlaceholder')} />
              </div>
              <div className="a-f">
                <label htmlFor="v-k">{t('meetings:modal.quorumLabel')}</label>
                <input id="v-k" type="number" min={1} max={100} value={quorum} onChange={(e) => setQuorum(Number(e.target.value))} />
              </div>
              <div className="v-ok" style={{ marginTop: 12 }}>
                <b>{t('meetings:modal.remindersTitle')}</b> {t('meetings:modal.remindersBody')}
              </div>
            </div>
            <div className="modal-f">
              <button className="s-btn s-ghost" onClick={() => setNewVote(false)}>{t('meetings:modal.cancel')}</button>
              <button className="s-btn s-primary" onClick={createVote}>{t('meetings:modal.submitVote')}</button>
            </div>
          </div>
        </div>
      )}

      {newMeeting && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setNewMeeting(false) }}>
          <div className="modal">
            <div className="modal-h"><h3>{t('meetings:modal.newMeetingTitle')}</h3><button className="s-btn s-ghost sm" onClick={() => setNewMeeting(false)}>{t('meetings:modal.cancel')}</button></div>
            <div className="modal-b">
              <div className="a-f"><label htmlFor="m-d">{t('meetings:modal.when')}</label><input id="m-d" type="datetime-local" value={mDate} onChange={(e) => setMDate(e.target.value)} /></div>
              <div className="a-f"><label htmlFor="m-p">{t('meetings:modal.where')}</label><input id="m-p" value={mPlace} onChange={(e) => setMPlace(e.target.value)} placeholder={t('meetings:modal.wherePlaceholder')} /></div>
              <div className="a-f"><label htmlFor="m-a">{t('meetings:modal.agenda')}</label><textarea id="m-a" rows={4} value={mAgenda} onChange={(e) => setMAgenda(e.target.value)} placeholder={t('meetings:modal.agendaPlaceholder')} /></div>
            </div>
            <div className="modal-f">
              <button className="s-btn s-ghost" onClick={() => setNewMeeting(false)}>{t('meetings:modal.cancel')}</button>
              <button className="s-btn s-primary" onClick={createMeeting}>{t('meetings:modal.submitMeeting')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
