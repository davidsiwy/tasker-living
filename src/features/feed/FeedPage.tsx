import { useEffect, useRef, useState } from 'react'
import { feed } from '../../lib/api'
import type { FeedPost, FeedComment, FeedType, Role } from '../../lib/types'
import { feedLabels, can } from '../../lib/types'
import { useSession } from '../../state/session'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'teď'
  if (s < 3600) return Math.floor(s / 60) + ' min'
  if (s < 86400) return Math.floor(s / 3600) + ' h'
  if (s < 604800) return Math.floor(s / 86400) + ' d'
  return new Date(iso).toLocaleDateString('cs-CZ')
}
const inits = (n: string) => n.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

export default function FeedPage() {
  const { user } = useSession()
  const toast = useToast()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [text, setText] = useState('')
  const [kind, setKind] = useState<FeedType>('kom')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [comments, setComments] = useState<Record<string, FeedComment[]>>({})
  const [reply, setReply] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const canAnnounce = user ? can(user.role as Role, 'post_announcement') : false
  const allowed: FeedType[] = canAnnounce ? ['kom', 'ozn', 'udal'] : ['kom', 'udal']

  async function load() { if (!user) return; try { setPosts(await feed.list(user.buildingId)) } catch (e) { console.error(e) } }
  useEffect(() => { load() }, [user?.buildingId])

  // live updates
  useEffect(() => {
    if (!user) return
    const unsub = feed.subscribe(user.buildingId, async () => {
      await load()
      for (const id of Object.keys(open)) if (open[id]) { const cs = await feed.getComments(id); setComments((c) => ({ ...c, [id]: cs })) }
    })
    return unsub
  }, [user?.buildingId])

  function pickFile(f?: File | null) { if (!f) return; setFile(f); setPreview(URL.createObjectURL(f)) }

  async function publish() {
    if (!user || (!text.trim() && !file) || busy) return
    setBusy(true)
    try {
      let imageUrl: string | undefined
      if (file) imageUrl = await feed.uploadImage(file, user.buildingId)
      await feed.createPost({ buildingId: user.buildingId, author: { name: user.name, handle: user.handle, role: user.role }, kind, body: text.trim(), imageUrl })
      setText(''); setFile(null); setPreview(''); setKind('kom')
      await load(); toast('Publikováno')
    } catch (e: any) { toast(e.message || 'Nepodařilo se publikovat') } finally { setBusy(false) }
  }

  async function like(p: FeedPost) {
    setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x)))
    try { await feed.toggleLike(p) } catch (e) { console.error(e); load() }
  }
  async function toggleThread(p: FeedPost) {
    const willOpen = !open[p.id]
    setOpen((o) => ({ ...o, [p.id]: willOpen }))
    if (willOpen && !comments[p.id]) { const cs = await feed.getComments(p.id); setComments((c) => ({ ...c, [p.id]: cs })) }
  }
  async function sendReply(p: FeedPost) {
    const body = (reply[p.id] || '').trim(); if (!body || !user) return
    const c = await feed.addComment(p.id, { name: user.name, handle: user.handle }, body)
    setComments((cm) => ({ ...cm, [p.id]: [...(cm[p.id] || []), c] }))
    setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, commentCount: x.commentCount + 1 } : x)))
    setReply((r) => ({ ...r, [p.id]: '' }))
  }

  return (
    <div>
      <div className="view-head"><div><h1>Nástěnka</h1><div className="desc">Živý kanál domu, oznámení, události a sousedé</div></div></div>

      <div className="tw-compose">
        <span className="tw-av">{user ? inits(user.name) : ''}</span>
        <div className="tw-compose-main">
          <textarea placeholder="Co je nového v domě?" value={text} onChange={(e) => setText(e.target.value)} />
          {preview && <div className="tw-img-preview"><img src={preview} alt="" /><button onClick={() => { setFile(null); setPreview('') }}><Icon name="x" small /></button></div>}
          <div className="tw-compose-foot">
            <div className="tw-compose-tools">
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pickFile(e.target.files?.[0])} />
              <button className="btn btn-ghost btn-icon" onClick={() => fileRef.current?.click()} title="Přidat fotku"><Icon name="doc" small /></button>
              {canAnnounce && <div className="seg">{allowed.map((t) => <button key={t} className={kind === t ? 'on' : ''} onClick={() => setKind(t)}>{feedLabels[t]}</button>)}</div>}
            </div>
            <button className="btn btn-primary btn-sm" onClick={publish} disabled={busy}><Icon name="send" small /> Publikovat</button>
          </div>
        </div>
      </div>

      {posts.map((p) => (
        <article className="tw" key={p.id}>
          <span className="tw-av">{inits(p.authorName)}</span>
          <div className="tw-main">
            <div className="tw-head">
              <b>{p.authorName}</b>
              <span className="tw-handle">@{p.handle}</span>
              <span className="tw-dot">·</span>
              <span className="tw-time">{timeAgo(p.createdAt)}</span>
              {p.kind === 'ozn' && <span className="tw-badge">Oznámení</span>}
              {p.kind === 'udal' && <span className="tw-badge alt">Událost</span>}
              {p.kind === 'zav' && <span className="tw-badge warn">Závada</span>}
            </div>
            {p.body && <div className="tw-body">{p.body}</div>}
            {p.imageUrl && <img className="tw-img" src={p.imageUrl} alt="" />}
            <div className="tw-actions">
              <button className="tw-act" onClick={() => toggleThread(p)}><Icon name="msg" small /> {p.commentCount}</button>
              <button className={'tw-act' + (p.liked ? ' liked' : '')} onClick={() => like(p)}><Icon name="heart" small /> {p.likes}</button>
            </div>
            {open[p.id] && (
              <div className="tw-thread">
                {(comments[p.id] || []).map((c) => (
                  <div className="tw-comment" key={c.id}>
                    <span className="tw-av sm">{inits(c.authorName)}</span>
                    <div><div className="c-meta"><b style={{ fontSize: 13.5 }}>{c.authorName}</b><span className="tw-handle">@{c.handle}</span><span className="tw-time">{timeAgo(c.createdAt)}</span></div><div className="c-body">{c.body}</div></div>
                  </div>
                ))}
                <div className="tw-reply">
                  <span className="tw-av sm">{user ? inits(user.name) : ''}</span>
                  <input placeholder="Napsat odpověď..." value={reply[p.id] || ''} onChange={(e) => setReply((r) => ({ ...r, [p.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') sendReply(p) }} />
                  <button className="btn btn-ghost btn-icon" onClick={() => sendReply(p)}><Icon name="send" small /></button>
                </div>
              </div>
            )}
          </div>
        </article>
      ))}
      {posts.length === 0 && <div className="empty"><span className="cf-ic"><Icon name="nastenka" /></span><p>Zatím žádné příspěvky. Napište první.</p></div>}
    </div>
  )
}
