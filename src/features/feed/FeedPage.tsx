import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { feed, api } from '../../lib/api'
import type { FeedPost, FeedType, Role, ReadRow, FeedComment } from '../../lib/types'
import { can, audienceLabel } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { SIcon } from '../../components/AppShell'

const when = (iso: string) => {
  const d = new Date(iso)
  const s = (Date.now() - d.getTime()) / 1000
  if (s < 60) return 'teď'
  if (s < 3600) return Math.floor(s / 60) + ' min'
  if (s < 86400) return Math.floor(s / 3600) + ' h'
  if (s < 86400 * 6) return Math.floor(s / 86400) + ' d'
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
}
const initials = (name: string) => name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
const AUD = ['all', 'entrance:A', 'entrance:B', 'garages', 'owners']
const OFFICIAL: Role[] = ['vybor', 'developer']
const STATE: Record<string, { l: string; c: string }> = {
  read: { l: 'Přečteno', c: 'ok' },
  delivered: { l: 'Doručeno', c: 'neutral' },
  unconnected: { l: 'Dopis ve schránce', c: 'warn' },
}

// Nástěnka jako feed, ne jako formulář: composer sbalený do jednoho řádku,
// příspěvky pod sebou v úzkém sloupci s tenkými oddělovači, akce (lajk,
// komentáře, čtenost) jako kompaktní řádek ikon dole — ne jako samostatné
// boxy. Lajky a komentáře používají api, co už existovalo a nikdy se
// nezapojilo do UI.
export default function FeedPage() {
  const { user } = useSession()
  const toast = useToast()
  const [params] = useSearchParams()
  const canPost = user ? can(user.role as Role, 'post_announcement') : false

  const [posts, setPosts] = useState<FeedPost[]>([])
  const [units, setUnits] = useState(0)
  const [composerOpen, setComposerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [aud, setAud] = useState('all')
  const [push, setPush] = useState(true)
  const [kind, setKind] = useState<FeedType>('ozn')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [openStats, setOpenStats] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, ReadRow[]>>({})
  const [openComments, setOpenComments] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, FeedComment[]>>({})
  const [draftComment, setDraftComment] = useState<Record<string, string>>({})
  const [likeBusy, setLikeBusy] = useState<Record<string, boolean>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const scrolledTo = useRef(false)

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

  // deep-link z vyhledávání: ?post=<id> naskočí a krátce zvýrazní
  useEffect(() => {
    const target = params.get('post')
    if (!target || scrolledTo.current || !posts.length) return
    const el = itemRefs.current[target]
    if (el) {
      scrolledTo.current = true
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('flash')
      setTimeout(() => el.classList.remove('flash'), 2200)
    }
  }, [posts, params])

  const targetCount = useMemo(() => {
    if (!units) return 0
    if (aud === 'all') return units
    if (aud === 'owners') return Math.round(units * 0.85)
    return Math.max(1, Math.round(units / 2))
  }, [aud, units])

  async function toggleStats(p: FeedPost) {
    const willOpen = openStats !== p.id
    setOpenStats(willOpen ? p.id : null)
    if (willOpen && !rows[p.id]) {
      try { const r = await feed.readStats(p.id); setRows((s) => ({ ...s, [p.id]: r })) }
      catch { toast('Čtenost se nepodařilo načíst') }
    }
  }

  async function toggleCommentsFor(p: FeedPost) {
    const willOpen = openComments !== p.id
    setOpenComments(willOpen ? p.id : null)
    if (willOpen && !comments[p.id]) {
      try { const c = await feed.getComments(p.id); setComments((s) => ({ ...s, [p.id]: c })) }
      catch { toast('Komentáře se nepodařilo načíst') }
    }
  }

  async function submitComment(p: FeedPost) {
    const text = (draftComment[p.id] || '').trim()
    if (!user || !text) return
    try {
      const c = await feed.addComment(p.id, { name: user.name, handle: user.handle, role: user.role }, text)
      setComments((s) => ({ ...s, [p.id]: [...(s[p.id] || []), c] }))
      setDraftComment((s) => ({ ...s, [p.id]: '' }))
      setPosts((s) => s.map((x) => x.id === p.id ? { ...x, commentCount: x.commentCount + 1 } : x))
    } catch (e: any) { toast(e.message || 'Komentář se nepodařilo odeslat') }
  }

  async function toggleLike(p: FeedPost) {
    if (likeBusy[p.id]) return
    setLikeBusy((s) => ({ ...s, [p.id]: true }))
    setPosts((s) => s.map((x) => x.id === p.id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x))
    try { await feed.toggleLike(p) }
    catch { setPosts((s) => s.map((x) => x.id === p.id ? { ...x, liked: p.liked, likes: p.likes } : x)); toast('Lajk se nepodařilo uložit') }
    finally { setLikeBusy((s) => ({ ...s, [p.id]: false })) }
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
      setTitle(''); setBody(''); setFile(null); setPreview(''); setAud('all'); setPush(true); setComposerOpen(false)
      await load()
      toast(push ? 'Odesláno, notifikace jsou na cestě' : 'Odesláno')
    } catch (e: any) { toast(e.message || 'Nepodařilo se odeslat') } finally { setBusy(false) }
  }

  if (!user) return null

  return (
    <div className="a-feed">
      {canPost ? (
        <div className="a-comp an">
          {!composerOpen ? (
            <button className="a-comp-collapsed" onClick={() => setComposerOpen(true)}>
              <span className="a-ava dark">{initials(user.name)}</span>
              <span className="ph">Co se děje v domě?</span>
              <span className="s-btn s-primary sm">Napsat</span>
            </button>
          ) : (
            <>
              <div className="a-comp-hd">
                <span className="a-ava dark">{initials(user.name)}</span>
                <b>Nové oznámení</b>
                <button className="a-comp-x" onClick={() => setComposerOpen(false)} aria-label="Zavřít">×</button>
              </div>
              <div className="a-f">
                <label htmlFor="a-t">Nadpis (nepovinné)</label>
                <input id="a-t" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Čištění garáží v pondělí 21. 7." />
              </div>
              <div className="a-f">
                <label htmlFor="a-b">Text</label>
                <textarea id="a-b" rows={3} value={body} onChange={(e) => setBody(e.target.value)}
                  placeholder="Prosíme o přeparkování vozidel z garáží do 8:00…" autoFocus />
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
                <button className="s-btn s-ghost sm" onClick={() => fileRef.current?.click()}>Přidat fotku</button>
                <button className="s-btn s-primary" style={{ marginLeft: 'auto' }} onClick={send} disabled={busy}>
                  {busy ? 'Odesílám…' : targetCount ? `Odeslat ${targetCount} ${targetCount === 1 ? 'bytu' : 'bytům'}` : 'Odeslat'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="a-comp an a-comp-info">
          <b>Oznámení domu</b>
          <p>Tady je všechno, co výbor pošle do domu. Nová oznámení vám přijdou jako notifikace do telefonu,
            takže vám nic neuteče ani bez chození k nástěnce.</p>
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
          const statsOpen = openStats === p.id
          const commentsOpen = openComments === p.id
          const official = OFFICIAL.includes((p.role || '') as Role)
          return (
            <div className="a-item an" ref={(el) => { itemRefs.current[p.id] = el }} key={p.id}
              style={{ ['--d' as string]: `${Math.min(i, 6) * 0.04}s` }}>
              <span className={'a-ava' + (official ? ' dark' : '')}>{initials(p.authorName)}</span>
              <div className="a-body-col">
                <div className="a-h">
                  <b className="a-author">{p.authorName}</b>
                  {official && <span className="a-official">výbor</span>}
                  <span className="a-dot">·</span>
                  <span className="a-time">{when(p.createdAt)}</span>
                  <span className="a-aud">{audienceLabel(p.audience || 'all')}</span>
                </div>
                {p.title && <div className="a-title">{p.title}</div>}
                {p.body && <div className="a-text">{p.body}</div>}
                {p.imageUrl && <div className="a-thumb"><img src={p.imageUrl} alt="" /></div>}

                <div className="a-actrow">
                  <button className={'a-act' + (p.liked ? ' liked' : '')} onClick={() => toggleLike(p)}>
                    <SIcon n="heart" s={15} filled={p.liked} /><span>{p.likes || ''}</span>
                  </button>
                  <button className="a-act" onClick={() => toggleCommentsFor(p)}>
                    <SIcon n="chat" s={15} /><span>{p.commentCount || ''}</span>
                  </button>
                  {canPost && (
                    <button className="a-act" onClick={() => toggleStats(p)} title="Čtenost po bytech">
                      <SIcon n="people" s={15} /><span>{reads}/{units || '—'}</span>
                    </button>
                  )}
                </div>

                {canPost && statsOpen && (
                  <div className="a-units">
                    {!units ? null : (
                      <div className="bar" style={{ margin: '2px 0 8px' }}><i style={{ width: `${pct}%` }} /></div>
                    )}
                    {(rows[p.id] || []).length === 0 && <div className="a-unit" style={{ color: 'var(--s-muted)' }}>Načítám…</div>}
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

                {commentsOpen && (
                  <div className="a-comments">
                    {(comments[p.id] || []).length === 0 && <div className="a-note" style={{ padding: '6px 0' }}>Zatím žádné komentáře.</div>}
                    {(comments[p.id] || []).map((c) => (
                      <div className="a-comment" key={c.id}>
                        <span className="a-ava sm">{initials(c.authorName)}</span>
                        <div>
                          <div className="a-h" style={{ marginBottom: 1 }}>
                            <b className="a-author">{c.authorName}</b><span className="a-dot">·</span><span className="a-time">{when(c.createdAt)}</span>
                          </div>
                          <div className="a-ctext">{c.body}</div>
                        </div>
                      </div>
                    ))}
                    <div className="a-cnew">
                      <span className="a-ava sm dark">{initials(user.name)}</span>
                      <input placeholder="Napsat komentář…" value={draftComment[p.id] || ''}
                        onChange={(e) => setDraftComment((s) => ({ ...s, [p.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') submitComment(p) }} />
                      <button className="s-btn s-ghost sm" onClick={() => submitComment(p)} disabled={!(draftComment[p.id] || '').trim()}>Odeslat</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {canPost && posts.length > 0 && (
          <div className="a-note" style={{ margin: '4px 0 0' }}>
            U každého oznámení vidíte doručení i přečtení po bytech — víte, koho obejít osobně.
            Nepřipojeným bytům se tiskne dopis do schránky.
          </div>
        )}
      </div>
    </div>
  )
}
