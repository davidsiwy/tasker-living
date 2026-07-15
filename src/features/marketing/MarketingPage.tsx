import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { enterDemo } from '../../lib/supabase'

const CONTACT_EMAIL = 'info@tasker.cz'

// The offer. One place to tune the promise the ads and the page make.
const OFFER = {
  freeMonths: '2 měsíce',
  launch: '48 hodin',
  pricePerUnit: 399,
}

// Ads landing page. Built on three frameworks: Hormozi value equation (specific
// dream outcome, proof, minimal time and effort, risk reversal), Julian Shapiro
// (descriptive header, desire minus labor minus confusion, features answering
// objections) and Harry Dry (5 second test, every sentence visual, falsifiable
// and unique, repeat the CTA).
export default function MarketingPage() {
  const nav = useNavigate()
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  const [cName, setCName] = useState(''); const [cEmail, setCEmail] = useState(''); const [cPhone, setCPhone] = useState('')
  const [cSize, setCSize] = useState('do 20 jednotek'); const [cMsg, setCMsg] = useState('')
  const [cState, setCState] = useState<'idle' | 'busy' | 'done' | 'err'>('idle')
  const [navScrolled, setNavScrolled] = useState(false)
  const [showSticky, setShowSticky] = useState(false)

  // one passive scroll listener drives the nav shadow and the sticky CTA
  useEffect(() => {
    const onScroll = () => { setNavScrolled(window.scrollY > 8); setShowSticky(window.scrollY > 560) }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // scroll reveal: sections fade up as they enter. Content stays visible if JS fails.
  useEffect(() => {
    const root = document.querySelector('.lp')
    if (!root) return
    root.classList.add('anim-ready')
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' })
    root.querySelectorAll('.rv').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  // the board is alive: a new event slides in every few seconds
  const POOL = [
    { icon: 'nastenka', t: 'Odstávka vody ve čtvrtek', s: 'Oznámení dorazilo 38 sousedům', tag: 'DŮM' },
    { icon: 'bank', t: 'Nájem B-204 zaplacen', s: 'QR platba, potvrzeno správou', tag: 'B-204' },
    { icon: 'zavady', t: 'Výtah C: přiřazen servis', s: 'Ohlašovatel dostal notifikaci', tag: 'VCHOD C' },
    { icon: 'schuze', t: 'Hlasování: 62 % podílů pro', s: 'Usnášeníschopné, bez obcházení', tag: 'SCHŮZE' },
    { icon: 'sluzby', t: 'Úklid objednán na zítra', s: 'Marek H. potvrdil termín', tag: 'B-205' },
    { icon: 'doc', t: 'Nahrán zápis ze schůze', s: 'Viditelný pro všechny vlastníky', tag: 'DOKUMENTY' },
    { icon: 'stiznosti', t: 'Byt A-101 upozorněn', s: 'Jedním tlačítkem, bez konfliktu', tag: 'VÝBOR' },
    { icon: 'zavady', t: 'Světlo na chodbě svítí', s: 'Závada uzavřena, soused ví', tag: '3. PATRO' },
  ]
  const [live, setLive] = useState(() => POOL.slice(0, 4).map((r, i) => ({ ...r, id: i })))
  const nextRef = useRef(4)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const iv = setInterval(() => {
      setLive((s) => {
        const n = POOL[nextRef.current % POOL.length]
        nextRef.current += 1
        return [{ ...n, id: Date.now() }, ...s].slice(0, 4)
      })
    }, 4200)
    return () => clearInterval(iv)
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


  const pains = [
    {
      q: '„Vylepím to do vchodu a stejně polovina lidí řekne, že o ničem nevěděla.“',
      d: 'Papírek přelepí reklama na pizzu, e-mail skončí ve spamu a skupina na WhatsAppu má 14 členů ze 40 bytů.',
      f: 'Oznámení v aplikaci přijde každému jako notifikace do telefonu. Napíšete jednou, dorazí všem.',
    },
    {
      q: '„Zase kontroluju výpisy a píšu SMS, kdo nezaplatil zálohy.“',
      d: 'Tabulka v Excelu, výpis z banky vedle toho a večer strávený párováním plateb a psaním upomínek.',
      f: 'Aplikace vystaví předpisy, soused zaplatí QR kódem a upomínku pošlete jedním klikem.',
    },
    {
      q: '„Svoláme schůzi a nesejde se ani polovina podílů.“',
      d: 'Obcházení sousedů s papírem na podpis, plné moci po kapsách a rozhodnutí, které se odkládá půl roku.',
      f: 'Hlasování per rollam v telefonu, podíly i plné moci počítá aplikace. Zápis vygenerujete na klik.',
    },
  ]

  const features = [
    { i: 'nastenka', h: 'Oznámení, které si sousedé přečtou', p: 'Napíšete ho jednou a všem přijde notifikace do telefonu. Konec papírků ve vchodě a mailů ve spamu.' },
    { i: 'najmy', h: 'Nájmy a zálohy bez tabulek', p: 'Předpisy na klik, soused platí QR kódem na účet domu, vy jen potvrdíte. Neplatiče vidíte na jedné obrazovce.' },
    { i: 'zavady', h: 'Závady s fotkou místo lístečku', p: 'Soused vyfotí, vy přiřadíte dodavatele, on vidí průběh. Nikdo nevolá výboru v neděli večer.' },
    { i: 'schuze', h: 'Schůze, která se konečně sejde', p: 'Hlasování podle podílů, plné moci a zápis vygenerovaný z výsledků. Per rollam bez obcházení pater.' },
    { i: 'doc', h: 'Stanovy a zápisy k nalezení', p: 'Dokumenty domu na jednom místě, viditelnost podle rolí. Už žádné hledání v deset let staré poště.' },
    { i: 'stiznosti', h: 'Sousedské spory bez konfliktu', p: 'Stížnost se eviduje k bytu, ne ke jménu. Výbor upozorní jedním tlačítkem, sousedé se nehádají na chodbě.' },
  ]

  const steps = [
    { h: 'Pošlete nám seznam jednotek', p: 'Stačí čísla bytů a nájmy. Klidně vyfocená tabulka, zbytek uděláme my.' },
    { h: `Do ${OFFER.launch} máte dům připravený`, p: 'Nastavíme jednotky, platby i dokumenty a předáme vám přístupové kódy pro sousedy.' },
    { h: 'Rozdáte kódy a dům běží', p: 'Sousedé se připojí kódem ke svému bytu. První oznámení pošlete ještě ten den.' },
  ]

  const faqs = [
    { q: 'Co když sousedé žádnou aplikaci používat nechtějí?', a: 'Nemusí se připojit všichni a nemusí to být hned. Aplikace dává smysl už pro samotný výbor: předpisy, dokumenty, evidence závad. Sousedé se přidávají postupně, každé oznámení s notifikací je důvod navíc. V pilotním domě se většina připojila během prvních týdnů.' },
    { q: 'Jak dlouho trvá spuštění a co pro to musíme udělat?', a: `Pošlete seznam jednotek a nájmů, my do ${OFFER.launch} připravíme celý dům a přístupové kódy. Nic neinstalujete, aplikace běží v prohlížeči i jako ikona na ploše telefonu.` },
    { q: 'Jak fungují platby nájmů a záloh?', a: 'Výbor jedním tlačítkem vystaví měsíční předpisy. Soused zaplatí QR kódem přímo na účet domu, peníze vám nikdy neprocházejí přes nás. Platbu potvrdíte jedním klikem, upomínka je taky na klik. Automatické párování z banky připravujeme.' },
    { q: 'Pokrývá aplikace povinnost internetových stránek SVJ?', a: 'Výbor dostane zabezpečený prostor pro oznámení, dokumenty, zápisy a hlasování, tedy způsob, jak zpřístupnit informace vlastníkům podle stanov. Konkrétní požadavky vašich stanov s vámi rádi projdeme.' },
    { q: 'Jsou data domu v bezpečí a co s nimi, když skončíme?', a: 'Data jsou uložena v Evropské unii a chráněná právy podle rolí, každý vidí jen to, co má. Když skončíte, předáme vám export a data smažeme. Žádné držení dat jako rukojmí.' },
    { q: 'Musíme kvůli tomu měnit správce nebo účetnictví?', a: 'Ne. Tasker Living doplňuje správce o komunikaci, platby a hlasování, které dnes řešíte ručně. Účetnictví i technická správa zůstávají, jak jste zvyklí.' },
    { q: 'Čím se lišíte od ostatních aplikací pro SVJ?', a: 'Jako jediní pošleme přímo z aplikace ověřeného pracovníka Tasker do bytu: úklid, drobné opravy, mytí oken. Ostatní nabízejí evidenci, my i ruce, které to udělají.' },
    { q: 'Kolik to stojí a k čemu se zavazujeme?', a: `${OFFER.pricePerUnit} Kč za obsazenou jednotku měsíčně, vše v ceně, žádné moduly ani příplatky. Prvních ${OFFER.freeMonths} má celý dům zdarma, bez karty. Zrušíte kdykoliv jednou zprávou.` },
  ]

  const leadForm = (
    <div className="card">
      {cState === 'done' ? (
        <div className="empty"><span className="cf-ic"><Icon name="check" /></span><p><b>Děkujeme, jste v pořadí.</b> Ozveme se do 24 hodin v pracovní dny a domluvíme ukázku pro váš dům.</p></div>
      ) : (
        <>
          <div className="grid-2">
            <div className="field"><label>Jméno a příjmení</label><input className="input" value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Jan Novák" /></div>
            <div className="field"><label>E-mail</label><input className="input" type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="vas@email.cz" /></div>
          </div>
          <div className="grid-2">
            <div className="field"><label>Telefon</label><input className="input" value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="+420 ..." /></div>
            <div className="field"><label>Velikost domu</label>
              <select className="input" value={cSize} onChange={(e) => setCSize(e.target.value)}>
                <option>do 20 jednotek</option><option>20 až 50 jednotek</option><option>50 a více jednotek</option><option>více domů / portfolio</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Zpráva (nepovinné)</label><textarea className="input" rows={3} value={cMsg} onChange={(e) => setCMsg(e.target.value)} placeholder="Krátce o vašem domě a co vás pálí nejvíc..." /></div>
          {cState === 'err' && <p style={{ color: 'var(--bad)', fontSize: 13, marginBottom: 10 }}>Vyplňte prosím jméno a e-mail. Pokud odeslání selhalo, napište nám přímo na {CONTACT_EMAIL}.</p>}
          <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={sendContact} disabled={cState === 'busy'}>{cState === 'busy' ? 'Odesílám...' : 'Chci ukázku zdarma'}</button>
          <p className="plans-note" style={{ marginTop: 10 }}>Ozveme se do 24 hodin v pracovní dny. Žádný spam, žádné závazky. Odesláním souhlasíte se zpracováním údajů podle <Link to="/ochrana-udaju">zásad ochrany údajů</Link>.</p>
        </>
      )}
    </div>
  )

  return (
    <div className="lp">
      <nav className={'nav' + (navScrolled ? ' scrolled' : '')}>
        <div className="nav-in">
          <div className="logo"><span className="mark"><span className="f f1" /><span className="f f2" /><span className="f f3" /><span className="w" /></span><div><b>Tasker Living</b><small>Součást Tasker</small></div></div>
          <div className="nav-links">
            <a onClick={() => go('reseni')}>Co umí</a>
            <a onClick={() => go('jaktofunguje')}>Jak to funguje</a>
            <a onClick={() => go('cenik')}>Ceník</a>
            <a onClick={() => go('faq')}>Časté dotazy</a>
          </div>
          <button className="btn btn-primary" onClick={() => go('kontakt')}>Ukázka zdarma</button>
        </div>
      </nav>

      {/* hero: promise, how, visual, proof, next step */}
      <div className="wrap">
        <section className="hero">
          <div>
            <div className="eyebrow"><span className="dot" /> Aplikace pro bytové domy a SVJ</div>
            <h1>Celý dům v jedné aplikaci. <em>Konec papírků ve vchodě.</em></h1>
            <p className="sub" style={{ marginTop: 18 }}>Oznámení přijdou sousedům jako notifikace, nájmy se platí QR kódem, závady mají fotku a průběh a hlasování se konečně sejde. Pro výbor, rezidenty i developera. A jako jediní pošleme do bytu ověřeného pracovníka Tasker.</p>
            <div className="cta-row" style={{ marginTop: 26 }}>
              <button className="btn btn-gold" onClick={() => go('kontakt')}>Chci ukázku zdarma</button>
              <button className="btn btn-ghost" onClick={enterDemo}>Vyzkoušet demo hned</button>
            </div>
            <div className="risk-line">
              <span><Icon name="check" small /> Spuštění do {OFFER.launch}</span>
              <span><Icon name="check" small /> Prvních {OFFER.freeMonths} zdarma</span>
              <span><Icon name="check" small /> Zrušíte jednou zprávou</span>
            </div>
            <div className="trust">
              <div><b>40</b>jednotek v pilotu</div>
              <div><b>{OFFER.launch.split(' ')[0]} h</b>od podkladů ke spuštění</div>
              <div><b>0 Kč</b>za nastavení domu</div>
            </div>
          </div>
          <aside className="board-wrap">
            <div className="board">
              <div className="board-h">
                <div><div className="board-k">Rezidence</div><b>Vista Park</b></div>
                <span className="pill pill-ok"><span className="dot dot-pulse" /> Živě</span>
              </div>
              {live.map((b) => (
                <div className="board-row" key={b.id}>
                  <span className="cf-ic"><Icon name={b.icon} small /></span>
                  <div className="br-main"><b>{b.t}</b><span>{b.s}</span></div>
                  <span className="br-tag">{b.tag}</span>
                </div>
              ))}
            </div>
            <div className="float-card">
              <span className="cf-ic"><Icon name="bank" small /></span>
              <div><b>QR platba přijata</b><span>24 500 Kč · nájem B-204</span></div>
            </div>
          </aside>
        </section>
      </div>

      {/* social proof strip */}
      <div className="wrap">
        <div className="trust-strip rv">
          <span className="trust-chip"><Icon name="check" small /> Součást rodiny Tasker</span>
          <span className="trust-chip"><Icon name="check" small /> Pilotní provoz: Rezidence Vista Park, Praha 5</span>
          <span className="trust-chip"><Icon name="check" small /> Data uložena v EU</span>
          <span className="trust-chip"><Icon name="check" small /> Pokrývá povinnost webu SVJ</span>
        </div>
      </div>

      {/* problem: agitate what today looks like */}
      <div className="wrap">
        <section className="band rv" style={{ borderTop: 'none' }}>
          <div className="kicker">Poznáváte to?</div>
          <h2>Takhle dnes vypadá správa většiny domů</h2>
          <p className="sub">Výbor to dělá po večerech a zadarmo. Nástroje k tomu má z roku 2005: nástěnku, Excel a trpělivost.</p>
          <div className="pains rv">
            {pains.map((p) => (
              <div className="pain-card" key={p.q}>
                <div className="p-quote">{p.q}</div>
                <div className="p-detail">{p.d}</div>
                <div className="pain-flip"><Icon name="check" small /><span>{p.f}</span></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* solution: benefits answering objections */}
      <div className="wrap" id="reseni">
        <section className="band rv">
          <div className="kicker">Co Tasker Living umí</div>
          <h2>Šest věcí, které přestanete řešit ručně</h2>
          <p className="sub">Každá funkce šetří konkrétní večer výboru. Žádné moduly navíc, všechno je v ceně od prvního dne.</p>
          <div className="feat rv">
            {features.map((f) => (
              <div className="feat-card" key={f.h}><div className="feat-ic"><Icon name={f.i} /></div><h3>{f.h}</h3><p>{f.p}</p></div>
            ))}
          </div>
        </section>
      </div>

      {/* moat */}
      <div className="wrap">
        <section className="moat rv">
          <div className="m-copy">
            <div className="kicker">Tohle nikdo jiný nemá</div>
            <h2>Pošleme do bytu i ruce, které to udělají</h2>
            <p>Ostatní aplikace pro domy končí u evidence. Tasker Living stojí na platformě Tasker, takže soused na pár kliknutí objedná ověřeného pracovníka: úklid, drobnou opravu, mytí oken. Bez shánění, bez telefonování, s hodnocením.</p>
          </div>
          <div className="moat-points">
            <div className="moat-point"><span className="cf-ic"><Icon name="check" small /></span><div><b>Ověření pracovníci</b><span>Prověření profesionálové s hodnocením</span></div></div>
            <div className="moat-point"><span className="cf-ic"><Icon name="check" small /></span><div><b>Objednávka z aplikace</b><span>Dvě kliknutí, termín potvrdí dispečink</span></div></div>
            <div className="moat-point"><span className="cf-ic"><Icon name="check" small /></span><div><b>Bonus pro váš dům</b><span>Rezidenti mají služby po ruce, dům je atraktivnější</span></div></div>
          </div>
        </section>
      </div>

      {/* how it works: minimize time and effort */}
      <div className="wrap" id="jaktofunguje">
        <section className="band rv">
          <div className="kicker">Jak to funguje</div>
          <h2>Vy pošlete tabulku, my uděláme zbytek</h2>
          <p className="sub">Žádná instalace, žádná migrace, žádné školení na půl dne. Nastavení domu je naše práce, ne vaše.</p>
          <div className="steps rv">
            {steps.map((s, i) => (
              <div className="step" key={s.h}><div className="step-num">{i + 1}</div><h4>{s.h}</h4><p>{s.p}</p></div>
            ))}
          </div>
        </section>
      </div>

      {/* founder note: proof and likelihood */}
      <div className="wrap">
        <section className="band rv" style={{ borderTop: 'none', paddingTop: 10 }}>
          <div className="founder">
            <div className="f-ava">DS</div>
            <div>
              <blockquote>„Tasker Living jsme nepostavili od stolu. Stavíme a spravujeme vlastní rezidenci se 40 jednotkami a přesně tyhle věci nás štvaly: papírky, výpisy, schůze, které se nesejdou. Tak jsme si udělali nástroj, který bychom sami chtěli, a teď ho dáváme dalším domům. Každý dům spouštím osobně.“</blockquote>
              <div className="f-sig"><b>David Siwy</b>, zakladatel Tasker Living · developer Rezidence Vista Park · zakladatel platformy Tasker</div>
            </div>
          </div>
        </section>
      </div>

      {/* pricing with offer and risk reversal */}
      <div className="wrap" id="cenik">
        <section className="band rv">
          <div className="kicker">Ceník</div>
          <h2>Jedna cena, všechno v ní</h2>
          <p className="sub">Žádné moduly, žádné příplatky, žádný ceník na tři stránky. Platíte jen za obsazené jednotky.</p>
          <div className="plans plans-2 rv">
            <div className="plan pop">
              <span className="pop-badge">Pilotní program 2026</span>
              <div className="ptop"><span className="pname">Tasker Living</span><span className="pill pill-ok">Vše v ceně</span></div>
              <div className="price">{OFFER.pricePerUnit} Kč <small>/ jednotka / měsíc</small></div>
              <div className="pdesc">Zhruba 13 Kč na byt a den. Méně, než dům platí za úklid schodiště, a ušetří výboru večery každý měsíc.</div>
              <ul>
                <li><Icon name="check" small /> Nástěnka s notifikacemi, závady, stížnosti</li>
                <li><Icon name="check" small /> Předpisy, QR platby na účet domu, upomínky</li>
                <li><Icon name="check" small /> Schůze, hlasování podle podílů, zápisy</li>
                <li><Icon name="check" small /> Dokumenty domu s právy podle rolí</li>
                <li><Icon name="check" small /> Služby Tasker s ověřenými pracovníky</li>
                <li><Icon name="check" small /> Nastavení domu a podpora v ceně</li>
              </ul>
              <button className="btn btn-primary" onClick={() => go('kontakt')}>Chci ukázku zdarma</button>
            </div>
            <div className="plan">
              <div className="ptop"><span className="pname">Developer a investor</span></div>
              <div className="price">Na míru</div>
              <div className="pdesc">Portfolio více domů a předání novostavby rezidentům s hotovou aplikací místo šanonu.</div>
              <ul>
                <li><Icon name="check" small /> Neomezený počet domů</li>
                <li><Icon name="check" small /> Předání domu rezidentům</li>
                <li><Icon name="check" small /> Přehled nájmů napříč portfoliem</li>
                <li><Icon name="check" small /> Dedikovaný kontakt</li>
              </ul>
              <button className="btn btn-ghost" onClick={() => go('kontakt')}>Domluvit podmínky</button>
            </div>
          </div>
          <div className="offer-box">
            <div className="o-h"><Icon name="check" small /> Garance pro váš dům</div>
            <p>Prvních {OFFER.freeMonths} má celý dům zdarma, bez karty a bez závazku. Nastavení uděláme my do {OFFER.launch}. Když se dům nechytne, zrušíte to jednou zprávou, data vám vyexportujeme a smažeme. Nemáte co ztratit, jen večery, které správa domu žere teď.</p>
          </div>
          <p className="plans-note">Ceny jsou bez DPH. Domy do pilotního programu spouštíme postupně, ať má každý plnou podporu.</p>
        </section>
      </div>

      {/* faq: tie up loose ends */}
      <div className="wrap" id="faq">
        <section className="band rv">
          <div className="kicker">Časté dotazy</div>
          <h2>Na co se výbory ptají, než řeknou ano</h2>
          <div className="faq-wrap">
            {faqs.map((f) => (
              <details className="faq-item" key={f.q}>
                <summary>{f.q}<span className="faq-ic"><Icon name="plus" small /></span></summary>
                <div className="faq-a">{f.a}</div>
              </details>
            ))}
          </div>
        </section>
      </div>

      {/* final CTA + lead form */}
      <div className="wrap" id="kontakt">
        <section className="band rv">
          <div className="kicker">Ukázka zdarma</div>
          <h2>Pošlete kontakt, zbytek zařídíme</h2>
          <p className="sub">Do 24 hodin v pracovní dny se ozveme, ukážeme vám aplikaci na skutečném domě a když dává smysl, do {OFFER.launch} spustíme tu vaši. Prvních {OFFER.freeMonths} zdarma.</p>
          <div className="grid-2" style={{ marginTop: 26, alignItems: 'start' }}>
            {leadForm}
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="card">
                <div className="card-h"><h3>Co bude dál</h3></div>
                <div className="doc-row"><span className="cf-ic"><Icon name="msg" small /></span><div><b>1. Krátký hovor</b><span>Projdeme váš dům a co vás pálí, 15 minut</span></div></div>
                <div className="doc-row"><span className="cf-ic"><Icon name="nastenka" small /></span><div><b>2. Ukázka na živém domě</b><span>Uvidíte aplikaci tak, jak běží v pilotu</span></div></div>
                <div className="doc-row"><span className="cf-ic"><Icon name="check" small /></span><div><b>3. Spuštění do {OFFER.launch}</b><span>Pošlete jednotky, my připravíme dům a kódy</span></div></div>
              </div>
              <div className="card">
                <div className="card-h"><h3>Přímý kontakt</h3></div>
                <div className="doc-row"><span className="cf-ic"><Icon name="msg" small /></span><div><b>E-mail</b><span><a href={'mailto:' + CONTACT_EMAIL}>{CONTACT_EMAIL}</a></span></div></div>
                <div className="doc-row"><span className="cf-ic"><Icon name="check" small /></span><div><b>Součást Tasker</b><span><a href="https://tasker.cz" target="_blank" rel="noreferrer">tasker.cz</a></span></div></div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* footer */}
      <footer className="foot">
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <div className="logo"><span className="mark"><span className="f f1" /><span className="f f2" /><span className="f f3" /><span className="w" /></span><div><b>Tasker Living</b><small>Součást Tasker</small></div></div>
              <p className="foot-p">Celý dům v jedné aplikaci. Komunikace, platby, schůze a služby pro rezidenty, výbor SVJ, developery i investory.</p>
            </div>
            <div className="foot-col"><h5>Produkt</h5><a onClick={() => go('reseni')}>Co umí</a><a onClick={() => go('cenik')}>Ceník</a><a onClick={enterDemo}>Demo</a></div>
            <div className="foot-col"><h5>Společnost</h5><a href="https://tasker.cz" target="_blank" rel="noreferrer">O Tasker</a><a onClick={() => go('kontakt')}>Kontakt</a><a href={'mailto:' + CONTACT_EMAIL}>Napište nám</a></div>
            <div className="foot-col"><h5>Právní</h5><Link to="/ochrana-udaju">Ochrana údajů</Link><Link to="/podminky">Podmínky</Link><Link to="/cookies">Cookies</Link></div>
          </div>
          <div className="foot-bar"><span>© 2026 Tasker Living. Součást rodiny Tasker.</span><span>Vyrobeno v Praze</span></div>
        </div>
      </footer>

      {/* sticky mobile CTA for ad traffic */}
      <div className={'sticky-cta' + (showSticky ? ' show' : '')}>
        <button className="btn btn-ghost" onClick={enterDemo}>Demo</button>
        <button className="btn btn-gold" onClick={() => go('kontakt')}>Ukázka zdarma</button>
      </div>
    </div>
  )
}
