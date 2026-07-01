import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Meeting, Poll, DocItem } from '../../lib/types'
import { can } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'

export default function MeetingsPage() {
  const { user } = useSession(); const role = user?.role
  const toast = useToast()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [poll, setPoll] = useState<Poll | null>(null)
  const [docs, setDocs] = useState<DocItem[]>([])
  useEffect(() => { api.getMeetings().then(setMeetings); api.getPoll().then(setPoll); api.getDocuments().then(setDocs) }, [])
  async function rsvp(id: number) { await api.rsvp(id); setMeetings(await api.getMeetings()); toast('Účast upravena') }
  async function vote(c: 'yes' | 'no') { const p = await api.vote(c); setPoll(p); toast('Hlas započítán') }
  const total = poll ? poll.yes + poll.no : 0
  const manage = can(role!, 'manage_meetings')

  return (
    <div>
      <div className="view-head">
        <div><h1>Schůze a hlasování</h1><div className="desc">Termíny, program, hlasování per rollam a dokumenty</div></div>
        {manage && <button className="btn btn-primary btn-sm" onClick={() => toast('Formulář nové schůze, doplní se')}><Icon name="plus" small /> Nová schůze</button>}
      </div>

      <div className="grid-2">
        <div style={{ display: 'grid', gap: 16 }}>
          {meetings.map((m) => (
            <div className="stat" key={m.id}>
              <div className="card-h"><h3>Schůze vlastníků</h3>{m.rsvp ? <span className="pill pill-ok">Přijdu</span> : <span className="pill pill-neutral">Bez odpovědi</span>}</div>
              <div className="doc-row"><span className="cf-ic"><Icon name="schuze" small /></span><div><b>{m.date}</b><span>{m.place}</span></div></div>
              <div style={{ margin: '12px 0' }}><b style={{ fontSize: 13 }}>Program</b><ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14, color: 'var(--ink-2)' }}>{m.agenda.map((a, i) => <li key={i} style={{ margin: '2px 0' }}>{a}</li>)}</ul></div>
              <div className="cta-row"><button className="btn btn-gold btn-sm" onClick={() => rsvp(m.id)}>{m.rsvp ? 'Zrušit účast' : 'Přijdu'}</button></div>
            </div>
          ))}

          {poll && (
            <div className="stat">
              <div className="card-h"><h3>Hlasování per rollam</h3></div>
              <p style={{ fontSize: 14.5, marginBottom: 14 }}>{poll.q}</p>
              <div style={{ display: 'grid', gap: 10 }}>
                <div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>Pro</span><span>{poll.yes}</span></div><div style={{ height: 8, background: 'var(--line)', borderRadius: 99 }}><div style={{ height: 8, width: total ? `${(poll.yes / total) * 100}%` : '0%', background: 'var(--ok)', borderRadius: 99 }} /></div></div>
                <div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>Proti</span><span>{poll.no}</span></div><div style={{ height: 8, background: 'var(--line)', borderRadius: 99 }}><div style={{ height: 8, width: total ? `${(poll.no / total) * 100}%` : '0%', background: 'var(--bad)', borderRadius: 99 }} /></div></div>
              </div>
              {!poll.voted ? <div className="cta-row" style={{ marginTop: 14 }}><button className="btn btn-primary btn-sm" onClick={() => vote('yes')}>Pro</button><button className="btn btn-ghost btn-sm" onClick={() => vote('no')}>Proti</button></div> : <p style={{ marginTop: 12, fontSize: 13, color: 'var(--ok)' }}>Váš hlas byl započítán.</p>}
            </div>
          )}
        </div>

        <div className="stat" style={{ alignSelf: 'start' }}>
          <div className="card-h"><h3>Dokumenty</h3></div>
          {docs.map((d, i) => (
            <div className="doc-row" key={i}><span className="cf-ic"><Icon name="doc" small /></span><div style={{ flex: 1 }}><b>{d.name}</b><span>{d.kind} · {d.date}</span></div><button className="btn btn-ghost btn-sm" onClick={() => toast('Stažení dokumentu')}>Otevřít</button></div>
          ))}
        </div>
      </div>
    </div>
  )
}
