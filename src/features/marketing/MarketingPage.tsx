import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { enterDemo } from '../../lib/supabase'
import mark from '../../assets/mark.png'
import './landing.css'

const CONTACT_EMAIL = 'info@tasker.cz'

// The offer. One place to tune the promise the ads and the page make.
const OFFER = { freeMonths: '2 měsíce', launch: '48 hodin', pricePerUnit: 399 }

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
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  const [cName, setCName] = useState(''); const [cEmail, setCEmail] = useState(''); const [cPhone, setCPhone] = useState('')
  const [cSize, setCSize] = useState('do 20 jednotek'); const [cMsg, setCMsg] = useState('')
  const [cState, setCState] = useState<'idle' | 'busy' | 'done' | 'err'>('idle')
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
    if (cState === 'busy') return
    if (!cName.trim() || !cEmail.trim()) { setCState('err'); return }
    setCState('busy')
    try {
      const res = await fetch('https://formsubmit.co/ajax/' + CONTACT_EMAIL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: 'Tasker Living: poptávka ukázky z webu',
          Jmeno: cName.trim(), Email: cEmail.trim(), Telefon: cPhone.trim(),
          Velikost: cSize, Zprava: cMsg.trim(),
        }),
      })
      if (!res.ok) throw new Error('send failed')
      setCState('done')
    } catch { setCState('err') }
  }

  /* ----- 01 tour: four manual processes, each with the real UI next to it ----- */
  const tours: Tour[] = [
    {
      today: '„Vylepím to do vchodu a stejně polovina lidí řekne, že o ničem nevěděla.“',
      h: 'Oznámení, které si sousedé přečtou',
      p: 'Napíšete ho jednou a všem přijde notifikace do telefonu. Konec papírků ve vchodě a mailů ve spamu.',
      ticks: ['Vidíte, kolik bytů si oznámení přečetlo', 'Cílení na vchod, patro nebo celý dům'],
      mock: (
        <div className="l-mock an">
          <div style={{ background: '#12161D', color: '#fff', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, color: '#aeb5c0', fontWeight: 600 }}>
              <img src={mark} alt="" style={{ width: 14, height: 14, borderRadius: 4 }} />
              TASKER LIVING · teď
            </div>
            <b style={{ fontSize: 14, fontWeight: 700, display: 'block', marginTop: 5 }}>Odstávka vody ve čtvrtek 8:00–12:00</b>
            <span style={{ fontSize: 12, color: '#aeb5c0' }}>Týká se vchodů A a B · napusťte si vodu předem</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#48515C', flex: 'none' }}>Přečteno</span>
            <div className="l-bar"><i className="grow" style={{ width: '95%' }} /></div>
            <b className="l-mono" style={{ fontSize: 12.5, fontWeight: 600, color: '#12901E', flex: 'none' }}>38 / 40 bytů</b>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12, color: '#8b93a0' }}>
            <span className="l-mono" style={{ fontWeight: 600, background: '#EEF2F7', borderRadius: 999, padding: '3px 10px', fontSize: 10.5, color: '#48515C' }}>CELÝ DŮM</span>
            <span>odesláno 1×, doručeno všem · žádné přelepené papírky</span>
          </div>
        </div>
      ),
    },
    {
      today: '„Zase kontroluju výpisy a píšu SMS, kdo nezaplatil zálohy.“',
      h: 'Nájmy a zálohy bez tabulek',
      p: 'Předpisy na klik, soused platí QR kódem na účet domu, vy jen potvrdíte. Neplatiče vidíte na jedné obrazovce.',
      ticks: ['Peníze jdou přímo na účet domu, ne přes nás', 'Upomínky hromadně jedním klikem'],
      flip: true,
      mock: (
        <div className="l-mock an">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <b style={{ fontSize: 14, fontWeight: 800 }}>Předpisy · červen</b>
            <span className="l-state l-ok" style={{ width: 'auto' }}>Vybráno 92 %</span>
          </div>
          <div className="l-rows">
            <div className="l-row"><b>B-204</b><span className="l-what">24 500 Kč</span><span className="l-state l-ok" style={{ width: 'auto' }}>Zaplaceno · QR</span></div>
            <div className="l-row due"><b>B-112</b><span className="l-what">8 900 Kč</span><span className="l-state l-warn" style={{ width: 'auto' }}>Po splatnosti</span></div>
            <div className="l-row due"><b>C-018</b><span className="l-what">8 900 Kč</span><span className="l-state l-warn" style={{ width: 'auto' }}>Po splatnosti</span></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <span className="l-btn l-dark l-sm" style={{ fontSize: 12.5, padding: '9px 14px', borderRadius: 10 }}>Poslat 2 upomínky</span>
            <span style={{ fontSize: 12, color: '#8b93a0' }}>jedním klikem, bez SMS a bez výčitek</span>
          </div>
        </div>
      ),
    },
    {
      today: '„Svoláme schůzi a nesejde se ani polovina podílů.“',
      h: 'Schůze, která se konečně sejde',
      p: 'Hlasování podle podílů, plné moci a zápis vygenerovaný z výsledků. Per rollam bez obcházení pater.',
      ticks: ['Podíly a usnášeníschopnost počítá aplikace', 'Zápis ke stažení hned po hlasování'],
      mock: (
        <div className="l-mock an">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <b style={{ fontSize: 14, fontWeight: 800 }}>Usnesení 3/2026 · Oprava střechy</b>
            <span className="l-state l-ok" style={{ width: 'auto', flex: 'none' }}>Usnášeníschopné</span>
          </div>
          <div className="l-dual">
            <div className="grow" style={{ width: '62%', background: '#06C40A' }} />
            <div className="grow" style={{ width: '11%', background: '#B26A00', ['--d' as string]: '.5s' }} />
          </div>
          <div className="l-legend">
            <span><i style={{ background: '#06C40A' }} /><b style={{ fontWeight: 700 }}>62 %</b> podílů pro</span>
            <span><i style={{ background: '#B26A00' }} />11 % proti</span>
            <span><i style={{ background: '#D7DDE7' }} />27 % zatím nehlasovalo</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 16, paddingTop: 14, borderTop: '1px solid #E5E9F0' }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: '#EEF2F7', color: '#12901E', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <Glyph d={G.doc} size={15} />
            </span>
            <div style={{ flex: 1 }}>
              <b style={{ fontSize: 13, fontWeight: 700, display: 'block' }}>Zápis z hlasování</b>
              <span style={{ fontSize: 11.5, color: '#8b93a0' }}>vygenerovaný z výsledků, včetně plných mocí</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#12901E' }}>Stáhnout PDF</span>
          </div>
        </div>
      ),
    },
    {
      today: '„Hlásil jsem to před měsícem a dodnes nevím, jestli se něco děje.“',
      h: 'Závady s fotkou místo lístečku',
      p: 'Soused vyfotí, vy přiřadíte dodavatele, on vidí průběh. Každá závada má odpovědného a termín.',
      ticks: ['Historie u bytu i u domu, nic se neztratí', 'Ohlašovatel dostává notifikace o průběhu'],
      flip: true,
      mock: (
        <div className="l-mock an">
          <div style={{ display: 'flex', gap: 14 }}>
            <div className="l-photo" style={{ width: 110, height: 110, flex: 'none' }}><span>foto závady<br />od souseda</span></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ fontSize: 14, fontWeight: 800 }}>Kape ventil ve sklepě</b>
                <span className="l-mono" style={{ fontSize: 10, fontWeight: 600, color: '#48515C', background: '#EEF2F7', borderRadius: 999, padding: '3px 9px', flex: 'none' }}>VCHOD B</span>
              </div>
              <span style={{ fontSize: 12, color: '#8b93a0' }}>nahlásil byt B-112 · úterý 19:42</span>
              <div style={{ display: 'grid', gap: 7, marginTop: 10, fontSize: 12.5 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#12901E', fontWeight: 600 }}><Chk w={13} />Nahlášeno s fotkou</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#12901E', fontWeight: 600 }}><Chk w={13} />Přiřazeno: Instalatér Kraus, čtvrtek</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#8b93a0', fontWeight: 600 }}>
                  <span style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid #D7DDE7', flex: 'none' }} />Vyřešeno
                </span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #E5E9F0', fontSize: 12, color: '#8b93a0' }}>
            Ohlašovatel vidí každý krok — nikdo nevolá výboru v neděli večer.
          </div>
        </div>
      ),
    },
  ]

  const faqs = [
    { q: 'Co když sousedé žádnou aplikaci používat nechtějí?', a: 'Nemusí se připojit všichni a nemusí to být hned. Aplikace dává smysl už pro samotný výbor: předpisy, dokumenty, evidence závad. Sousedé se přidávají postupně, každé oznámení s notifikací je důvod navíc. V pilotním domě se většina připojila během prvních týdnů.' },
    { q: 'Jak dlouho trvá spuštění a co pro to musíme udělat?', a: `Pošlete seznam jednotek a nájmů, my do ${OFFER.launch} připravíme celý dům a přístupové kódy. Nic neinstalujete, aplikace běží v prohlížeči i jako ikona na ploše telefonu.` },
    { q: 'Jak fungují platby nájmů a záloh?', a: 'Výbor jedním tlačítkem vystaví měsíční předpisy. Soused zaplatí QR kódem přímo na účet domu, peníze vám nikdy neprocházejí přes nás. Platbu potvrdíte jedním klikem, upomínka je taky na klik. Automatické párování z banky připravujeme.' },
    { q: 'Pokrývá aplikace povinnost internetových stránek SVJ?', a: 'Výbor dostane zabezpečený prostor pro oznámení, dokumenty, zápisy a hlasování, tedy způsob, jak zpřístupnit informace vlastníkům podle stanov. Konkrétní požadavky vašich stanov s vámi rádi projdeme.' },
    { q: 'Jsou data domu v bezpečí a co s nimi, když skončíme?', a: 'Data jsou uložena v Evropské unii a chráněná právy podle rolí, každý vidí jen to, co má. Když skončíte, předáme vám export a data smažeme. Žádné držení dat jako rukojmí.' },
    { q: 'Musíme kvůli tomu měnit správce nebo účetnictví?', a: 'Ne. Tasker Living doplňuje správce o komunikaci, platby a hlasování, které dnes řešíte ručně. Účetnictví i technická správa zůstávají, jak jste zvyklí.' },
  ]

  return (
    <div className="lp2">
      {/* nav: 4 anchors = 4 sections, one primary CTA */}
      <nav className={'l-nav' + (scrolled ? ' scrolled' : '')}>
        <div className="l-nav-in">
          <div className="l-brand">
            <img src={mark} alt="" />
            <div><b>Tasker Living</b><small>Součást Tasker</small></div>
          </div>
          <div className="l-nav-links">
            <button onClick={() => go('prohlidka')}>Prohlídka</button>
            <button onClick={() => go('prokoho')}>Pro koho</button>
            <button onClick={() => go('cenik')}>Ceník</button>
            <button onClick={() => go('faq')}>Dotazy</button>
          </div>
          <div className="l-nav-right">
            <button className="l-nav-demo" onClick={enterDemo}>Vyzkoušet demo</button>
            <button className="l-btn l-primary l-sm" onClick={() => go('kontakt')}>Ukázka zdarma</button>
          </div>
        </div>
      </nav>

      {/* hero: the claim, and right under it the real product for both roles */}
      <header className="l-hero">
        <div className="l-eyebrow an"><i className="pulse" /> Aplikace pro bytové domy a SVJ</div>
        <h1 className="an" style={{ ['--d' as string]: '.05s' }}>
          Celý dům v jedné aplikaci. <em>Konec papírků ve vchodě.</em>
        </h1>
        <p className="l-lead an" style={{ ['--d' as string]: '.1s' }}>
          Oznámení přijdou sousedům jako notifikace, nájmy se platí QR kódem, závady mají fotku a průběh
          a hlasování se konečně sejde. Pro výbor, rezidenty i developera.
        </p>
        <div className="l-hero-cta an" style={{ ['--d' as string]: '.15s' }}>
          <button className="l-btn l-primary" onClick={() => go('kontakt')}>Chci ukázku zdarma</button>
          <button className="l-btn l-ghost" onClick={enterDemo}>Vyzkoušet demo hned</button>
        </div>
        <div className="l-risk an" style={{ ['--d' as string]: '.25s' }}>
          <span><Chk w={14} /> Spuštění do {OFFER.launch}</span>
          <span><Chk w={14} /> Prvních {OFFER.freeMonths} zdarma</span>
          <span><Chk w={14} /> Zrušíte jednou zprávou</span>
        </div>
      </header>

      {/* product showcase: committee on the web, neighbour on the phone */}
      <section className="l-show">
        <div className="l-show-in">
          <div className="l-browser an">
            <span className="l-tag">VÝBOR VIDÍ · WEB</span>
            <div className="l-chrome">
              <span style={{ display: 'flex', gap: 5 }}><i /><i /><i /></span>
              <span className="l-url">living.tasker.cz/vista-park</span>
            </div>
            <div className="l-bhead">
              <div style={{ flex: 1 }}>
                <div className="l-kicker-xs">Rezidence</div>
                <b>Vista Park</b>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 999, background: '#EFE9FC', color: '#6A4BC2' }}>Role: výbor</span>
            </div>
            <div className="l-btabs">
              <span className="on">Přehled</span><span>Platby</span><span>Schůze</span><span>Závady</span><span>Dokumenty</span>
            </div>
            <div className="l-bkpis">
              <div className="l-bkpi"><span>Vybráno v červnu</span><b className="g">92 %</b></div>
              <div className="l-bkpi"><span>Otevřené závady</span><b>2</b></div>
              <div className="l-bkpi"><span>Hlasování o střeše</span><b className="g">62 % pro</b></div>
            </div>
            <div style={{ padding: '16px 22px 20px' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#48515C', marginBottom: 8 }}>Platby · červen</div>
              <div className="l-rows">
                <div className="l-row"><b>B-201</b><span className="l-what">nájem + zálohy</span><span className="l-amt">24 500 Kč</span><span className="l-state l-ok">Zaplaceno</span></div>
                <div className="l-row"><b>B-204</b><span className="l-what">nájem + zálohy</span><span className="l-amt">24 500 Kč</span><span className="l-state l-ok">Zaplaceno · QR</span></div>
                <div className="l-row due"><b>B-112</b><span className="l-what">zálohy</span><span className="l-amt">8 900 Kč</span><span className="l-state l-warn">Upomínka odeslána</span></div>
                <div className="l-row"><b>C-018</b><span className="l-what">zálohy</span><span className="l-amt">8 900 Kč</span><span className="l-state l-neutral">Čeká</span></div>
              </div>
            </div>
          </div>

          <div className="l-phone floaty">
            <div className="l-status"><span>9:41</span><span style={{ display: 'flex', gap: 3, alignItems: 'center' }}><i /><i className="r" /></span></div>
            <div className="l-pnotif notif">
              <div className="h"><img src={mark} alt="" />TASKER LIVING · teď</div>
              <b>Odstávka vody ve čtvrtek</b>
              <span className="s">8:00–12:00, vchody A a B</span>
            </div>
            <div className="l-pcard">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <b style={{ fontSize: 11, fontWeight: 800 }}>Nájem · červen</b>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#FDF1E2', color: '#B26A00' }}>Do 15. 6.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <div className="l-qr" />
                <div>
                  <b style={{ fontSize: 13, fontWeight: 800, display: 'block' }}>24 500 Kč</b>
                  <span style={{ fontSize: 9.5, color: '#8b93a0' }}>QR na účet domu</span>
                </div>
              </div>
              <div className="l-pbtn">Zaplatit v bance</div>
            </div>
            <div className="l-pcard" style={{ marginBottom: 12, display: 'flex', gap: 9, alignItems: 'center' }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: '#E7F7E8', color: '#12901E', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Glyph d={G.lift} size={13} />
              </span>
              <div>
                <b style={{ fontSize: 10.5, fontWeight: 700, display: 'block' }}>Výtah C: přiřazen servis</b>
                <span style={{ fontSize: 9, color: '#8b93a0' }}>sledujete průběh</span>
              </div>
            </div>
            <span className="l-home" />
          </div>
          <span className="l-ptag">SOUSED VIDÍ · TELEFON</span>
        </div>

        {/* stat strip */}
        <div className="l-strip an" style={{ ['--d' as string]: '.15s' }}>
          <div className="l-stats">
            <div><b>40</b>jednotek v pilotu</div>
            <div><b>48 h</b>od podkladů ke spuštění</div>
            <div><b>0 Kč</b>za nastavení domu</div>
            <div><b>20 000+</b>klientů platformy Tasker</div>
          </div>
          <div className="l-chips">
            <span className="l-chip"><Glyph d={G.home} size={13} stroke="#12901E" />Pilot: Vista Park, Praha 5</span>
            <span className="l-chip"><Glyph d={G.shield} size={13} stroke="#12901E" />Data v EU</span>
            <span className="l-chip"><Glyph d={G.doc} size={13} stroke="#12901E" />Pokrývá povinnost webu SVJ</span>
            <span className="l-chip"><Glyph d={G.spark} size={13} stroke="#12901E" />Součást rodiny Tasker</span>
          </div>
        </div>
      </section>

      {/* 01 tour: pain -> solution -> real UI */}
      <section className="l-sec" id="prohlidka">
        <div className="l-num">01 · Prohlídka aplikace</div>
        <h2 className="an" style={{ maxWidth: '18em' }}>Čtyři večery, které výboru každý měsíc vrátíme</h2>
        <p className="l-sub">
          Výbor to dnes dělá po večerech, s nástěnkou, Excelem a trpělivostí. Každý blok níže nahrazuje
          jeden ruční proces — a ukazuje, jak přesně to v aplikaci vypadá.
        </p>

        {tours.map((t) => (
          <div className="l-tour" key={t.h}>
            {t.flip && t.mock}
            <div>
              <div className="l-today">DNES</div>
              <div className="l-quote">{t.today}</div>
              <div className="l-with">S TASKER LIVING</div>
              <h3>{t.h}</h3>
              <p>{t.p}</p>
              <div className="l-ticks">
                {t.ticks.map((x) => <span key={x}><Chk />{x}</span>)}
              </div>
            </div>
            {!t.flip && t.mock}
          </div>
        ))}

        <div className="l-side2">
          <div className="l-side an">
            <span className="l-sic"><Glyph d={G.doc} /></span>
            <div>
              <b>A k tomu: stanovy a zápisy k nalezení</b>
              <p>Dokumenty domu na jednom místě, viditelnost podle rolí. Konec hledání v deset let staré poště.</p>
            </div>
          </div>
          <div className="l-side an" style={{ ['--d' as string]: '.08s' }}>
            <span className="l-sic"><Glyph d={G.chat} /></span>
            <div>
              <b>A k tomu: sousedské spory bez konfliktu</b>
              <p>Stížnost se eviduje k bytu, ne ke jménu. Výbor upozorní jedním tlačítkem, nikdo se nehádá na chodbě.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 02 moat: the only dark section on the page */}
      <section className="l-moat" id="moat">
        <div className="l-moat-in">
          <div>
            <div className="l-num">02 · Tohle nikdo jiný nemá</div>
            <h2 className="an">Ostatní evidují. My pošleme i ruce, které to udělají.</h2>
            <p className="l-sub">
              Ostatní aplikace pro domy končí u evidence. Tasker Living stojí na platformě Tasker, takže soused
              na pár kliknutí objedná ověřeného pracovníka: úklid, drobnou opravu, mytí oken. Bez shánění,
              bez telefonování, s hodnocením.
            </p>
            <div className="l-ticks">
              <span><ChkLight />Ověření pracovníci s hodnocením</span>
              <span><ChkLight />Objednávka přímo z aplikace, termín potvrdí dispečink</span>
              <span><ChkLight />Dům se službami po ruce je atraktivnější pro nájemníky</span>
            </div>
            <div className="l-20k an" style={{ ['--d' as string]: '.15s' }}>
              <b className="n">20 000+</b>
              <span><b>klientů dnes používá platformu Tasker.</b><br />Síť ověřených pracovníků a zkušenosti z tisíců zakázek přenášíme do Tasker Living.</span>
            </div>
          </div>
          <div className="l-svc an">
            <div className="l-kicker-xs">Služby Tasker · byt B-204</div>
            <div className="l-pills">
              <span className="on">Drobná oprava</span><span>Úklid</span><span>Mytí oken</span>
            </div>
            <div className="l-worker">
              <span className="l-ava">MP</span>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 14.5, fontWeight: 800, display: 'block' }}>Marek P.</b>
                <span style={{ fontSize: 12, color: '#8b93a0' }}>★ 4,9 · 132 zakázek · prověřený</span>
              </div>
              <span className="l-state l-ok" style={{ width: 'auto' }}>Ověřený</span>
            </div>
            <div className="l-slots">
              <span className="on">Čt 14:00</span><span>Pá 9:00</span><span>Pá 16:00</span>
            </div>
            <div className="l-btn l-primary" style={{ width: '100%', marginTop: 14, fontSize: 14, padding: 13 }}>Objednat na čtvrtek 14:00</div>
          </div>
        </div>
      </section>

      {/* 03 for whom: three roles, each with its own CTA */}
      <section className="l-sec" id="prokoho">
        <div className="l-num">03 · Pro koho</div>
        <h2 className="an">Jeden dům, tři role, každá dostane svoje</h2>
        <div className="l-roles">
          <div className="l-role an">
            <div className="l-kicker-xs" style={{ fontSize: 10.5 }}>Výbor SVJ</div>
            <h3>Vrátíme vám večery</h3>
            <div className="l-ticks">
              <span><Chk />Platby a upomínky bez tabulek</span>
              <span><Chk />Hlasování, které je usnášeníschopné</span>
              <span><Chk />Závady s odpovědným a termínem</span>
            </div>
            <button onClick={() => go('kontakt')}>Chci ukázku zdarma →</button>
          </div>
          <div className="l-role an" style={{ ['--d' as string]: '.08s' }}>
            <div className="l-kicker-xs" style={{ fontSize: 10.5 }}>Soused · rezident</div>
            <h3>Celý dům v kapse</h3>
            <div className="l-ticks">
              <span><Chk />Notifikace místo nástěnky ve vchodě</span>
              <span><Chk />Nájem zaplacený QR kódem za minutu</span>
              <span><Chk />Služby Tasker na pár kliknutí</span>
            </div>
            <button onClick={enterDemo}>Vyzkoušet demo →</button>
          </div>
          <div className="l-role an" style={{ ['--d' as string]: '.16s' }}>
            <div className="l-kicker-xs" style={{ fontSize: 10.5 }}>Developer · investor</div>
            <h3>Předáte dům, ne šanon</h3>
            <div className="l-ticks">
              <span><Chk />Novostavba předaná s hotovou aplikací</span>
              <span><Chk />Přehled nájmů napříč portfoliem</span>
              <span><Chk />Podmínky a nasazení na míru</span>
            </div>
            <button onClick={() => go('kontakt')}>Domluvit podmínky →</button>
          </div>
        </div>
      </section>

      {/* 04 launch: timeline + founder */}
      <section className="l-sec">
        <div className="l-num">04 · Spuštění</div>
        <h2 className="an">Vy pošlete tabulku, my uděláme zbytek</h2>
        <p className="l-sub" style={{ maxWidth: '34em' }}>
          Žádná instalace, žádná migrace, žádné školení na půl dne. Nastavení domu je naše práce, ne vaše.
        </p>
        <div className="l-steps">
          <div className="l-step an">
            <div className="n">1</div>
            <div className="d">DEN 0</div>
            <h4>Pošlete nám seznam jednotek</h4>
            <p>Stačí čísla bytů a nájmy. Klidně vyfocená tabulka, zbytek uděláme my.</p>
          </div>
          <div className="l-step an" style={{ ['--d' as string]: '.08s' }}>
            <div className="n">2</div>
            <div className="d">DEN 1–2</div>
            <h4>Připravíme celý dům</h4>
            <p>Nastavíme jednotky, platby i dokumenty a předáme vám přístupové kódy pro sousedy.</p>
          </div>
          <div className="l-step an" style={{ ['--d' as string]: '.16s' }}>
            <div className="n g">3</div>
            <div className="d g">DO 48 HODIN</div>
            <h4>Rozdáte kódy a dům běží</h4>
            <p>Sousedé se připojí kódem ke svému bytu. První oznámení pošlete ještě ten den.</p>
          </div>
        </div>
        <div className="l-founder an">
          <div className="f">DS</div>
          <div>
            <blockquote>
              „Tasker Living jsme nepostavili od stolu. Stavíme a spravujeme vlastní rezidenci se 40 jednotkami
              a přesně tyhle věci nás štvaly: papírky, výpisy, schůze, které se nesejdou. Tak jsme si udělali nástroj,
              který bychom sami chtěli, a teď ho dáváme dalším domům. Každý dům spouštím osobně.“
            </blockquote>
            <div className="sig"><b>David Siwy</b>, zakladatel Tasker Living · developer Rezidence Vista Park · zakladatel platformy Tasker</div>
          </div>
        </div>
      </section>

      {/* 05 proof from the pilot: concrete numbers right before the price */}
      <section className="l-sec">
        <div className="l-num">05 · Důkaz z pilotu</div>
        <h2 className="an" style={{ maxWidth: '16em' }}>Neslibujeme. Ukazujeme dům, kde to běží.</h2>
        <p className="l-sub">
          Žádná loga vymyšlených klientů. Jeden skutečný dům, 40 jednotek a čísla z prvních týdnů provozu —
          na požádání vám je ukážeme přímo v aplikaci.
        </p>
        <div className="l-proof">
          <div className="l-pilot an">
            <div className="ph"><span>foto: Rezidence Vista Park, Praha 5</span></div>
            <div className="body">
              <div className="t">
                <b className="name">Rezidence Vista Park</b>
                <span className="l-live"><i className="pulse" />Živý provoz</span>
              </div>
              <div className="l-mono" style={{ fontSize: 11, color: '#8b93a0', marginTop: 4 }}>Praha 5 · 40 jednotek · pilot od dubna 2026</div>
              <div className="l-pgrid">
                <div className="l-pcell"><b>38 / 40</b><span>bytů připojeno do 3 týdnů</span></div>
                <div className="l-pcell"><b>92 %</b><span>plateb do splatnosti, bez jediné SMS</span></div>
                <div className="l-pcell"><b>6 dní</b><span>k usnášeníschopnému hlasování — poprvé v historii domu</span></div>
                <div className="l-pcell"><b>0</b><span>papírků ve vchodě od spuštění</span></div>
              </div>
            </div>
          </div>
          <div className="l-tstm">
            <div className="l-tcard an">
              <div className="q">„Vyúčtování a upomínky mi dřív žraly <b>dva večery měsíčně</b>. Teď to mám za <b>dvacet minut u kafe</b> — a poprvé nikomu nepíšu SMS, kdo nezaplatil.“</div>
              <div className="who">
                <span className="ini">PH</span>
                <div><b>Petr Hlaváček</b>předseda výboru · Vista Park</div>
                <span className="badge">VÝBOR</span>
              </div>
            </div>
            <div className="l-tcard an" style={{ ['--d' as string]: '.08s' }}>
              <div className="q">„Je mi <b>71 a žádné aplikace nepoužívám</b>. Kód od výboru jsem zadala jednou a od té doby mi dům prostě chodí do telefonu. O odstávce vody jsem věděla dřív než dcera.“</div>
              <div className="who">
                <span className="ini">MK</span>
                <div><b>Marie Konečná</b>vlastnice · byt A-014</div>
                <span className="badge">A-014</span>
              </div>
            </div>
            <div className="l-tcard an" style={{ ['--d' as string]: '.16s' }}>
              <div className="q">„Kapající ventil jsem vyfotil <b>v neděli, ve čtvrtek byl vyměněný</b>. A celou dobu jsem v telefonu viděl, co se s tím děje — nikomu jsem nemusel volat.“</div>
              <div className="who">
                <span className="ini">TR</span>
                <div><b>Tomáš Růžička</b>nájemník · byt B-112</div>
                <span className="badge">B-112</span>
              </div>
            </div>
            <div className="l-note">Rezidenti pilotního domu, jména a byty se souhlasem. Čísla jsou z provozu, ne z prezentace.</div>
          </div>
        </div>
        <div className="l-cta-bar an">
          <div className="t">Chcete to vidět naživo? Ukážeme vám aplikaci přímo na datech Vista Parku.</div>
          <button className="l-btn l-primary l-sm" onClick={() => go('kontakt')}>Chci ukázku zdarma</button>
        </div>
      </section>

      {/* 06 pricing: one card, guarantee inside */}
      <section className="l-sec" id="cenik">
        <div style={{ textAlign: 'center' }}>
          <div className="l-num">06 · Ceník</div>
          <h2 className="an">Jedna cena, všechno v ní</h2>
          <p className="l-sub" style={{ margin: '12px auto 0', maxWidth: '34em' }}>
            Žádné moduly, žádné příplatky, žádný ceník na tři stránky. Platíte jen za obsazené jednotky.
          </p>
        </div>
        <div className="l-price-card an">
          <span className="flag">Pilotní program 2026</span>
          <div className="l-price">
            <div className="v">{OFFER.pricePerUnit} Kč</div>
            <div className="u">/ jednotka / měsíc · vše v ceně</div>
          </div>
          <div className="l-price-desc">
            Zhruba 13 Kč na byt a den. Méně, než dům platí za úklid schodiště, a ušetří výboru večery každý měsíc.
          </div>
          <div className="l-incl">
            <span><Chk />Oznámení s notifikacemi</span>
            <span><Chk />Předpisy, QR platby, upomínky</span>
            <span><Chk />Schůze a hlasování podle podílů</span>
            <span><Chk />Závady s fotkou a průběhem</span>
            <span><Chk />Dokumenty s právy podle rolí</span>
            <span><Chk />Služby Tasker s ověřenými pracovníky</span>
          </div>
          <div className="l-guar">
            <Glyph d={G.shield} size={18} stroke="#12901E" />
            <div>
              <b>Garance:</b> prvních {OFFER.freeMonths} zdarma, bez karty a bez závazku. Nastavení do {OFFER.launch} uděláme my.
              Když se dům nechytne, zrušíte to jednou zprávou a data vám vyexportujeme a smažeme.
            </div>
          </div>
          <button className="l-btn l-primary" style={{ width: '100%', marginTop: 20, padding: 14 }} onClick={() => go('kontakt')}>
            Chci ukázku zdarma
          </button>
        </div>
        <p className="l-under">
          Developer nebo investor? Portfolio a předání novostavby řešíme na míru —{' '}
          <button onClick={() => go('kontakt')}>domluvit podmínky</button>.
        </p>
        <p className="l-fine">Ceny jsou bez DPH. Domy do pilotního programu spouštíme postupně, ať má každý plnou podporu.</p>
      </section>

      {/* 07 faq: six questions, two columns */}
      <section className="l-sec" id="faq">
        <div className="l-num">07 · Časté dotazy</div>
        <h2 className="an">Na co se výbory ptají, než řeknou ano</h2>
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
          Otázka na cenu je zodpovězená v <button onClick={() => go('cenik')}>ceníku</button>, na konkurenci v sekci{' '}
          <button onClick={() => go('moat')}>Tohle nikdo jiný nemá</button>. Cokoliv dalšího:{' '}
          <a href={'mailto:' + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      {/* closing CTA: green band with the lead form */}
      <section className="l-close" id="kontakt">
        <div className="l-close-in">
          <div>
            <h2 className="an">Pošlete kontakt, zbytek zařídíme</h2>
            <p className="l-sub">
              Do 24 hodin v pracovní dny se ozveme a ukážeme vám aplikaci na skutečném domě.
              Když dává smysl, do {OFFER.launch} spustíme tu vaši.
            </p>
            <div className="l-close-steps an">
              <div><i>1</i><span><b>Krátký hovor</b> — projdeme váš dům a co vás pálí, 15 minut</span></div>
              <div><i>2</i><span><b>Ukázka na živém domě</b> — aplikace tak, jak běží v pilotu</span></div>
              <div><i>3</i><span><b>Spuštění do {OFFER.launch}</b> — pošlete jednotky, my připravíme dům a kódy</span></div>
            </div>
            <p className="l-close-mail">Nebo rovnou: <a href={'mailto:' + CONTACT_EMAIL}>{CONTACT_EMAIL}</a></p>
          </div>

          <div className="l-form an" style={{ ['--d' as string]: '.1s' }}>
            {cState === 'done' ? (
              <div className="l-done">
                <span className="ic"><Chk w={22} /></span>
                <p><b>Děkujeme, jste v pořadí.</b><br />Ozveme se do 24 hodin v pracovní dny a domluvíme ukázku pro váš dům.</p>
              </div>
            ) : (
              <>
                <div className="l-f2">
                  <div className="l-field">
                    <label htmlFor="l-name">Jméno a příjmení</label>
                    <input id="l-name" value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Jan Novák" />
                  </div>
                  <div className="l-field">
                    <label htmlFor="l-phone">Telefon</label>
                    <input id="l-phone" value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="+420 ..." />
                  </div>
                </div>
                <div className="l-field" style={{ marginTop: 12 }}>
                  <label htmlFor="l-mail">E-mail</label>
                  <input id="l-mail" type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="vas@email.cz" />
                </div>
                <div className="l-field" style={{ marginTop: 12 }}>
                  <label htmlFor="l-size">Velikost domu</label>
                  <select id="l-size" value={cSize} onChange={(e) => setCSize(e.target.value)}>
                    <option>do 20 jednotek</option>
                    <option>20 až 50 jednotek</option>
                    <option>50 a více jednotek</option>
                    <option>více domů / portfolio</option>
                  </select>
                </div>
                <div className="l-field" style={{ marginTop: 12 }}>
                  <label htmlFor="l-msg">Zpráva (nepovinné)</label>
                  <textarea id="l-msg" rows={2} value={cMsg} onChange={(e) => setCMsg(e.target.value)} placeholder="Krátce o vašem domě a co vás pálí nejvíc..." />
                </div>
                {cState === 'err' && (
                  <p className="l-err">Vyplňte prosím jméno a e-mail. Pokud odeslání selhalo, napište nám přímo na {CONTACT_EMAIL}.</p>
                )}
                <button className="l-btn l-dark" onClick={sendContact} disabled={cState === 'busy'}>
                  {cState === 'busy' ? 'Odesílám...' : 'Chci ukázku zdarma'}
                </button>
                <p className="l-form-note">
                  Ozveme se do 24 hodin v pracovní dny. Žádný spam, žádné závazky. Odesláním souhlasíte se{' '}
                  <Link to="/ochrana-udaju">zpracováním údajů</Link>.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* footer: one row */}
      <footer className="l-foot">
        <div className="l-foot-in">
          <div className="l-foot-brand">
            <img src={mark} alt="" />
            <b>Tasker Living</b>
            <small>Součást Tasker</small>
          </div>
          <div className="l-foot-links">
            <button onClick={() => go('prohlidka')}>Prohlídka</button>
            <button onClick={() => go('cenik')}>Ceník</button>
            <a href="https://tasker.cz" target="_blank" rel="noreferrer">tasker.cz</a>
            <Link to="/ochrana-udaju">Ochrana údajů</Link>
            <Link to="/podminky">Podmínky</Link>
          </div>
          <span className="l-copy">© 2026 · Vyrobeno v Praze</span>
        </div>
      </footer>

      {/* 2b: sticky bottom CTA bar on mobile */}
      <div className={'l-sticky' + (sticky ? ' show' : '')}>
        <button className="l-btn l-ghost" onClick={enterDemo}>Demo</button>
        <button className="l-btn l-primary" onClick={() => go('kontakt')}>Ukázka zdarma</button>
      </div>
    </div>
  )
}
