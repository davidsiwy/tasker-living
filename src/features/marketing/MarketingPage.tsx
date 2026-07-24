import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { enterDemo } from '../../lib/supabase'
import { api } from '../../lib/api'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import mark from '../../assets/mark.png'
import logo from '../../assets/tasker-living-logo.png'
import './landing.css'

const CONTACT_EMAIL = 'info@tasker.cz'
const SIZE_KEYS = ['s1', 's2', 's3', 's4'] as const
const SIZE_CZ: Record<string, string> = { s1: 'do 20 jednotek', s2: '20 až 50 jednotek', s3: '50 a více jednotek', s4: 'více domů / portfolio' }

// Rezervace uvodniho hovoru. Sloty jsou po pul hodine 9:00-16:30; hodnota se
// drzi vzdy v kanonickem 24h tvaru ('14:30') a preklada se az pri zobrazeni —
// aby prepnuti jazyka uprostred vyberu neponechalo stary text.
const SLOT_TIMES = (() => { const o: string[] = []; for (let h = 9; h <= 16; h++) { o.push(h + ':00'); o.push(h + ':30') } return o })()
const BUSINESS_DAYS = 5
function nextBusinessDays(n: number): Date[] {
  const out: Date[] = []
  const cursor = new Date(); cursor.setHours(0, 0, 0, 0)
  if (new Date().getHours() >= 15) cursor.setDate(cursor.getDate() + 1) // dnešek po 15:00 už nenabízíme
  while (out.length < n) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) out.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmtSlot = (hhmm: string, lng: string) => {
  if (lng !== 'en') return hhmm
  const [h, m] = hhmm.split(':').map(Number)
  const am = h < 12; const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')}${am ? 'am' : 'pm'}`
}
const fmtDayLong = (d: Date, lng: string) => new Intl.DateTimeFormat(lng, { weekday: 'long', day: 'numeric', month: 'numeric' }).format(d)
const fmtDayAbbr = (d: Date, lng: string) => new Intl.DateTimeFormat(lng, { weekday: 'short' }).format(d).replace('.', '').toUpperCase()
const fmtMonChip = (d: Date, lng: string) =>
  lng === 'en' ? new Intl.DateTimeFormat('en', { month: 'short' }).format(d) : `${d.getMonth() + 1}.`

function calendarLinks(d: Date, hhmm: string, title: string, desc: string, loc: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const s = new Date(d); s.setHours(h, m, 0, 0)
  const e = new Date(s.getTime() + 15 * 60000)
  const p = (n: number) => String(n).padStart(2, '0')
  const f = (x: Date) => `${x.getFullYear()}${p(x.getMonth() + 1)}${p(x.getDate())}T${p(x.getHours())}${p(x.getMinutes())}00`
  const g = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${f(s)}/${f(e)}&details=${encodeURIComponent(desc)}&location=${encodeURIComponent(loc)}`
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tasker Living//CS', 'BEGIN:VEVENT',
    `UID:${f(s)}-tasker@tasker.cz`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(s)}`, `DTEND:${f(e)}`,
    `SUMMARY:${title}`, `DESCRIPTION:${desc}`, `LOCATION:${loc}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  return { g, ics: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics) }
}

// The offer. One place to tune the promise the ads and the page make.
const OFFER = { freeMonths: 2, launchHours: 48, pricePerUnit: 399 }

/* ---------- small building blocks ---------- */

// tick used in every benefit list (handoff: feather stroke, 2.6 on small ticks)
function Chk({ w = 15 }: { w?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: w, height: w, flex: 'none', marginTop: 2 }}
      fill="none" stroke="#12901E" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}
function ChkLight({ w = 16 }: { w?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: w, height: w, flex: 'none', marginTop: 2 }}
      fill="none" stroke="#7CE87F" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}
function Plus() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 13, height: 13 }} fill="none" stroke="currentColor"
      strokeWidth={2.4} strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
  )
}
function Glyph({ d, size = 16, stroke = 'currentColor' }: { d: string; size?: number; stroke?: string }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size, flex: 'none' }} fill="none" stroke={stroke}
      strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: d }} />
  )
}

const G = {
  shield: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 9.5V21h14V9.5"/>',
  spark: '<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9z"/><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 15l-6 6-3.7-3.7a4 4 0 0 0-5-5L3 9l6-6z"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  download: '<path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  lift: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M12 7l-2 2h4zM12 17l-2-2h4z"/>',
}

/* ---------- copy: single source of truth for the tour blocks ---------- */

type Tour = { today: string; h: string; p: string; ticks: string[]; mock: JSX.Element; flip?: boolean }

export default function MarketingPage() {
  const { t, i18n } = useTranslation('marketing')
  const freeMonthsLabel = t('common:units.months', { count: OFFER.freeMonths })
  const launchLabel = t('common:units.hours', { count: OFFER.launchHours })
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  const [cName, setCName] = useState(''); const [cEmail, setCEmail] = useState(''); const [cPhone, setCPhone] = useState('')
  const [cSize, setCSize] = useState('s1'); const [cMsg, setCMsg] = useState('')
  const [cState, setCState] = useState<'idle' | 'busy' | 'done' | 'err'>('idle')
  const [bStep, setBStep] = useState<'date' | 'time' | 'contact' | 'done'>('date')
  const [dayIdx, setDayIdx] = useState<number | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [fErr, setFErr] = useState<Record<string, string>>({})
  const [formErr, setFormErr] = useState('')
  const [taken, setTaken] = useState<Set<string>>(new Set())
  const slotDays = useMemo(() => nextBusinessDays(BUSINESS_DAYS), [])

  // Skutecne obsazene terminy z databaze — zadna vymyslena data.
  useEffect(() => {
    if (!slotDays.length) return
    api.getTakenSlots(isoDate(slotDays[0]), isoDate(slotDays[slotDays.length - 1]))
      .then((rows) => setTaken(new Set(rows.map((r) => r.date + ' ' + r.time))))
      .catch(() => setTaken(new Set()))
  }, [slotDays])

  const isTaken = (d: Date, hhmm: string) => taken.has(isoDate(d) + ' ' + hhmm)
  const freeCount = (d: Date) => SLOT_TIMES.filter((s) => !isTaken(d, s)).length
  const [scrolled, setScrolled] = useState(false)
  const [sticky, setSticky] = useState(false)

  // one passive listener drives the nav shadow and the mobile CTA bar
  useEffect(() => {
    const onScroll = () => { setScrolled(window.scrollY > 8); setSticky(window.scrollY > 520) }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // scroll reveal per handoff: fadeUp / growX, fire once, content stays if JS fails
  useEffect(() => {
    const root = document.querySelector('.lp2')
    if (!root) return
    root.classList.add('anim')
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    root.querySelectorAll('.an,.grow').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  async function sendContact() {
    if (cState === 'busy' || dayIdx === null || !slot) return
    const e: Record<string, string> = {}
    if (cName.trim().length < 2) e.name = t('book.eName')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cEmail.trim())) e.email = t('book.eEmail')
    if (cPhone.replace(/\D/g, '').length < 9) e.phone = t('book.ePhone')
    setFErr(e)
    if (Object.keys(e).length) return

    setCState('busy'); setFormErr('')
    const day = slotDays[dayIdx]
    const czSlot = `${fmtDayLong(day, 'cs')} v ${slot}`
    try {
      // 1) skutecna rezervace terminu (unique index zabrani dvojitemu bookingu)
      await api.bookMeeting({
        date: isoDate(day), time: slot, name: cName.trim(), email: cEmail.trim(),
        phone: cPhone.trim(), size: SIZE_CZ[cSize] || cSize, note: cMsg.trim(), lang: i18n.language.slice(0, 2),
      })
    } catch (err: any) {
      // 23505 = unique violation → slot mezitim nekdo zabral
      const dup = String(err?.code) === '23505' || /duplicate|unique/i.test(String(err?.message || ''))
      setCState('idle')
      setFormErr(dup ? t('book.takenErr') : t('book.failErr', { email: CONTACT_EMAIL }))
      if (dup) { setTaken((s) => new Set(s).add(isoDate(day) + ' ' + slot)); setSlot(null); setBStep('time') }
      return
    }
    // 2) notifikace e-mailem (rezervace uz je ulozena, tak selhani mailu neblokuje)
    try {
      await fetch('https://formsubmit.co/ajax/' + CONTACT_EMAIL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `Tasker Living: rezervace hovoru – ${czSlot}`,
          Jmeno: cName.trim(), Email: cEmail.trim(), Telefon: cPhone.trim(),
          'Rezervovaný termín': czSlot,
          Velikost: SIZE_CZ[cSize] || cSize, Zprava: cMsg.trim(),
        }),
      })
    } catch { /* rezervace v DB je zapsana, e-mail je jen notifikace navic */ }
    setCState('done'); setBStep('done')
  }

  function resetBooking() {
    setBStep('date'); setDayIdx(null); setSlot(null); setFErr({}); setFormErr('')
    setCName(''); setCEmail(''); setCPhone(''); setCMsg(''); setCState('idle')
  }

  /* ----- 01 tour: four manual processes, each with the real UI next to it ----- */
  const tours: Tour[] = [
    {
      today: t('tours.t1.today'),
      h: t('tours.t1.h'),
      p: t('tours.t1.p'),
      ticks: [t('tours.t1.tick1'), t('tours.t1.tick2')],
      mock: (
        <div className="l-mock an">
          <div style={{ background: '#12161D', color: '#fff', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, color: '#aeb5c0', fontWeight: 600 }}>
              <img src={mark} alt="" style={{ width: 14, height: 14, borderRadius: 4 }} />
              TASKER LIVING · {t('common:time.now')}
            </div>
            <b style={{ fontSize: 14, fontWeight: 700, display: 'block', marginTop: 5 }}>{t('showcase.notifTitle')} 8:00–12:00</b>
            <span style={{ fontSize: 12, color: '#aeb5c0' }}>{t('showcase.notifSub')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#48515C', flex: 'none' }}>{t('tours.t1.mockRead')}</span>
            <div className="l-bar"><i className="grow" style={{ width: '95%' }} /></div>
            <b className="l-mono" style={{ fontSize: 12.5, fontWeight: 600, color: '#12901E', flex: 'none' }}>{t('tours.t1.mockCount')}</b>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12, color: '#8b93a0' }}>
            <span className="l-mono" style={{ fontWeight: 600, background: '#EEF2F7', borderRadius: 999, padding: '3px 10px', fontSize: 10.5, color: '#48515C' }}>{t('tours.t1.mockChip')}</span>
            <span>{t('tours.t1.mockFoot')}</span>
          </div>
        </div>
      ),
    },
    {
      today: t('tours.t2.today'),
      h: t('tours.t2.h'),
      p: t('tours.t2.p'),
      ticks: [t('tours.t2.tick1'), t('tours.t2.tick2')],
      flip: true,
      mock: (
        <div className="l-mock an">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <b style={{ fontSize: 14, fontWeight: 800 }}>{t('tours.t2.mockTitle')}</b>
            <span className="l-state l-ok" style={{ width: 'auto' }}>{t('tours.t2.mockOk')}</span>
          </div>
          <div className="l-rows">
            <div className="l-row"><b>B-204</b><span className="l-what">24 500 Kč</span><span className="l-state l-ok" style={{ width: 'auto' }}>{t('tours.t2.mockPaid')}</span></div>
            <div className="l-row due"><b>B-112</b><span className="l-what">8 900 Kč</span><span className="l-state l-warn" style={{ width: 'auto' }}>{t('tours.t2.mockDue')}</span></div>
            <div className="l-row due"><b>C-018</b><span className="l-what">8 900 Kč</span><span className="l-state l-warn" style={{ width: 'auto' }}>{t('tours.t2.mockDue')}</span></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <span className="l-btn l-dark l-sm" style={{ fontSize: 12.5, padding: '9px 14px', borderRadius: 10 }}>{t('tours.t2.mockBtn')}</span>
            <span style={{ fontSize: 12, color: '#8b93a0' }}>{t('tours.t2.mockNote')}</span>
          </div>
        </div>
      ),
    },
    {
      today: t('tours.t3.today'),
      h: t('tours.t3.h'),
      p: t('tours.t3.p'),
      ticks: [t('tours.t3.tick1'), t('tours.t3.tick2')],
      mock: (
        <div className="l-mock an">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <b style={{ fontSize: 14, fontWeight: 800 }}>{t('tours.t3.mockTitle')}</b>
            <span className="l-state l-ok" style={{ width: 'auto', flex: 'none' }}>{t('tours.t3.mockOk')}</span>
          </div>
          <div className="l-dual">
            <div className="grow" style={{ width: '62%', background: '#06C40A' }} />
            <div className="grow" style={{ width: '11%', background: '#B26A00', ['--d' as string]: '.5s' }} />
          </div>
          <div className="l-legend">
            <span><i style={{ background: '#06C40A' }} /><b style={{ fontWeight: 700 }}>62 %</b> {t('tours.t3.mockFor')}</span>
            <span><i style={{ background: '#B26A00' }} />11 % {t('tours.t3.mockAgainst')}</span>
            <span><i style={{ background: '#D7DDE7' }} />27 % {t('tours.t3.mockUndecided')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 16, paddingTop: 14, borderTop: '1px solid #E5E9F0' }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: '#EEF2F7', color: '#12901E', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <Glyph d={G.doc} size={15} />
            </span>
            <div style={{ flex: 1 }}>
              <b style={{ fontSize: 13, fontWeight: 700, display: 'block' }}>{t('tours.t3.mockDocTitle')}</b>
              <span style={{ fontSize: 11.5, color: '#8b93a0' }}>{t('tours.t3.mockDocSub')}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#12901E' }}>{t('tours.t3.mockDocBtn')}</span>
          </div>
        </div>
      ),
    },
    {
      today: t('tours.t4.today'),
      h: t('tours.t4.h'),
      p: t('tours.t4.p'),
      ticks: [t('tours.t4.tick1'), t('tours.t4.tick2')],
      flip: true,
      mock: (
        <div className="l-mock an">
          <div style={{ display: 'flex', gap: 14 }}>
            <div className="l-photo" style={{ width: 110, height: 110, flex: 'none' }}><span>{t('tours.t4.mockPhoto')}</span></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ fontSize: 14, fontWeight: 800 }}>{t('tours.t4.mockTitle')}</b>
                <span className="l-mono" style={{ fontSize: 10, fontWeight: 600, color: '#48515C', background: '#EEF2F7', borderRadius: 999, padding: '3px 9px', flex: 'none' }}>{t('tours.t4.mockChip')}</span>
              </div>
              <span style={{ fontSize: 12, color: '#8b93a0' }}>{t('tours.t4.mockBy')}</span>
              <div style={{ display: 'grid', gap: 7, marginTop: 10, fontSize: 12.5 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#12901E', fontWeight: 600 }}><Chk w={13} />{t('tours.t4.mockStep1')}</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#12901E', fontWeight: 600 }}><Chk w={13} />{t('tours.t4.mockStep2')}</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#8b93a0', fontWeight: 600 }}>
                  <span style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid #D7DDE7', flex: 'none' }} />{t('tours.t4.mockStep3')}
                </span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #E5E9F0', fontSize: 12, color: '#8b93a0' }}>
            {t('tours.t4.mockFoot')}
          </div>
        </div>
      ),
    },
  ]

  const faqs = [
    { q: t('faq.q1'), a: t('faq.a1') },
    { q: t('faq.q2'), a: t('faq.a2', { launch: launchLabel }) },
    { q: t('faq.q3'), a: t('faq.a3') },
    { q: t('faq.q4'), a: t('faq.a4') },
    { q: t('faq.q5'), a: t('faq.a5') },
    { q: t('faq.q6'), a: t('faq.a6') },
  ]

  return (
    <div className="lp2">
      {/* nav: 4 anchors = 4 sections, one primary CTA */}
      <nav className={'l-nav' + (scrolled ? ' scrolled' : '')}>
        <div className="l-nav-in">
          <div className="l-brand">
            <img className="l-logo" src={logo} alt="Tasker Living" />
            <small>{t('shell:brand.tagline')}</small>
          </div>
          <div className="l-nav-links">
            <button onClick={() => go('prohlidka')}>{t('nav.prohlidka')}</button>
            <button onClick={() => go('prokoho')}>{t('nav.prokoho')}</button>
            <button onClick={() => go('cenik')}>{t('nav.cenik')}</button>
            <button onClick={() => go('faq')}>{t('nav.faq')}</button>
          </div>
          <div className="l-nav-right">
            <LanguageSwitcher variant="select" compact className="l-lang" />
            <button className="l-nav-demo" onClick={enterDemo}>{t('nav.demo')}</button>
            <button className="l-btn l-primary l-sm" onClick={() => go('kontakt')}>{t('nav.cta')}</button>
          </div>
        </div>
      </nav>

      {/* hero: the claim, and right under it the real product for both roles */}
      <header className="l-hero">
        <div className="l-eyebrow an"><i className="pulse" /> {t('hero.eyebrow')}</div>
        <h1 className="an" style={{ ['--d' as string]: '.05s' }}>
          {t('hero.titleA')} <em>{t('hero.titleEm')}</em>
        </h1>
        <p className="l-lead an" style={{ ['--d' as string]: '.1s' }}>
          {t('hero.lead')}
        </p>
        <div className="l-hero-cta an" style={{ ['--d' as string]: '.15s' }}>
          <button className="l-btn l-primary" onClick={() => go('kontakt')}>{t('hero.ctaPrimary')}</button>
          <button className="l-btn l-ghost" onClick={enterDemo}>{t('hero.ctaDemo')}</button>
        </div>
        <div className="l-risk an" style={{ ['--d' as string]: '.25s' }}>
          <span><Chk w={14} /> {t('hero.riskLaunch', { launch: launchLabel })}</span>
          <span><Chk w={14} /> {t('hero.riskFree', { months: freeMonthsLabel })}</span>
          <span><Chk w={14} /> {t('hero.riskCancel')}</span>
        </div>
      </header>

      {/* product showcase: committee on the web, neighbour on the phone */}
      <section className="l-show">
        <div className="l-show-in">
          <div className="l-browser an">
            <span className="l-tag">{t('showcase.browserTag')}</span>
            <div className="l-chrome">
              <span style={{ display: 'flex', gap: 5 }}><i /><i /><i /></span>
              <span className="l-url">living.tasker.cz/vista-park</span>
            </div>
            <div className="l-bhead">
              <div style={{ flex: 1 }}>
                <div className="l-kicker-xs">{t('showcase.kicker')}</div>
                <b>{t('showcase.buildingName')}</b>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 999, background: '#EFE9FC', color: '#6A4BC2' }}>{t('showcase.roleChip')}</span>
            </div>
            <div className="l-btabs">
              <span className="on">{t('showcase.tabs.prehled')}</span><span>{t('showcase.tabs.platby')}</span><span>{t('showcase.tabs.schuze')}</span><span>{t('showcase.tabs.zavady')}</span><span>{t('showcase.tabs.dokumenty')}</span>
            </div>
            <div className="l-bkpis">
              <div className="l-bkpi"><span>{t('showcase.kpi1')}</span><b className="g">92 %</b></div>
              <div className="l-bkpi"><span>{t('showcase.kpi2')}</span><b>2</b></div>
              <div className="l-bkpi"><span>{t('showcase.kpi3')}</span><b className="g">62 % pro</b></div>
            </div>
            <div style={{ padding: '16px 22px 20px' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#48515C', marginBottom: 8 }}>{t('showcase.paymentsLabel')}</div>
              <div className="l-rows">
                <div className="l-row"><b>B-201</b><span className="l-what">{t('showcase.row1')}</span><span className="l-amt">24 500 Kč</span><span className="l-state l-ok">{t('showcase.paidPlain')}</span></div>
                <div className="l-row"><b>B-204</b><span className="l-what">{t('showcase.row1')}</span><span className="l-amt">24 500 Kč</span><span className="l-state l-ok">{t('tours.t2.mockPaid')}</span></div>
                <div className="l-row due"><b>B-112</b><span className="l-what">{t('showcase.row2')}</span><span className="l-amt">8 900 Kč</span><span className="l-state l-warn">{t('tours.t2.mockDue')}</span></div>
                <div className="l-row"><b>C-018</b><span className="l-what">{t('showcase.row2')}</span><span className="l-amt">8 900 Kč</span><span className="l-state l-neutral">{t('showcase.waiting')}</span></div>
              </div>
            </div>
          </div>

          <div className="l-phone floaty">
            <div className="l-status"><span>9:41</span><span style={{ display: 'flex', gap: 3, alignItems: 'center' }}><i /><i className="r" /></span></div>
            <div className="l-pnotif notif">
              <div className="h"><img src={mark} alt="" />TASKER LIVING · {t('common:time.now')}</div>
              <b>{t('showcase.notifTitle')}</b>
              <span className="s">{t('showcase.notifSub')}</span>
            </div>
            <div className="l-pcard">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <b style={{ fontSize: 11, fontWeight: 800 }}>{t('showcase.rentCard')}</b>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#FDF1E2', color: '#B26A00' }}>{t('showcase.rentDue')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <div className="l-qr" />
                <div>
                  <b style={{ fontSize: 13, fontWeight: 800, display: 'block' }}>24 500 Kč</b>
                  <span style={{ fontSize: 9.5, color: '#8b93a0' }}>{t('showcase.rentNote')}</span>
                </div>
              </div>
              <div className="l-pbtn">{t('showcase.rentBtn')}</div>
            </div>
            <div className="l-pcard" style={{ marginBottom: 12, display: 'flex', gap: 9, alignItems: 'center' }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: '#E7F7E8', color: '#12901E', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Glyph d={G.lift} size={13} />
              </span>
              <div>
                <b style={{ fontSize: 10.5, fontWeight: 700, display: 'block' }}>{t('showcase.faultCard')}</b>
                <span style={{ fontSize: 9, color: '#8b93a0' }}>{t('showcase.faultNote')}</span>
              </div>
            </div>
            <span className="l-home" />
          </div>
          <span className="l-ptag">{t('showcase.phoneTag')}</span>
        </div>

        {/* stat strip */}
        <div className="l-strip an" style={{ ['--d' as string]: '.15s' }}>
          <div className="l-stats">
            <div><b>40</b>{t('showcase.stat1')}</div>
            <div><b>48 h</b>{t('showcase.stat2')}</div>
            <div><b>0 Kč</b>{t('showcase.stat3')}</div>
            <div><b>20 000+</b>{t('showcase.stat4')}</div>
          </div>
          <div className="l-chips">
            <span className="l-chip"><Glyph d={G.home} size={13} stroke="#12901E" />{t('showcase.chip1')}</span>
            <span className="l-chip"><Glyph d={G.shield} size={13} stroke="#12901E" />{t('showcase.chip2')}</span>
            <span className="l-chip"><Glyph d={G.doc} size={13} stroke="#12901E" />{t('showcase.chip3')}</span>
            <span className="l-chip"><Glyph d={G.spark} size={13} stroke="#12901E" />{t('showcase.chip4')}</span>
          </div>
        </div>
      </section>

      {/* 01 tour: pain -> solution -> real UI */}
      <section className="l-sec" id="prohlidka">
        <div className="l-num">{t('tours.sectionNum')}</div>
        <h2 className="an" style={{ maxWidth: '18em' }}>{t('tours.sectionTitle')}</h2>
        <p className="l-sub">
          {t('tours.sectionSub')}
        </p>

        {tours.map((tour) => (
          <div className="l-tour" key={tour.h}>
            {tour.flip && tour.mock}
            <div>
              <div className="l-today">{t('tours.today')}</div>
              <div className="l-quote">{tour.today}</div>
              <div className="l-with">{t('tours.with')}</div>
              <h3>{tour.h}</h3>
              <p>{tour.p}</p>
              <div className="l-ticks">
                {tour.ticks.map((x) => <span key={x}><Chk />{x}</span>)}
              </div>
            </div>
            {!tour.flip && tour.mock}
          </div>
        ))}

        <div className="l-side2">
          <div className="l-side an">
            <span className="l-sic"><Glyph d={G.doc} /></span>
            <div>
              <b>{t('sideNotes.docsTitle')}</b>
              <p>{t('sideNotes.docsBody')}</p>
            </div>
          </div>
          <div className="l-side an" style={{ ['--d' as string]: '.08s' }}>
            <span className="l-sic"><Glyph d={G.chat} /></span>
            <div>
              <b>{t('sideNotes.disputesTitle')}</b>
              <p>{t('sideNotes.disputesBody')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 02 moat: the only dark section on the page */}
      <section className="l-moat" id="moat">
        <div className="l-moat-in">
          <div>
            <div className="l-num">{t('moat.num')}</div>
            <h2 className="an">{t('moat.title')}</h2>
            <p className="l-sub">
              {t('moat.body')}
            </p>
            <div className="l-ticks">
              <span><ChkLight />{t('moat.tick1')}</span>
              <span><ChkLight />{t('moat.tick2')}</span>
              <span><ChkLight />{t('moat.tick3')}</span>
            </div>
            <div className="l-20k an" style={{ ['--d' as string]: '.15s' }}>
              <b className="n">{t('moat.statNum')}</b>
              <span><b>{t('moat.statLine1')}</b><br />{t('moat.statLine2')}</span>
            </div>
          </div>
          <div className="l-svc an">
            <div className="l-kicker-xs">{t('moat.svcKicker')}</div>
            <div className="l-pills">
              <span className="on">{t('moat.svcTab1')}</span><span>{t('moat.svcTab2')}</span><span>{t('moat.svcTab3')}</span>
            </div>
            <div className="l-worker">
              <span className="l-ava">MP</span>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 14.5, fontWeight: 800, display: 'block' }}>{t('moat.workerName')}</b>
                <span style={{ fontSize: 12, color: '#8b93a0' }}>{t('moat.workerMeta')}</span>
              </div>
              <span className="l-state l-ok" style={{ width: 'auto' }}>{t('moat.workerBadge')}</span>
            </div>
            <div className="l-slots">
              <span className="on">{t('moat.slotA')}</span><span>{t('moat.slotB')}</span><span>{t('moat.slotC')}</span>
            </div>
            <div className="l-btn l-primary" style={{ width: '100%', marginTop: 14, fontSize: 14, padding: 13 }}>{t('moat.slotBtn')}</div>
          </div>
        </div>
      </section>

      {/* 03 for whom: three roles, each with its own CTA */}
      <section className="l-sec" id="prokoho">
        <div className="l-num">{t('roles.num')}</div>
        <h2 className="an">{t('roles.title')}</h2>
        <div className="l-roles">
          <div className="l-role an">
            <div className="l-kicker-xs" style={{ fontSize: 10.5 }}>{t('roles.vybor.kicker')}</div>
            <h3>{t('roles.vybor.h')}</h3>
            <div className="l-ticks">
              <span><Chk />{t('roles.vybor.t1')}</span>
              <span><Chk />{t('roles.vybor.t2')}</span>
              <span><Chk />{t('roles.vybor.t3')}</span>
            </div>
            <button onClick={() => go('kontakt')}>{t('roles.vybor.cta')}</button>
          </div>
          <div className="l-role an" style={{ ['--d' as string]: '.08s' }}>
            <div className="l-kicker-xs" style={{ fontSize: 10.5 }}>{t('roles.rezident.kicker')}</div>
            <h3>{t('roles.rezident.h')}</h3>
            <div className="l-ticks">
              <span><Chk />{t('roles.rezident.t1')}</span>
              <span><Chk />{t('roles.rezident.t2')}</span>
              <span><Chk />{t('roles.rezident.t3')}</span>
            </div>
            <button onClick={enterDemo}>{t('roles.rezident.cta')}</button>
          </div>
          <div className="l-role an" style={{ ['--d' as string]: '.16s' }}>
            <div className="l-kicker-xs" style={{ fontSize: 10.5 }}>{t('roles.developer.kicker')}</div>
            <h3>{t('roles.developer.h')}</h3>
            <div className="l-ticks">
              <span><Chk />{t('roles.developer.t1')}</span>
              <span><Chk />{t('roles.developer.t2')}</span>
              <span><Chk />{t('roles.developer.t3')}</span>
            </div>
            <button onClick={() => go('kontakt')}>{t('roles.developer.cta')}</button>
          </div>
        </div>
      </section>

      {/* 04 launch: timeline + founder */}
      <section className="l-sec">
        <div className="l-num">{t('launch.num')}</div>
        <h2 className="an">{t('launch.title')}</h2>
        <p className="l-sub" style={{ maxWidth: '34em' }}>
          {t('launch.sub')}
        </p>
        <div className="l-steps">
          <div className="l-step an">
            <div className="n">1</div>
            <div className="d">{t('launch.s1.d')}</div>
            <h4>{t('launch.s1.h')}</h4>
            <p>{t('launch.s1.p')}</p>
          </div>
          <div className="l-step an" style={{ ['--d' as string]: '.08s' }}>
            <div className="n">2</div>
            <div className="d">{t('launch.s2.d')}</div>
            <h4>{t('launch.s2.h')}</h4>
            <p>{t('launch.s2.p')}</p>
          </div>
          <div className="l-step an" style={{ ['--d' as string]: '.16s' }}>
            <div className="n g">3</div>
            <div className="d g">{t('launch.s3.d')}</div>
            <h4>{t('launch.s3.h')}</h4>
            <p>{t('launch.s3.p')}</p>
          </div>
        </div>
        <div className="l-founder an">
          <div className="f">DS</div>
          <div>
            <blockquote>
              {t('launch.quote')}
            </blockquote>
            <div className="sig"><b>David Siwy</b>{t('launch.sig')}</div>
          </div>
        </div>
      </section>

      {/* 05 proof from the pilot: concrete numbers right before the price */}
      <section className="l-sec">
        <div className="l-num">{t('proof.num')}</div>
        <h2 className="an" style={{ maxWidth: '16em' }}>{t('proof.title')}</h2>
        <p className="l-sub">
          {t('proof.sub')}
        </p>
        <div className="l-proof">
          <div className="l-pilot an">
            <div className="ph"><span>{t('proof.photoCaption')}</span></div>
            <div className="body">
              <div className="t">
                <b className="name">Rezidence Vista Park</b>
                <span className="l-live"><i className="pulse" />{t('proof.live')}</span>
              </div>
              <div className="l-mono" style={{ fontSize: 11, color: '#8b93a0', marginTop: 4 }}>{t('proof.meta')}</div>
              <div className="l-pgrid">
                <div className="l-pcell"><b>{t('proof.p1n')}</b><span>{t('proof.p1t')}</span></div>
                <div className="l-pcell"><b>{t('proof.p2n')}</b><span>{t('proof.p2t')}</span></div>
                <div className="l-pcell"><b>{t('proof.p3n')}</b><span>{t('proof.p3t')}</span></div>
                <div className="l-pcell"><b>{t('proof.p4n')}</b><span>{t('proof.p4t')}</span></div>
              </div>
            </div>
          </div>
          <div className="l-tstm">
            <div className="l-tcard an">
              <div className="q">{t('proof.q1')}</div>
              <div className="who">
                <span className="ini">PH</span>
                <div><b>{t('proof.who1n')}</b>{t('proof.who1r')}</div>
                <span className="badge">{t('roles.vybor.kicker')}</span>
              </div>
            </div>
            <div className="l-tcard an" style={{ ['--d' as string]: '.08s' }}>
              <div className="q">{t('proof.q2')}</div>
              <div className="who">
                <span className="ini">MK</span>
                <div><b>{t('proof.who2n')}</b>{t('proof.who2r')}</div>
                <span className="badge">A-014</span>
              </div>
            </div>
            <div className="l-tcard an" style={{ ['--d' as string]: '.16s' }}>
              <div className="q">{t('proof.q3')}</div>
              <div className="who">
                <span className="ini">TR</span>
                <div><b>{t('proof.who3n')}</b>{t('proof.who3r')}</div>
                <span className="badge">B-112</span>
              </div>
            </div>
            <div className="l-note">{t('proof.note')}</div>
          </div>
        </div>
        <div className="l-cta-bar an">
          <div className="t">{t('proof.ctaText')}</div>
          <button className="l-btn l-primary l-sm" onClick={() => go('kontakt')}>{t('proof.ctaBtn')}</button>
        </div>
      </section>

      {/* 06 pricing: one card, guarantee inside */}
      <section className="l-sec" id="cenik">
        <div style={{ textAlign: 'center' }}>
          <div className="l-num">{t('pricing.num')}</div>
          <h2 className="an">{t('pricing.title')}</h2>
          <p className="l-sub" style={{ margin: '12px auto 0', maxWidth: '34em' }}>
            {t('pricing.sub')}
          </p>
        </div>
        <div className="l-price-card an">
          <span className="flag">{t('pricing.flag')}</span>
          <div className="l-price">
            <div className="v">{OFFER.pricePerUnit} Kč</div>
            <div className="u">{t('pricing.perUnit')}</div>
          </div>
          <div className="l-price-desc">
            {t('pricing.desc')}
          </div>
          <div className="l-incl">
            <span><Chk />{t('pricing.i1')}</span>
            <span><Chk />{t('pricing.i2')}</span>
            <span><Chk />{t('pricing.i3')}</span>
            <span><Chk />{t('pricing.i4')}</span>
            <span><Chk />{t('pricing.i5')}</span>
            <span><Chk />{t('pricing.i6')}</span>
          </div>
          <div className="l-guar">
            <div className="l-guar-h">
              <Glyph d={G.shield} size={18} stroke="#12901E" />
              <b>{t('pricing.guarTitle')}</b>
            </div>
            <div className="l-guar-list">
              <span><Chk w={14} />{t('pricing.g1', { months: freeMonthsLabel })}</span>
              <span><Chk w={14} />{t('pricing.g2', { launch: launchLabel })}</span>
              <span><Chk w={14} />{t('pricing.g3')}</span>
              <span><Chk w={14} />{t('pricing.g4')}</span>
            </div>
          </div>
          <button className="l-btn l-primary" style={{ width: '100%', marginTop: 20, padding: 14 }} onClick={() => go('kontakt')}>
            {t('pricing.cta')}
          </button>
        </div>
        <p className="l-under">
          {t('pricing.underPre')}{' '}
          <button onClick={() => go('kontakt')}>{t('pricing.underLink')}</button>.
        </p>
        <p className="l-fine">{t('pricing.fine')}</p>
      </section>

      {/* 07 faq: six questions, two columns */}
      <section className="l-sec" id="faq">
        <div className="l-num">{t('faq.num')}</div>
        <h2 className="an">{t('faq.title')}</h2>
        <div className="l-faq">
          <div>
            {faqs.slice(0, 3).map((f, i) => (
              <details className="l-q" key={f.q} open={i === 0}>
                <summary>{f.q}<i><Plus /></i></summary>
                <div className="l-a">{f.a}</div>
              </details>
            ))}
          </div>
          <div>
            {faqs.slice(3).map((f) => (
              <details className="l-q" key={f.q}>
                <summary>{f.q}<i><Plus /></i></summary>
                <div className="l-a">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
        <p className="l-faq-note">
          {t('faq.notePre')} <button onClick={() => go('cenik')}>{t('faq.noteCenik')}</button>{t('faq.noteMid')}{' '}
          <button onClick={() => go('moat')}>{t('faq.noteMoat')}</button>{t('faq.noteEnd')}{' '}
          <a href={'mailto:' + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      {/* closing CTA: green band with the lead form */}
      <section className="l-close" id="kontakt">
        <div className="l-close-in">
          <div>
            <h2 className="an">{t('contact.title')}</h2>
            <p className="l-sub">
              {t('contact.sub', { launch: launchLabel })}
            </p>
            <div className="l-close-steps an">
              <div><i>1</i><span><b>{t('contact.step1')}</b> — {t('contact.step1d')}</span></div>
              <div><i>2</i><span><b>{t('contact.step2')}</b> — {t('contact.step2d')}</span></div>
              <div><i>3</i><span><b>{t('contact.step3', { launch: launchLabel })}</b> — {t('contact.step3d')}</span></div>
            </div>
            <p className="l-close-mail">{t('contact.orMail')} <a href={'mailto:' + CONTACT_EMAIL}>{CONTACT_EMAIL}</a></p>
          </div>

          <div className="l-form an" style={{ ['--d' as string]: '.1s' }}>
            <div className="bk-brandrow">
              <div className="bk-brand"><span className="dot" />Tasker&nbsp;Living</div>
              <span className="bk-pill">{t('book.pill')}</span>
            </div>
            <div className="bk-rule" />

            {bStep !== 'done' && (
              <div className="bk-chrome">
                {bStep !== 'date'
                  ? <button className="bk-back" onClick={() => setBStep(bStep === 'contact' ? 'time' : 'date')}>{t('book.back')}</button>
                  : <span />}
                <span className="bk-stepno">{t('book.stepOf', { n: bStep === 'date' ? 1 : bStep === 'time' ? 2 : 3 })}</span>
              </div>
            )}

            {bStep === 'date' && (
              <div className="bk-step">
                <h3>{t('book.s1title')}</h3>
                <p className="bk-sub">{t('book.s1sub')}</p>
                <div className="bk-dates">
                  {slotDays.map((d, i) => {
                    const full = freeCount(d) === 0
                    return (
                      <button key={i} className={'bk-date' + (dayIdx === i ? ' sel' : '') + (full ? ' full' : '')}
                        disabled={full} onClick={() => { setDayIdx(i); setSlot(null) }}>
                        <span className="abbr">{fmtDayAbbr(d, i18n.language)}</span>
                        <span className="num">{d.getDate()}{i18n.language.startsWith('en') ? '' : '.'}</span>
                        <span className="mon">{fmtMonChip(d, i18n.language)}</span>
                      </button>
                    )
                  })}
                </div>
                <button className="l-btn l-primary bk-go" disabled={dayIdx === null} onClick={() => setBStep('time')}>
                  {t('book.continue')}
                </button>
              </div>
            )}

            {bStep === 'time' && dayIdx !== null && (
              <div className="bk-step">
                <h3>{t('book.s2title')}</h3>
                <p className="bk-sub">{t('book.s2sub', { date: fmtDayLong(slotDays[dayIdx], i18n.language) })}</p>
                <div className="bk-grid">
                  {SLOT_TIMES.map((s) => {
                    const tk = isTaken(slotDays[dayIdx], s)
                    return (
                      <button key={s} className={'bk-slot' + (tk ? ' taken' : '') + (slot === s ? ' sel' : '')}
                        disabled={tk} onClick={() => setSlot(s)}>
                        {fmtSlot(s, i18n.language)}
                      </button>
                    )
                  })}
                </div>
                {freeCount(slotDays[dayIdx]) === 0 && <p className="bk-sub">{t('book.s2none')}</p>}
                <button className="l-btn l-primary bk-go" disabled={!slot} onClick={() => setBStep('contact')}>
                  {t('book.continue')}
                </button>
              </div>
            )}

            {bStep === 'contact' && dayIdx !== null && slot && (
              <div className="bk-step">
                <h3>{t('book.s3title')}</h3>
                <p className="bk-sub">{t('book.s3sub', { date: fmtDayLong(slotDays[dayIdx], i18n.language), time: fmtSlot(slot, i18n.language) })}</p>
                <div className={'l-field bk-field' + (fErr.name ? ' invalid' : '')}>
                  <label htmlFor="l-name">{t('book.fName')}</label>
                  <input id="l-name" value={cName} onChange={(e) => { setCName(e.target.value); setFErr((s) => ({ ...s, name: '' })) }} placeholder={t('book.phName')} />
                  {fErr.name && <div className="bk-err">{fErr.name}</div>}
                </div>
                <div className={'l-field bk-field' + (fErr.email ? ' invalid' : '')}>
                  <label htmlFor="l-mail">{t('book.fEmail')}</label>
                  <input id="l-mail" type="email" value={cEmail} onChange={(e) => { setCEmail(e.target.value); setFErr((s) => ({ ...s, email: '' })) }} placeholder={t('book.phEmail')} />
                  {fErr.email && <div className="bk-err">{fErr.email}</div>}
                </div>
                <div className={'l-field bk-field' + (fErr.phone ? ' invalid' : '')}>
                  <label htmlFor="l-phone">{t('book.fPhone')}</label>
                  <input id="l-phone" type="tel" value={cPhone} onChange={(e) => { setCPhone(e.target.value); setFErr((s) => ({ ...s, phone: '' })) }} placeholder={t('book.phPhone')} />
                  {fErr.phone && <div className="bk-err">{fErr.phone}</div>}
                </div>
                <div className="l-field bk-field">
                  <label htmlFor="l-size">{t('contact.labelSize')}</label>
                  <select id="l-size" value={cSize} onChange={(e) => setCSize(e.target.value)}>
                    {SIZE_KEYS.map((k) => <option key={k} value={k}>{t('contact.sizeOpts.' + k)}</option>)}
                  </select>
                </div>
                {formErr && <p className="l-err">{formErr}</p>}
                <button className="l-btn l-primary bk-go" onClick={sendContact} disabled={cState === 'busy'}>
                  {cState === 'busy' ? t('book.sending') : t('book.submit')}
                </button>
                <p className="l-form-note">
                  {t('book.fine')}{' '}
                  <Link to="/ochrana-udaju">{t('contact.formNoteLink')}</Link>.
                </p>
              </div>
            )}

            {bStep === 'done' && dayIdx !== null && slot && (() => {
              const c = calendarLinks(slotDays[dayIdx], slot, t('book.calTitle'), t('book.calDesc'), t('book.calLoc'))
              return (
                <div className="bk-step bk-done">
                  <div className="bk-check"><Chk w={26} /></div>
                  <h3>{t('book.doneTitle')}</h3>
                  <p className="bk-sub">{t('book.doneSub')}</p>
                  <div className="bk-summary">
                    <div className="row"><div className="k">{t('book.sumWhen')}</div><div className="v">{fmtDayLong(slotDays[dayIdx], i18n.language)} · {fmtSlot(slot, i18n.language)}</div></div>
                    <div className="row"><div className="k">{t('book.sumFormat')}</div><div className="v">{t('book.sumFormatVal')}</div></div>
                    <div className="row"><div className="k">{t('book.sumContact')}</div><div className="v">{cName}<small>{cEmail}{cPhone ? ' · ' + cPhone : ''}</small></div></div>
                  </div>
                  <div className="bk-cal">
                    <a href={c.g} target="_blank" rel="noopener noreferrer">{t('book.gcal')}</a>
                    <a href={c.ics} download="tasker-hovor.ics">{t('book.ics')}</a>
                  </div>
                  <button className="bk-again" onClick={resetBooking}>{t('book.again')}</button>
                </div>
              )
            })()}
          </div>
        </div>
      </section>

      {/* footer: one row */}
      <footer className="l-foot">
        <div className="l-foot-in">
          <div className="l-foot-brand">
            <img className="l-logo" src={logo} alt="Tasker Living" />
            <small>{t('shell:brand.tagline')}</small>
          </div>
          <div className="l-foot-links">
            <button onClick={() => go('prohlidka')}>{t('nav.prohlidka')}</button>
            <button onClick={() => go('cenik')}>{t('nav.cenik')}</button>
            <a href="https://tasker.cz" target="_blank" rel="noreferrer">tasker.cz</a>
            <Link to="/ochrana-udaju">{t('footer.protection')}</Link>
            <Link to="/podminky">{t('footer.terms')}</Link>
          </div>
          <span className="l-copy">{t('footer.copy')}</span>
        </div>
      </footer>

      {/* 2b: sticky bottom CTA bar on mobile */}
      <div className={'l-sticky' + (sticky ? ' show' : '')}>
        <button className="l-btn l-ghost" onClick={enterDemo}>{t('nav.demo')}</button>
        <button className="l-btn l-primary" onClick={() => go('kontakt')}>{t('nav.cta')}</button>
      </div>
    </div>
  )
}
