import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { useSession } from '../../state/session'
import type { Role } from '../../lib/types'
import { useToast } from '../../components/Toast'
import { SIcon } from '../../components/AppShell'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { backendAvailable, exitDemo } from '../../lib/supabase'
import { prefs, setPref, reminderRules, notifyConfigured, type Channel } from '../../lib/notify'

// Nastavení (handoff 6f): profil, kanály notifikací a zabezpečení. Kanály
// řídí, čím vás aplikace osloví — a ukazují automatický plán připomínek.
export default function SettingsPage() {
  const { t } = useTranslation(['settings', 'common'])
  const { user, isDemo, setRole, signOut } = useSession()
  const toast = useToast()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [share, setShare] = useState(false)
  const [chan, setChan] = useState<Record<Channel, boolean>>({ ...prefs })
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)

  const CH: { k: Channel; l: string; d: string }[] = [
    { k: 'push', l: t('settings:notifications.pushName'), d: t('settings:notifications.pushDesc') },
    { k: 'email', l: t('settings:notifications.emailName'), d: t('settings:notifications.emailDesc') },
    { k: 'sms', l: t('settings:notifications.smsName'), d: t('settings:notifications.smsDesc') },
  ]
  const roleLabel = (r: Role) => t(`common:roles.${r}`)

  useEffect(() => {
    api.getMyProfile().then((p) => { setEmail(p.email); setPhone(p.phone); setShare(p.shareContact) }).catch(() => {})
  }, [])

  if (!user) return null
  async function logout() { await signOut(); nav('/') }

  async function saveContact() {
    if (busy) return
    setBusy(true)
    try { await api.saveMyProfile({ phone: phone.trim(), shareContact: share }); toast(t('settings:toastContactSaved')) }
    catch (e: any) { toast(e.message || t('settings:toastSaveFailed')) } finally { setBusy(false) }
  }
  function toggleChan(k: Channel) {
    const next = !chan[k]
    setChan((c) => ({ ...c, [k]: next })); setPref(k, next)
    const label = CH.find((c) => c.k === k)!.l
    toast(next ? t('settings:toastChannelOn', { channel: label }) : t('settings:toastChannelOff', { channel: label }))
  }
  async function changePw() {
    if (busy) return
    if (pw.length < 8) { toast(t('settings:toastPasswordTooShort')); return }
    if (pw !== pw2) { toast(t('settings:toastPasswordMismatch')); return }
    setBusy(true)
    try { await api.changePassword(pw); setPw(''); setPw2(''); toast(t('settings:toastPasswordChanged')) }
    catch (e: any) { toast(e.message || t('settings:toastPasswordChangeFailed')) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="d-hi">
        <div>
          <h2>{t('settings:title')}</h2>
          <p>{t('settings:subtitle')}</p>
        </div>
      </div>

      <div className="st-grid">
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="st-card an">
            <b>{t('settings:profile.title')}</b>
            <div className="st-prof">
              <span className="ava">{user.initials}</span>
              <div>
                <b>{user.name}</b>
                <span>{user.buildingName}{user.unit ? `, ${user.unit}` : ''}</span>
              </div>
            </div>
            <div className="st-meta">
              <div><span className="l">{t('settings:profile.role')}</span><span className="v">{roleLabel(user.role)}</span></div>
              {email && <div><span className="l">{t('settings:profile.email')}</span><span className="v">{email}</span></div>}
            </div>

            <div className="a-f" style={{ marginTop: 14 }}>
              <label htmlFor="st-ph">{t('settings:profile.phoneLabel')}</label>
              <input id="st-ph" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+420 …" />
            </div>
            <div className="st-chan" style={{ borderTop: 'none', paddingTop: 0 }}>
              <div style={{ flex: 1 }}>
                <b>{t('settings:profile.shareTitle')}</b>
                <span>{t('settings:profile.shareBody')}</span>
              </div>
              <button className={'a-tog' + (share ? ' on' : '')} onClick={() => setShare(!share)} aria-pressed={share} aria-label={t('settings:profile.shareTitle')} />
            </div>
            <button className="s-btn s-primary sm" onClick={saveContact} disabled={busy}>{t('settings:profile.save')}</button>
          </div>

          <div className="st-card an" style={{ ['--d' as string]: '.04s' }}>
            <b>{t('settings:language.title')}</b>
            <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: '6px 0 12px', lineHeight: 1.5 }}>
              {t('settings:language.body')}
            </p>
            <LanguageSwitcher variant="select" />
          </div>

          {!isDemo && (
            <div className="st-card an" style={{ ['--d' as string]: '.07s' }}>
              <b>{t('settings:security.title')}</b>
              <div className="a-f" style={{ marginTop: 12 }}>
                <label htmlFor="st-p1">{t('settings:security.newPassword')}</label>
                <input id="st-p1" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="a-f">
                <label htmlFor="st-p2">{t('settings:security.newPasswordAgain')}</label>
                <input id="st-p2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
              </div>
              <button className="s-btn s-ghost sm" onClick={changePw} disabled={busy}>{t('settings:security.change')}</button>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="st-card an" style={{ ['--d' as string]: '.05s' }}>
            <b>{t('settings:notifications.title')}</b>
            <p style={{ fontSize: 12, color: 'var(--s-muted)', margin: '6px 0 4px', lineHeight: 1.5 }}>
              {t('settings:notifications.body')}
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
                {t('settings:notifications.demoNote')}
              </p>
            )}
          </div>

          <div className="st-card an" style={{ ['--d' as string]: '.12s' }}>
            <b>{t('settings:reminders.title')}</b>
            <p style={{ fontSize: 12, color: 'var(--s-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
              {t('settings:reminders.body')}
            </p>
            <div className="st-rules">
              {reminderRules.map((r) => (
                <div className="st-rule" key={r.id}>
                  <span className="o">{r.offset === 0 ? 'D' : r.offset > 0 ? `D+${r.offset}` : `D${r.offset}`}</span>
                  <span>{t(`settings:reminders.${r.id}`)}</span>
                  <span className="ch">{r.channel}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="st-card an" style={{ ['--d' as string]: '.18s' }}>
            <b>{isDemo ? t('settings:account.viewAs') : t('settings:account.account')}</b>
            {isDemo && (
              <div className="a-f" style={{ marginTop: 12 }}>
                <label htmlFor="st-role">{t('settings:account.demoRole')}</label>
                <select id="st-role" value={user.role} onChange={(e) => setRole(e.target.value as Role)}>
                  {(['rezident', 'vybor', 'developer', 'investor'] as Role[]).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              </div>
            )}
            <button className="s-btn s-ghost sm" style={{ marginTop: 12 }} onClick={logout}>{t('settings:account.logout')}</button>
          </div>
        </div>
      </div>

      {isDemo && (
        <div className="st-demo an">
          <b>{t('settings:demo.title')}</b> {t('settings:demo.body')}
          {backendAvailable && <> <button className="d-link" onClick={exitDemo} style={{ color: '#4A3390' }}>{t('settings:demo.exitLink')}</button>.</>}
        </div>
      )}
    </>
  )
}
