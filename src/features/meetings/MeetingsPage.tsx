import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { Meeting, DocItem, VoteChoice, VoteData } from '../../lib/types'
import { can } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'

const CHOICES: { k: VoteChoice; label: string; col: string }[] = [
  { k: 'ano', label: 'Pro', col: 'var(--ok)' }, { k: 'ne', label: 'Proti', col: 'var(--bad)' }, { k: 'zdrzel', label: 'Zdržel se', col: 'var(--ink-3)' },
]

export default function MeetingsPage() {
  const { user } = useSession(); const role = user?.role; const myUnitId = user?.unitId ?? ''
  const toast = useToast()
  const bid = user?.buildingId || ''
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [vote, setVote] = useState<VoteData | null>(null)
  const [docs, setDocs] = useState<DocItem[]>([])
  const [busy, setBusy] = useState(false)
  const [newMeeting, setNewMeeting] = useState(false)
  const [mDate, setMDate] = useState(''); const [mPlace, setMPlace] = useState(''); const [mAgenda, setMAgenda] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const manage = can(role!, 'manage_meetings')

  const reload = async () => {
    if (!bid) return
    const [ms, v, ds] = await Promise.all([api.getMeetings(bid), api.getVote(bid), api.getDocuments(bid, role)])
    setMeetings(ms); setVote(v); setDocs(ds)
  }
  useEffect(() => { reload().catch((e) => console.error(e)) }, [bid, role])

  async function rsvp(m: Meeting) { try { await api.rsvp(m.id, !m.rsvp); setMeetings(await api.getMeetings(bid)); toast('Účast upravena') } catch (e: any) { toast(e.message || 'Uložení selhalo') } }
  async function cast(c: VoteChoice) { if (!vote?.pollId || !myUnitId) return; try { await api.castVote(vote.pollId, myUnitId, c); setVote(await api.getVote(bid)); toast('Hlas započítán') } catch (e: any) { toast(e.message || 'Hlasování selhalo') } }
  async function grant(to: string) { if (!to || !vote?.pollId || !myUnitId) return; try { await api.setProxy(vote.pollId, myUnitId, to); setVote(await api.getVote(bid)); toast('Plná moc udělena') } catch (e: any) { toast(e.message || 'Nepodařilo se') } }
  async function revoke() { if (!vote?.pollId || !myUnitId) return; await api.clearProxy(vote.pollId, myUnitId); setVote(await api.getVote(bid)); toast('Plná moc zrušena') }
  async function attach(files: FileList | null) {
    if (!files || !files.length) return; setBusy(true)
    try { await api.uploadDocument(bid, files[0], { cat: 'Schůze', vis: ['rezident', 'vybor', 'developer', 'investor'] }); await reload(); toast('Dokument nahrán') }
    catch (e: any) { toast(e.message || 'Nahrání selhalo') } finally { setBusy(false) }
  }
  async function openDoc(d: DocItem) {
    try { const url = await api.openDocument(d); if (url) window.open(url, '_blank'); else toast('Dokument je ukázkový') }
    catch (e: any) { toast(e.message || 'Otevření selhalo') }
  }
  async function createMeeting() {
    if (!mDate || !mPlace.trim()) { toast('Vyplňte termín a místo'); return }
    try {
      await api.createMeeting(bid, new Date(mDate).toISOString(), mPlace.trim(), mAgenda.split('\n').map((a) => a.trim()).filter(Boolean))
      setNewMeeting(false); setMDate(''); setMPlace(''); setMAgenda(''); await reload(); toast('Schůze vytvořena, členové dostali notifikaci')
    } catch (e: any) { toast(e.message || 'Vytvoření selhalo') }
  }

  const roster = vote?.roster || []
  const myRow = roster.find((r) => r.unitId === myUnitId)
  const ownerOf = (uid: string) => { const r = roster.find((x) => x.unitId === uid); return r ? (r.owner || r.unit) : uid }
  const eff = (uid: string): VoteChoice | undefined => { if (!vote) return; if (vote.ballots[uid]) return vote.ballots[uid]; const p = vote.proxies[uid]; if (p && vote.ballots[p]) return vote.ballots[p]; return undefined }
  const total = roster.reduce((s, r) => s + r.shares, 0)
  const tally: Record<VoteChoice, number> = { ano: 0, ne: 0, zdrzel: 0 }; let participating = 0
  roster.forEach((r) => { const c = eff(r.unitId); if (c) { tally[c] += r.shares; participating += r.shares } })
  const castTotal = tally.ano + tally.ne + tally.zdrzel
  const quorumMet = total > 0 && (participating / total) * 100 >= (vote?.quorum || 0)
  const mine = vote && myUnitId ? vote.ballots[myUnitId] : undefined
  const myProxy = vote && myUnitId ? vote.proxies[myUnitId] : undefined
  const hasPoll = Boolean(vote?.pollId)

  function zapis(m: Meeting) {
    const dec = quorumMet ? (tally.ano > tally.ne ? 'SCHVÁLENO' : 'NESCHVÁLENO') : 'NEUSNÁŠENÍSCHOPNÉ'
    const row = (l: string, v: string) => `<tr><td style="padding:6px 12px;color:#5b6b62">${l}</td><td style="padding:6px 12px;font-weight:600">${v}</td></tr>`
    const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Zápis ze schůze</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:40px auto;color:#12161d">
<h1 style="color:#1e3a34">Zápis ze schůze vlastníků</h1>
<p style="color:#5b6b62">${m.date} · ${m.place} · ${user?.buildingName || ''}</p>
<h3>Účast a usnášeníschopnost</h3>
<table style="border-collapse:collapse;font-size:14px">
${row('Přítomné podíly', participating.toFixed(1) + ' z ' + total.toFixed(1) + ' (' + (total ? (participating / total * 100).toFixed(0) : 0) + ' %)')}
${row('Potřebné kvórum', (vote?.quorum || 0) + ' %')}
${row('Stav', quorumMet ? 'Usnášeníschopné' : 'Neusnášeníschopné')}
</table>
<h3>Program</h3><ol>${m.agenda.map((a) => `<li>${a}</li>`).join('')}</ol>
${hasPoll ? `<h3>Hlasování</h3><p><b>${vote?.q || ''}</b></p>
<table style="border-collapse:collapse;font-size:14px">
${row('Pro', tally.ano.toFixed(1) + ' podílů (' + (castTotal ? (tally.ano / castTotal * 100).toFixed(0) : 0) + ' %)')}
${row('Proti', tally.ne.toFixed(1) + ' podílů (' + (castTotal ? (tally.ne / castTotal * 100).toFixed(0) : 0) + ' %)')}
${row('Zdrželo se', tally.zdrzel.toFixed(1) + ' podílů')}
</table>
<p style="margin-top:16px;font-size:18px"><b>Rozhodnutí: ${dec}</b></p>` : ''}
<p style="color:#8a97a0;font-size:12px;margin-top:40px">Vygenerováno aplikací Tasker Living, ${new Date().toLocaleString('cs-CZ')}</p>
</body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'zapis-schuze.html'; a.click()
    toast('Zápis vygenerován, nahrajte ho do Dokumentů')
  }

  return (
    <div>
      <div className="view-head">
        <div><h1>Schůze a hlasování</h1><div className="desc">Termíny, program, hlasování podle podílů a dokumenty</div></div>
        {manage && <button className="btn btn-primary btn-sm" onClick={() => setNewMeeting(true)}><Icon name="plus" small /> Nová schůze</button>}
      </div>

      <div className="grid-2">
        <div style={{ display: 'grid', gap: 16 }}>
          {meetings.map((m) => (
            <div className="stat" key={m.id}>
              <div className="card-h"><h3>Schůze vlastníků</h3>{m.rsvp ? <span className="pill pill-ok">Přijdu</span> : <span className="pill pill-neutral">Bez odpovědi</span>}</div>
              <div className="doc-row"><span className="cf-ic"><Icon name="schuze" small /></span><div><b>{m.date}</b><span>{m.place}{typeof m.going === 'number' ? ` · ${m.going} přijde` : ''}</span></div></div>
              {m.agenda.length > 0 && <div style={{ margin: '12px 0' }}><b style={{ fontSize: 13 }}>Program</b><ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14, color: 'var(--ink-2)' }}>{m.agenda.map((a, i) => <li key={i} style={{ margin: '2px 0' }}>{a}</li>)}</ul></div>}
              <div className="cta-row">
                <button className="btn btn-gold btn-sm" onClick={() => rsvp(m)}>{m.rsvp ? 'Zrušit účast' : 'Přijdu'}</button>
                {manage && <button className="btn btn-soft btn-sm" onClick={() => zapis(m)}><Icon name="doc" small /> Vytvořit zápis</button>}
              </div>
            </div>
          ))}
          {meetings.length === 0 && <div className="empty"><span className="cf-ic"><Icon name="schuze" /></span><p>{manage ? 'Zatím žádná schůze. Vytvořte první tlačítkem nahoře.' : 'Zatím není naplánovaná žádná schůze.'}</p></div>}

          {vote && hasPoll && (
            <div className="stat">
              <div className="card-h"><h3>Hlasování podle podílů</h3>{!vote.open ? <span className="pill pill-neutral">Uzavřeno</span> : quorumMet ? <span className="pill pill-ok">Usnášeníschopné</span> : <span className="pill pill-warn">Zatím neusnášeníschopné</span>}</div>
              <p style={{ fontSize: 14.5, marginBottom: 14 }}>{vote.q}</p>

              {myRow && vote.open ? (
                <>
                  <div className="cta-row" style={{ marginBottom: 6 }}>
                    {CHOICES.map((c) => <button key={c.k} className={'btn btn-sm ' + (mine === c.k ? 'btn-primary' : 'btn-ghost')} onClick={() => cast(c.k)} disabled={!!myProxy}>{c.label}</button>)}
                  </div>
                  {myProxy
                    ? <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Plnou moc za vás ({myRow.shares} %) má <b>{ownerOf(myProxy)}</b>. <button className="linklike" onClick={revoke}>Zrušit</button></p>
                    : <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>nebo plná moc:</span>
                        <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} defaultValue="" onChange={(e) => grant(e.target.value)}>
                          <option value="">vyberte vlastníka</option>{roster.filter((r) => r.unitId !== myUnitId).map((r) => <option key={r.unitId} value={r.unitId}>{r.owner || r.unit} ({r.unit})</option>)}
                        </select>
                      </div>}
                </>
              ) : !myRow ? <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Hlasování je určeno vlastníkům jednotek.</p> : null}

              <div style={{ marginTop: 16 }}>
                {CHOICES.map((c) => (
                  <div className="vbar" key={c.k}>
                    <div className="vhead"><span>{c.label}</span><span>{tally[c.k].toFixed(1)} % podílů{castTotal ? ` · ${(tally[c.k] / castTotal * 100).toFixed(0)} %` : ''}</span></div>
                    <div className="vtrack"><div className="vfill" style={{ width: castTotal ? `${tally[c.k] / castTotal * 100}%` : '0%', background: c.col }} /></div>
                  </div>
                ))}
                <div className="quorum">
                  <Icon name={quorumMet ? 'check' : 'clock'} small />
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <b>Kvórum {vote.quorum} %</b><div style={{ color: 'var(--ink-3)' }}>Přítomno {participating.toFixed(1)} % z {total.toFixed(1)} % podílů</div>
                    <div className="vtrack" style={{ marginTop: 6 }}><div className="vfill" style={{ width: `${Math.min(100, total ? participating / total * 100 : 0)}%`, background: quorumMet ? 'var(--ok)' : 'var(--warn)' }} /></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {vote && !hasPoll && manage && (
            <div className="stat"><div className="card-h"><h3>Hlasování</h3></div><p className="adm-mini">Žádné hlasování neběží. Nové vypíšete ve Správě, záložka Schůze.</p></div>
          )}
        </div>

        <div className="stat" style={{ alignSelf: 'start' }}>
          <div className="card-h"><h3>Dokumenty</h3>{manage && <button className="btn btn-soft btn-sm" onClick={() => fileRef.current?.click()}>{busy ? <span className="spin" style={{ width: 16, height: 16, margin: 0 }} /> : <><Icon name="plus" small /> Nahrát</>}</button>}</div>
          <input ref={fileRef} className="file-in" type="file" onChange={(e) => attach(e.target.files)} />
          {docs.map((d) => (
            <div className="doc-row" key={d.id || d.name}><span className="cf-ic"><Icon name="doc" small /></span><div style={{ flex: 1, minWidth: 0 }}><b>{d.name}</b><span>{d.cat ? d.cat + ' · ' : ''}{d.kind} · {d.date}</span></div><button className="btn btn-ghost btn-sm" onClick={() => openDoc(d)}>Otevřít</button></div>
          ))}
          {docs.length === 0 && <p className="adm-mini">Žádné dostupné dokumenty pro vaši roli.</p>}
        </div>
      </div>

      {newMeeting && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setNewMeeting(false) }}>
          <div className="modal">
            <div className="modal-h"><h3>Nová schůze</h3><button className="btn btn-ghost btn-icon" onClick={() => setNewMeeting(false)}><Icon name="x" small /></button></div>
            <div className="modal-b">
              <div className="field"><label>Termín</label><input className="input" type="datetime-local" value={mDate} onChange={(e) => setMDate(e.target.value)} /></div>
              <div className="field"><label>Místo</label><input className="input" placeholder="Např. Společenská místnost" value={mPlace} onChange={(e) => setMPlace(e.target.value)} /></div>
              <div className="field"><label>Program (bod na řádek)</label><textarea className="input" rows={4} placeholder={'Roční vyúčtování\nFond oprav'} value={mAgenda} onChange={(e) => setMAgenda(e.target.value)} /></div>
            </div>
            <div className="modal-f"><button className="btn btn-ghost" onClick={() => setNewMeeting(false)}>Zrušit</button><button className="btn btn-primary" onClick={createMeeting}>Vytvořit a oznámit</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
