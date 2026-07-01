import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { Meeting, DocItem, VoteChoice } from '../../lib/types'
import { can } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'
import { uploadFile } from '../../lib/storage'

type Vote = { q: string; quorum: number; roster: { unit: string; owner: string; shares: number }[]; ballots: Record<string, VoteChoice>; proxies: Record<string, string> }
const CHOICES: { k: VoteChoice; label: string; col: string }[] = [
  { k: 'ano', label: 'Pro', col: 'var(--ok)' }, { k: 'ne', label: 'Proti', col: 'var(--bad)' }, { k: 'zdrzel', label: 'Zdržel se', col: 'var(--ink-3)' },
]

export default function MeetingsPage() {
  const { user } = useSession(); const role = user?.role; const myUnit = user?.unit ?? ''
  const toast = useToast()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [vote, setVote] = useState<Vote | null>(null)
  const [docs, setDocs] = useState<DocItem[]>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const manage = can(role!, 'manage_meetings')

  useEffect(() => { api.getMeetings().then(setMeetings); api.getVote().then(setVote); if (role) api.getDocuments(role).then(setDocs) }, [role])
  const reloadVote = async () => setVote(await api.getVote())
  const reloadDocs = async () => { if (role) setDocs(await api.getDocuments(role)) }

  async function rsvp(id: number) { await api.rsvp(id); setMeetings(await api.getMeetings()); toast('Účast upravena') }
  async function cast(c: VoteChoice) { if (!myRow) return; await api.castVote(myUnit, c); await reloadVote(); toast('Hlas započítán') }
  async function grant(to: string) { if (!to) return; await api.setProxy(myUnit, to); await reloadVote(); toast('Plná moc udělena') }
  async function revoke() { await api.clearProxy(myUnit); await reloadVote(); toast('Plná moc zrušena') }
  async function attach(files: FileList | null) {
    if (!files || !files.length) return; setBusy(true)
    const f = files[0]; const s = await uploadFile(f, 'docs')
    await api.uploadDocument({ name: f.name, kind: (f.name.split('.').pop() || 'PDF').toUpperCase(), date: 'dnes', cat: 'Schůze', vis: ['rezident', 'vybor', 'developer', 'investor'], url: s.url })
    setBusy(false); await reloadDocs(); toast('Dokument nahrán')
  }

  const roster = vote?.roster || []
  const myRow = roster.find((r) => r.unit === myUnit)
  const ownerOf = (u: string) => roster.find((r) => r.unit === u)?.owner || u
  const eff = (u: string): VoteChoice | undefined => { if (!vote) return; if (vote.ballots[u]) return vote.ballots[u]; const p = vote.proxies[u]; if (p && vote.ballots[p]) return vote.ballots[p]; return undefined }
  const total = roster.reduce((s, r) => s + r.shares, 0)
  const tally: Record<VoteChoice, number> = { ano: 0, ne: 0, zdrzel: 0 }; let participating = 0
  roster.forEach((r) => { const c = eff(r.unit); if (c) { tally[c] += r.shares; participating += r.shares } })
  const castTotal = tally.ano + tally.ne + tally.zdrzel
  const quorumMet = total > 0 && (participating / total) * 100 >= (vote?.quorum || 0)
  const mine = vote?.ballots[myUnit]; const myProxy = vote?.proxies[myUnit]

  function zapis(m: Meeting) {
    const dec = quorumMet ? (tally.ano > tally.ne ? 'SCHVÁLENO' : 'NESCHVÁLENO') : 'NEUSNÁŠENÍSCHOPNÉ'
    const row = (l: string, v: string) => `<tr><td style="padding:6px 12px;color:#5b6b62">${l}</td><td style="padding:6px 12px;font-weight:600">${v}</td></tr>`
    const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Zápis ze schůze</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:40px auto;color:#12161d">
<h1 style="color:#1e3a34">Zápis ze schůze vlastníků</h1>
<p style="color:#5b6b62">${m.date} · ${m.place} · SV Vista Park</p>
<h3>Účast a usnášeníschopnost</h3>
<table style="border-collapse:collapse;font-size:14px">
${row('Přítomné podíly', participating.toFixed(1) + ' z ' + total.toFixed(1) + ' (' + (total ? (participating / total * 100).toFixed(0) : 0) + ' %)')}
${row('Potřebné kvórum', (vote?.quorum || 0) + ' %')}
${row('Stav', quorumMet ? 'Usnášeníschopné' : 'Neusnášeníschopné')}
</table>
<h3>Program</h3><ol>${m.agenda.map((a) => `<li>${a}</li>`).join('')}</ol>
<h3>Hlasování</h3><p><b>${vote?.q || ''}</b></p>
<table style="border-collapse:collapse;font-size:14px">
${row('Pro', tally.ano.toFixed(1) + ' podílů (' + (castTotal ? (tally.ano / castTotal * 100).toFixed(0) : 0) + ' %)')}
${row('Proti', tally.ne.toFixed(1) + ' podílů (' + (castTotal ? (tally.ne / castTotal * 100).toFixed(0) : 0) + ' %)')}
${row('Zdrželo se', tally.zdrzel.toFixed(1) + ' podílů')}
</table>
<p style="margin-top:16px;font-size:18px"><b>Rozhodnutí: ${dec}</b></p>
<p style="color:#8a97a0;font-size:12px;margin-top:40px">Vygenerováno aplikací Tasker Living, ${new Date().toLocaleString('cs-CZ')}</p>
</body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'zapis-schuze.html'; a.click()
    api.uploadDocument({ name: 'Zápis ze schůze ' + m.date.split(',')[0], kind: 'HTML', date: 'dnes', cat: 'Zápisy', vis: ['rezident', 'vybor', 'developer', 'investor'], url }).then(reloadDocs)
    toast('Zápis vygenerován a uložen')
  }

  return (
    <div>
      <div className="view-head">
        <div><h1>Schůze a hlasování</h1><div className="desc">Termíny, program, hlasování podle podílů a dokumenty</div></div>
        {manage && <button className="btn btn-primary btn-sm" onClick={() => toast('Formulář nové schůze, doplní se')}><Icon name="plus" small /> Nová schůze</button>}
      </div>

      <div className="grid-2">
        <div style={{ display: 'grid', gap: 16 }}>
          {meetings.map((m) => (
            <div className="stat" key={m.id}>
              <div className="card-h"><h3>Schůze vlastníků</h3>{m.rsvp ? <span className="pill pill-ok">Přijdu</span> : <span className="pill pill-neutral">Bez odpovědi</span>}</div>
              <div className="doc-row"><span className="cf-ic"><Icon name="schuze" small /></span><div><b>{m.date}</b><span>{m.place}</span></div></div>
              <div style={{ margin: '12px 0' }}><b style={{ fontSize: 13 }}>Program</b><ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14, color: 'var(--ink-2)' }}>{m.agenda.map((a, i) => <li key={i} style={{ margin: '2px 0' }}>{a}</li>)}</ul></div>
              <div className="cta-row">
                <button className="btn btn-gold btn-sm" onClick={() => rsvp(m.id)}>{m.rsvp ? 'Zrušit účast' : 'Přijdu'}</button>
                {manage && <button className="btn btn-soft btn-sm" onClick={() => zapis(m)}><Icon name="doc" small /> Vytvořit zápis</button>}
              </div>
            </div>
          ))}

          {vote && (
            <div className="stat">
              <div className="card-h"><h3>Hlasování podle podílů</h3>{quorumMet ? <span className="pill pill-ok">Usnášeníschopné</span> : <span className="pill pill-warn">Zatím neusnášeníschopné</span>}</div>
              <p style={{ fontSize: 14.5, marginBottom: 14 }}>{vote.q}</p>

              {myRow ? (
                <>
                  <div className="cta-row" style={{ marginBottom: 6 }}>
                    {CHOICES.map((c) => <button key={c.k} className={'btn btn-sm ' + (mine === c.k ? 'btn-primary' : 'btn-ghost')} onClick={() => cast(c.k)} disabled={!!myProxy}>{c.label}</button>)}
                  </div>
                  {myProxy
                    ? <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Plnou moc za vás ({myRow.shares} %) má <b>{ownerOf(myProxy)}</b>. <button className="linklike" onClick={revoke}>Zrušit</button></p>
                    : <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>nebo plná moc:</span>
                        <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} defaultValue="" onChange={(e) => grant(e.target.value)}>
                          <option value="">vyberte vlastníka</option>{roster.filter((r) => r.unit !== myUnit).map((r) => <option key={r.unit} value={r.unit}>{r.owner} ({r.unit})</option>)}
                        </select>
                      </div>}
                </>
              ) : <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Hlasování je určeno vlastníkům jednotek.</p>}

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
        </div>

        <div className="stat" style={{ alignSelf: 'start' }}>
          <div className="card-h"><h3>Dokumenty</h3>{manage && <button className="btn btn-soft btn-sm" onClick={() => fileRef.current?.click()}>{busy ? <span className="spin" style={{ width: 16, height: 16, margin: 0 }} /> : <><Icon name="plus" small /> Nahrát</>}</button>}</div>
          <input ref={fileRef} className="file-in" type="file" onChange={(e) => attach(e.target.files)} />
          {docs.map((d) => (
            <div className="doc-row" key={d.id || d.name}><span className="cf-ic"><Icon name="doc" small /></span><div style={{ flex: 1, minWidth: 0 }}><b>{d.name}</b><span>{d.cat ? d.cat + ' · ' : ''}{d.kind} · {d.date}</span></div><button className="btn btn-ghost btn-sm" onClick={() => d.url ? window.open(d.url, '_blank') : toast('Dokument je ukázkový')}>Otevřít</button></div>
          ))}
          {docs.length === 0 && <p className="adm-mini">Žádné dostupné dokumenty pro vaši roli.</p>}
        </div>
      </div>
    </div>
  )
}
