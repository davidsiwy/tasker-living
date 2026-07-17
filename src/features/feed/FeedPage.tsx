import { useEffect, useMemo, useRef, useState } from 'react'
import { feed, api } from '../../lib/api'
import type { FeedPost, FeedType, Role, ReadRow } from '../../lib/types'
import { can, audienceLabel } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'

const when = (iso: string) => {
  const d = new Date(iso)
  const s = (Date.now() - d.getTime()) / 1000
  if (s < 60) return 'teď'
  if (s < 3600) return 'před ' + Math.floor(s / 60) + ' min'
  if (s < 86400) return 'dnes ' + d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' })
}
const AUD = ['all', 'entrance:A', 'entrance:B', 'garages', 'owners']
const STATE: Record<string, { l: string; c: string }> = {
  read: { l: 'Přečteno', c: 'ok' },
  delivered: { l: 'Doručeno', c: 'neutral' },
  unconnected: { l: 'Dopis ve schránce', c: 'warn' },
}

// Oznámení (handoff 4a): napsat jednou, doručit všem, vidět kdo si přečetl.
// Čtenost po bytech (7e) se rozbaluje pod oznámením, ne na vlastní stránce.
export default function FeedPage() {
  const { user } = useSession()
  const toast = useToast()
  const canPost = user ? can(user.role as Role, 'post_announcement') : false

  const [posts, setPosts] = useState<FeedPost[]>([])
  const [units, setUnits] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [aud, setAud] = useState('all')
  const [push, setPush] = useState(true)
  const [kind, setKind] = useState<FeedType>('ozn')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, ReadRow[]>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    if (!user) return
    try { setPosts(await feed.list(user.buildingId)) } catch (e) { console.error(e) }
  }
  useEffect(() => { load() }, [user?.buildingId])

  useEffect(() => {
    if (!user) return
    api.getNeighbors(user.buildingId).then((n) => setUnits(n.length)).catch(() => setUnits(0))
  }, [user?.buildingId])

  useEffect(() => {
    if (!user) return
    return feed.subscribe(user.buildingId, load)
  }, [user?.buildingId])

  // soused si přečtením zapíše přečtení — z toho výbor vidí čtenost po bytech
  useEffect(() => {
    if (!user || canPost || !posts.length) return
    for (const p of posts.slice(0, 10)) feed.markRead(p.id, user.unitId).catch(() => {})
  }, [posts.length, canPost, user?.unitId])

  const targetCount = useMemo(() => {
    if (!units) return 0
    if (aud === 'all') return units
    if (aud === 'owners') return Math.round(units * 0.85)
    return Math.max(1, Math.round(units / 2))
  }, [aud, units])

  async function toggleStats(p: FeedPost) {
    const willOpen = openId !== p.id
    setOpenId(willOpen ? p.id : null)
    if (willOpen && !rows[p.id]) {
      try {
        const r = await feed.readStats(p.id)
        setRows((s) => ({ ...s, [p.id]: r }))
      } catch { toast('Čtenost se nepodařilo načíst') }
    }
  }

  function pick(f?: File | null) { if (!f) return; setFile(f); setPreview(URL.createObjectURL(f)) }

  async function send() {
    if (!user || busy) return
    if (!title.trim() && !body.trim()) { toast('Napište aspoň nadpis nebo text'); return }
    setBusy(true)
    try {
      let imageUrl: string | undefined
      if (file) imageUrl = await feed.uploadImage(file, user.buildingId)
      await feed.createPost({
        buildingId: user.buildingId,
        author: { name: user.name, handle: user.handle, role: user.role },
        kind, title: title.trim() || undefined, body: body.trim(), audience: aud, push, imageUrl,
      })
      setTitle(''); setBody(''); setFile(null); setPreview(''); setAud('all'); setPush(true)
      await load()
      toast(push ? 'Odesláno, notifikace jsou na cestě' : 'Odesláno')
    } catch (e: any) { toast(e.message || 'Nepodařilo se odeslat') } finally { setBusy(false) }
  }

  if (!user) return null

  return (
    <div className="a-grid">
      {canPost ? (
        <div className="a-comp an">
          <b>Nové oznámení</b>

          <div className="a-f">
            <label htmlFor="a-t">Nadpis</label>
            <input id="a-t" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Čištění garáží v pondělí 21. 7." />
          </div>
          <div className="a-f">
            <label htmlFor="a-b">Text</label>
            <textarea id="a-b" rows={3} value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="Prosíme o přeparkování vozidel z garáží do 8:00…" />
          </div>

          {preview && (
            <div className="a-thumb">
              <img src={preview} alt="" />
              <button onClick={() => { setFile(null); setPreview('') }} aria-label="Odebrat fotku">×</button>
            </div>
          )}

          <div className="a-f">
            <label>Komu</label>
            <div className="a-chips">
              {AUD.map((a) => (
                <button key={a} className={'a-chip' + (aud === a ? ' on' : '')} onClick={() => setAud(a)}>
                  {audienceLabel(a)}
                </button>
              ))}
            </div>
          </div>

          <div className="a-f">
            <label>Typ</label>
            <div className="a-chips">
              {(['ozn', 'udal', 'kom'] as FeedType[]).map((k) => (
                <button key={k} className={'a-chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>
                  {k === 'ozn' ? 'Oznámení' : k === 'udal' ? 'Událost' : 'Komunita'}
                </button>
              ))}
            </div>
          </div>

          <div className="a-push">
            <div>
              <b>Push notifikace</b>
              <span>{push ? 'přijde hned na telefony' : 'jen v aplikaci a e-mailem'}</span>
            </div>
            <button className={'a-tog' + (push ? ' on' : '')} onClick={() => setPush((v) => !v)}
              aria-pressed={push} aria-label="Push notifikace" />
          </div>

          <div className="a-send">
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => pick(e.target.files?.[0])} />
            <button className="s-btn s-primary" onClick={send} disabled={busy}>
              {busy ? 'Odesílám…' : targetCount ? `Odeslat ${targetCount} bytům` : 'Odeslat'}
            </button>
            <button className="s-btn s-ghost sm" onClick={() => fileRef.current?.click()}>Přidat fotku</button>
          </div>
        </div>
      ) : (
        <div className="a-comp an">
          <b>Oznámení domu</b>
          <p style={{ fontSize: 12.5, color: 'var(--s-ink-2)', lineHeight: 1.55, marginTop: 8 }}>
            Tady je všechno, co výbor pošle do domu. Nová oznámení vám přijdou jako notifikace do telefonu,
            takže vám nic neuteče ani bez chození k nástěnce.
          </p>
        </div>
      )}

      <div className="a-list">
        {posts.length === 0 && (
          <div className="a-item" style={{ textAlign: 'center', padding: '34px 20px' }}>
            <b style={{ display: 'block', fontSize: 15 }}>Zatím žádná oznámení</b>
            <p style={{ fontSize: 12.5, color: 'var(--s-ink-2)', lineHeight: 1.55, margin: '6px auto 0', maxWidth: '30em' }}>
              {canPost
                ? 'Napište první — třeba přivítání sousedů v aplikaci. Stačí nadpis a dvě věty.'
                : 'Až výbor něco pošle, objeví se to tady a přijde vám notifikace.'}
            </p>
          </div>
        )}

        {posts.map((p, i) => {
          const reads = p.reads || 0
          const pct = units ? Math.min(100, Math.round((reads / units) * 100)) : 0
          const open = openId === p.id
          return (
            <div className={'a-item an' + (p.kind === 'ozn' ? ' ozn' : '')} key={p.id}
              style={{ ['--d' as string]: `${Math.min(i, 6) * 0.05}s` }}>
              <div className="a-h">
                <b>{p.title || p.body.slice(0, 70) || 'Bez nadpisu'}</b>
                <span className="a-aud">{audienceLabel(p.audience || 'all')}</span>
              </div>
              <span className="a-meta">
                odesláno {when(p.createdAt)} · {p.push === false ? 'v aplikaci' : 'push + e-mail'} · {p.authorName}
              </span>
              {p.title && p.body && <div className="a-body">{p.body}</div>}
              {p.imageUrl && <div className="a-thumb"><img src={p.imageUrl} alt="" /></div>}

              {canPost && (
                <>
                  <div className="a-read">
                    <span className="l">Přečteno</span>
                    <div className="bar" style={{ flex: 1, marginTop: 0 }}>
                      <i style={{ width: `${pct}%`, ['--d' as string]: '.15s' }} />
                    </div>
                    <b>{reads} / {units || '—'} bytů</b>
                  </div>
                  <div className="a-acts">
                    <button className="s-btn s-ghost sm" onClick={() => toggleStats(p)}>
                      {open ? 'Skrýt čtenost' : 'Čtenost po bytech'}
                    </button>
                    {units > reads && <span className="a-note">{units - reads} bytů zatím nečetlo</span>}
                  </div>

                  {open && (
                    <div className="a-units">
                      {(rows[p.id] || []).length === 0 && (
                        <div className="a-unit" style={{ color: 'var(--s-muted)' }}>Načítám…</div>
                      )}
                      {(rows[p.id] || []).map((r) => (
                        <div className="a-unit" key={r.unitId}>
                          <b>{r.unitLabel}</b>
                          <span style={{ flex: 1, color: 'var(--s-ink-2)' }}>
                            {r.state === 'unconnected' ? '— nepřipojeno —' : r.readAt ? when(r.readAt) : 'doručeno'}
                          </span>
                          <span className={'s-badge ' + STATE[r.state].c}>{STATE[r.state].l}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}

        {canPost && posts.length > 0 && (
          <div className="a-note">
            U každého oznámení vidíte doručení i přečtení po bytech — víte, koho obejít osobně.
            Nepřipojeným bytům se tiskne dopis do schránky.
          </div>
        )}
      </div>
    </div>
  )
}
