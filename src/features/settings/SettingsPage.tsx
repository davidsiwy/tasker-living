import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useSession } from '../../state/session'
import { roleNames } from '../../lib/types'
import type { Role } from '../../lib/types'
import { useToast } from '../../components/Toast'
import { SIcon } from '../../components/AppShell'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { backendAvailable, exitDemo } from '../../lib/supabase'
import { prefs, setPref, reminderRules, notifyConfigured, type Channel } from '../../lib/notify'

const CH: { k: Channel; l: string; d: string }[] = [
  { k: 'push', l: 'Push do telefonu', d: 'oznámení, upomínky, průběh závad' },
  { k: 'email', l: 'E-mail', d: 'předpisy, zápisy, důležité události' },
  { k: 'sms', l: 'SMS', d: 'jen upomínky po splatnosti' },
]

// Nastavení (handoff 6f): profil, kanály notifikací a zabezpečení. Kanály
// řídí, čím vás aplikace osloví — a ukazují automatický plán připomínek.
export default function SettingsPage() {
  const { user, isDemo, setRole, signOut } = useSession()
  const toast = useToast()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [share, setShare] = useState(false)
  const [chan, setChan] = useState<Record<Channel, boolean>>({ ...prefs })
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.getMyProfile().then((p) => { setEmail(p.email); setPhone(p.phone); setShare(p.shareContact) }).catch(() => {})
  }, [])

  if (!user) return null
  async function logout() { await signOut(); nav('/') }

  async function saveContact() {
    if (busy) return
    setBusy(true)
    try { await api.saveMyProfile({ phone: phone.trim(), shareContact: share }); toast('Kontakt uložen') }
    catch (e: any) { toast(e.message || 'Uložení selhalo') } finally { setBusy(false) }
  }
  function toggleChan(k: Channel) {
    const next = !chan[k]
    setChan((c) => ({ ...c, [k]: next })); setPref(k, next)
    toast(next ? `${CH.find((c) => c.k === k)!.l} zapnuto` : `${CH.find((c) => c.k === k)!.l} vypnuto`)
  }
  async function changePw() {
    if (busy) return
    if (pw.length < 8) { toast('Heslo musí mít alespoň 8 znaků'); return }
    if (pw !== pw2) { toast('Hesla se neshodují'); return }
    setBusy(true)
    try { await api.changePassword(pw); setPw(''); setPw2(''); toast('Heslo změněno') }
    catch (e: any) { toast(e.message || 'Změna hesla selhala') } finally { setBusy(false) }
  }

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>Nastavení</h2>
          <p>Profil, čím vás aplikace osloví, a zabezpečení účtu.</p>
        </div>
      </div>

      <div className="st-grid">
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="st-card an">
            <b>Profil</b>
            <div className="st-prof">
              <span className="ava">{user.initials}</span>
              <div>
                <b>{user.name}</b>
                <span>{user.buildingName}{user.unit ? `, ${user.unit}` : ''}</span>
              </div>
            </div>
            <div className="st-meta">
              <div><span className="l">Role</span><span className="v">{roleNames[user.role]}</span></div>
              {email && <div><span className="l">E-mail</span><span className="v">{email}</span></div>}
            </div>

            <div className="a-f" style={{ marginTop: 14 }}>
              <label htmlFor="st-ph">Telefon pro sousedy</label>
              <input id="st-ph" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+420 …" />
            </div>
            <div className="st-chan" style={{ borderTop: 'none', paddingTop: 0 }}>
              <div style={{ flex: 1 }}>
                <b>Sdílet telefon v adresáři</b>
                <span>sousedé uvidí vaše číslo v sekci Sousedé</span>
              </div>
              <button className={'a-tog' + (share ? ' on' : '')} onClick={() => setShare(!share)} aria-pressed={share} aria-label="Sdílení kontaktu" />
            </div>
            <button className="s-btn s-primary sm" onClick={saveContact} disabled={busy}>Uložit</button>
          </div>

          <div className="st-card an" style={{ ['--d' as string]: '.04s' }}>
            <b>Jazyk aplikace</b>
            <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: '6px 0 12px', lineHeight: 1.5 }}>
              Jazyk je nastavený jen pro váš účet. Výbor může mít aplikaci česky, vy klidně anglicky nebo německy — nad stejnými daty domu.
            </p>
            <LanguageSwitcher variant="select" />
          </div>

          {!isDemo && (
            <div className="st-card an" style={{ ['--d' as string]: '.07s' }}>
              <b>Zabezpečení</b>
              <div className="a-f" style={{ marginTop: 12 }}>
                <label htmlFor="st-p1">Nové heslo</label>
                <input id="st-p1" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="a-f">
                <label htmlFor="st-p2">Nové heslo znovu</label>
                <input id="st-p2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
              </div>
              <button className="s-btn s-ghost sm" onClick={changePw} disabled={busy}>Změnit heslo</button>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="st-card an" style={{ ['--d' as string]: '.05s' }}>
            <b>Notifikace</b>
            <p style={{ fontSize: 12, color: 'var(--s-muted)', margin: '6px 0 4px', lineHeight: 1.5 }}>
              Vyberte, čím vás aplikace osloví. Push doporučujeme nechat zapnutý — díky němu vám neuteče oznámení domu.
            </p>
            {CH.map((c) => (
              <div className="st-chan" key={c.k}>
                <span className="ic"><SIcon n={c.k === 'push' ? 'bell' : c.k === 'email' ? 'doc' : 'card'} s={15} /></span>
                <div>
                  <b>{c.l}</b>
                  <span>{c.d}</span>
                </div>
                <button className={'a-tog' + (chan[c.k] ? ' on' : '')} onClick={() => toggleChan(c.k)} aria-pressed={chan[c.k]} aria-label={c.l} />
              </div>
            ))}
            {!notifyConfigured && (
              <p className="a-note" style={{ marginTop: 10 }}>
                V ukázce se zprávy sbírají do interní schránky, aby byl vidět plán připomínek. V ostrém provozu chodí e-mailem, SMS a push.
              </p>
            )}
          </div>

          <div className="st-card an" style={{ ['--d' as string]: '.12s' }}>
            <b>Automatické připomínky plateb</b>
            <p style={{ fontSize: 12, color: 'var(--s-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
              Aplikace je posílá za výbor sama — nikdo nemusí hlídat splatnosti.
            </p>
            <div className="st-rules">
              {reminderRules.map((r) => (
                <div className="st-rule" key={r.id}>
                  <span className="o">{r.offset === 0 ? 'D' : r.offset > 0 ? `D+${r.offset}` : `D${r.offset}`}</span>
                  <span>{r.label}</span>
                  <span className="ch">{r.channel}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="st-card an" style={{ ['--d' as string]: '.18s' }}>
            <b>{isDemo ? 'Zobrazit aplikaci jako' : 'Účet'}</b>
            {isDemo && (
              <div className="a-f" style={{ marginTop: 12 }}>
                <label htmlFor="st-role">Role v ukázce</label>
                <select id="st-role" value={user.role} onChange={(e) => setRole(e.target.value as Role)}>
                  {(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
                </select>
              </div>
            )}
            <button className="s-btn s-ghost sm" style={{ marginTop: 12 }} onClick={logout}>Odhlásit se</button>
          </div>
        </div>
      </div>

      {isDemo && (
        <div className="st-demo an">
          <b>Ukázkový režim.</b> Prohlížíte veřejnou ukázku na smyšlených datech, nic se neukládá.
          {backendAvailable && <> <button className="d-link" onClick={exitDemo} style={{ color: '#4A3390' }}>Ukončit demo a přihlásit se</button>.</>}
        </div>
      )}
    </>
  )
}
