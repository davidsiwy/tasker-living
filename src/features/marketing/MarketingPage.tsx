import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'

// Marketing homepage. Static and SEO friendly in production. In app it doubles
// as the public front door before login.
export default function MarketingPage() {
  const nav = useNavigate()
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  const board = [
    { icon: 'water', t: 'Odstávka vody', s: 'Čtvrtek 8 až 12', tag: 'DŮM' },
    { icon: 'bank', t: 'Nájem spárován', s: 'Podle variabilního symbolu', tag: 'B-204' },
    { icon: 'sluzby', t: 'Úklid objednán', s: 'Marek H. přijede zítra', tag: 'B-205' },
    { icon: 'zavady', t: 'Výtah v řešení', s: 'Servis nahlášen dnes', tag: 'VCHOD C' },
  ]
  const features = [
    { i: 'nastenka', h: 'Nástěnka', p: 'Živý kanál domu. Oznámení, události a diskuze sousedů na jednom místě.' },
    { i: 'zavady', h: 'Závady', p: 'Nahlášení jedním klikem, stav v reálném čase a přiřazení technika.' },
    { i: 'najmy', h: 'Nájmy a platby', p: 'Platby spárované z banky podle variabilního symbolu, upomínky a výnosy.' },
    { i: 'sluzby', h: 'Služby Tasker', p: 'Ověřený pracovník na úklid, drobné opravy nebo mytí oken přímo do bytu.' },
    { i: 'schuze', h: 'Schůze a hlasování', p: 'Programy, účast, hlasování per rollam podle podílů a zápisy.' },
    { i: 'stiznosti', h: 'Stížnosti', p: 'Vedené na číslo bytu, ne na osobu. Navrženo s ohledem na GDPR.' },
    { i: 'doc', h: 'Dokumenty', p: 'Stanovy, zápisy, vyúčtování a revize vždy po ruce.' },
    { i: 'sprava', h: 'Správa domu', p: 'Kompletní přehled jednotek, financí, revizí a obyvatel pro výbor.' },
  ]
  const who = [
    { n: 'Rezident', h: 'Bydlím v domě', p: 'Nástěnka, závady, můj nájem, sousedé a služby Tasker na jednom místě.' },
    { n: 'Výbor SVJ', h: 'Spravuji dům', p: 'Oznámení, schůze, hlasování per rollam a přehled stížností po bytech.' },
    { n: 'Developer', h: 'Postavil jsem dům', p: 'Předání domu s aplikací a přehled nájmů i plateb napříč jednotkami.' },
    { n: 'Investor', h: 'Pronajímám byty', p: 'Nájemníci, platby spárované z banky a hlídání konců smluv.' },
  ]
  const steps = [
    { h: 'Napojíme váš dům', p: 'Jednotky, vlastníci a nájemníci naimportováni. Připraveno za pár dní.' },
    { h: 'Rezidenti se připojí kódem', p: 'Každý dostane přístup ke své jednotce a správné roli.' },
    { h: 'Vše běží v aplikaci', p: 'Nástěnka, závady, platby, schůze i služby na jednom místě.' },
    { h: 'Výbor má přehled', p: 'Kompletní správa domu, financí a revizí v reálném čase.' },
  ]
  const faqs = [
    { q: 'Splňuje aplikace zákonnou povinnost internetových stránek SVJ?', a: 'Ano. Výbor má vlastní zabezpečený prostor pro oznámení, dokumenty, zápisy a hlasování, což pokrývá povinnost zpřístupnit informace vlastníkům.' },
    { q: 'Jak funguje párování plateb?', a: 'Aplikace se napojí na bankovní účet přes Fio a příchozí platby automaticky spáruje s jednotkou podle variabilního symbolu. Nespárované platby označí k ručnímu přiřazení.' },
    { q: 'Jsou naše data v bezpečí?', a: 'Data jsou uložena v Evropské unii a chráněná přístupovými právy na úrovni jednotlivých rolí. Každý vidí jen to, co má.' },
    { q: 'Musí se registrovat všichni rezidenti?', a: 'Ne. Aplikace funguje i pro samotný výbor. Rezidenti se připojují postupně přístupovým kódem ke své jednotce.' },
    { q: 'Čím se lišíte od ostatních?', a: 'Jako jediní umíme přímo z aplikace poslat ověřeného pracovníka Tasker do bytu. Ostatní nabízejí jen evidenci.' },
    { q: 'Kolik to stojí?', a: 'Podle velikosti domu a zvoleného balíčku, viz ceník. U větších portfolií nebo novostaveb domluvíme podmínky na míru.' },
  ]

  return (
    <div className="lp">
      <nav className="nav">
        <div className="nav-in">
          <div className="logo"><span className="mark"><span className="f f1" /><span className="f f2" /><span className="f f3" /><span className="w" /></span><div><b>Tasker Living</b><small>Součást Tasker</small></div></div>
          <div className="nav-links">
            <a onClick={() => go('funkce')}>Funkce</a>
            <a onClick={() => go('prokoho')}>Pro koho</a>
            <a onClick={() => go('cenik')}>Ceník</a>
            <a onClick={() => go('faq')}>Časté dotazy</a>
          </div>
          <button className="btn btn-primary" onClick={() => nav('/prihlaseni')}>Otevřít aplikaci</button>
        </div>
      </nav>

      {/* hero */}
      <div className="wrap">
        <section className="hero">
          <div>
            <div className="eyebrow"><span className="dot" /> Celý dům v jedné aplikaci</div>
            <h1>Bydlení, správa a služby <em>na jednom místě</em></h1>
            <p className="sub" style={{ marginTop: 18 }}>Nástěnka, závady, platby a schůze pro rezidenty i výbor. A jako jediní umíme na pár kliknutí poslat ověřeného pracovníka Tasker přímo k vám do bytu.</p>
            <div className="cta-row" style={{ marginTop: 26 }}>
              <button className="btn btn-gold" onClick={() => nav('/prihlaseni')}>Vyzkoušet demo</button>
              <button className="btn btn-ghost" onClick={() => go('funkce')}>Prohlédnout funkce</button>
            </div>
            <div className="trust">
              <div><b>40</b>jednotek v pilotu</div>
              <div><b>9</b>modulů domu</div>
              <div><b>4</b>role, jedna aplikace</div>
            </div>
          </div>
          <aside className="board">
            <div className="board-h">
              <div><div className="board-k">Rezidence</div><b>Vista Park</b></div>
              <span className="pill pill-ok"><span className="dot" /> 40 jednotek</span>
            </div>
            {board.map((b) => (
              <div className="board-row" key={b.t}>
                <span className="cf-ic"><Icon name={b.icon} small /></span>
                <div className="br-main"><b>{b.t}</b><span>{b.s}</span></div>
                <span className="br-tag">{b.tag}</span>
              </div>
            ))}
          </aside>
        </section>
      </div>

      {/* trust strip */}
      <div className="wrap">
        <div className="trust-strip">
          <span className="trust-chip"><Icon name="check" small /> Součást rodiny Tasker</span>
          <span className="trust-chip"><Icon name="check" small /> Pilotní provoz: Rezidence Vista Park</span>
          <span className="trust-chip"><Icon name="check" small /> Data uložena v EU</span>
          <span className="trust-chip"><Icon name="check" small /> Splňuje povinnost webu SVJ</span>
        </div>
      </div>

      {/* features */}
      <div className="wrap" id="funkce">
        <section className="band" style={{ borderTop: 'none' }}>
          <div className="kicker">Funkce</div>
          <h2>Vše, co dům potřebuje, na jednom místě</h2>
          <p className="sub">Od každodenní komunikace po finance a zákonné povinnosti SVJ. Přehledně, v češtině a bez papírování.</p>
          <div className="feat">
            {features.map((f) => (
              <div className="feat-card" key={f.h}><div className="feat-ic"><Icon name={f.i} /></div><h3>{f.h}</h3><p>{f.p}</p></div>
            ))}
          </div>
        </section>
      </div>

      {/* moat: Tasker dispatch */}
      <div className="wrap">
        <section className="moat">
          <div className="m-copy">
            <div className="kicker">Co umíme navíc</div>
            <h2>Jako jediní pošleme pracovníka přímo k vám do bytu</h2>
            <p>Ostatní aplikace pro správu domů umí jen evidenci. Tasker Living navíc na pár kliknutí objedná ověřeného pracovníka z platformy Tasker. Úklid, drobná oprava, mytí oken, to vše bez shánění a bez telefonování.</p>
          </div>
          <div className="moat-points">
            <div className="moat-point"><span className="cf-ic"><Icon name="check" small /></span><div><b>Ověření pracovníci</b><span>Prověření a hodnocení profesionálové</span></div></div>
            <div className="moat-point"><span className="cf-ic"><Icon name="check" small /></span><div><b>Pojištěné služby</b><span>Každá objednávka je pojištěná</span></div></div>
            <div className="moat-point"><span className="cf-ic"><Icon name="check" small /></span><div><b>Vše v aplikaci</b><span>Objednání i sledování na jednom místě</span></div></div>
          </div>
        </section>
      </div>

      {/* how it works */}
      <div className="wrap" id="jaktofunguje">
        <section className="band">
          <div className="kicker">Jak to funguje</div>
          <h2>Spuštění za pár dní</h2>
          <div className="steps">
            {steps.map((s, i) => (
              <div className="step" key={s.h}><div className="step-num">{i + 1}</div><h4>{s.h}</h4><p>{s.p}</p></div>
            ))}
          </div>
        </section>
      </div>

      {/* roles */}
      <div className="wrap" id="prokoho">
        <section className="band">
          <div className="kicker">Pro koho</div>
          <h2>Čtyři role, jedna aplikace nad daty domu</h2>
          <div className="who">
            {who.map((w) => (
              <div className="who-card" key={w.n}><div className="n">{w.n}</div><h3>{w.h}</h3><p>{w.p}</p></div>
            ))}
          </div>
        </section>
      </div>

      {/* stats band */}
      <div className="wrap">
        <section className="band" style={{ borderTop: 'none', paddingTop: 20 }}>
          <div className="stats-band">
            <div className="stat-big"><div className="n"><em>4</em></div><div className="lbl">role v jedné aplikaci</div></div>
            <div className="stat-big"><div className="n"><em>9</em></div><div className="lbl">modulů správy domu</div></div>
            <div className="stat-big"><div className="n"><em>100%</em></div><div className="lbl">v souladu s povinností webu SVJ</div></div>
            <div className="stat-big"><div className="n"><em>EU</em></div><div className="lbl">data uložena v Evropě</div></div>
          </div>
        </section>
      </div>

      {/* pricing */}
      <div className="wrap" id="cenik">
        <section className="band">
          <div className="kicker">Ceník</div>
          <h2>Jednoduchý ceník podle velikosti domu</h2>
          <div className="plans">
            <div className="plan">
              <div className="ptop"><span className="pname">SVJ Základ</span></div>
              <div className="price">od 29 Kč <small>/ byt / měsíc</small></div>
              <div className="pdesc">Pro menší SVJ, které chce mít web a komunikaci v pořádku.</div>
              <ul>
                <li><Icon name="check" small /> Nástěnka a závady</li>
                <li><Icon name="check" small /> Schůze a hlasování</li>
                <li><Icon name="check" small /> Dokumenty a stížnosti</li>
                <li><Icon name="check" small /> Splňuje povinnost webu SVJ</li>
              </ul>
              <button className="btn btn-soft" onClick={() => nav('/prihlaseni')}>Vyzkoušet demo</button>
            </div>
            <div className="plan pop">
              <div className="ptop"><span className="pname">SVJ Plus</span><span className="pill pill-ok">Doporučeno</span></div>
              <div className="price">od 49 Kč <small>/ byt / měsíc</small></div>
              <div className="pdesc">Kompletní správa včetně financí a párování plateb z banky.</div>
              <ul>
                <li><Icon name="check" small /> Vše ze Základu</li>
                <li><Icon name="check" small /> Nájmy a párování plateb (Fio)</li>
                <li><Icon name="check" small /> Portfolio a reporty</li>
                <li><Icon name="check" small /> Přednostní podpora</li>
              </ul>
              <button className="btn btn-primary" onClick={() => nav('/prihlaseni')}>Vyzkoušet demo</button>
            </div>
            <div className="plan">
              <div className="ptop"><span className="pname">Developer a investor</span></div>
              <div className="price">Na míru</div>
              <div className="pdesc">Portfolio více domů a předání novostavby rezidentům s aplikací.</div>
              <ul>
                <li><Icon name="check" small /> Neomezený počet domů</li>
                <li><Icon name="check" small /> Předání domu rezidentům</li>
                <li><Icon name="check" small /> Integrace na míru</li>
                <li><Icon name="check" small /> Dedikovaný manažer</li>
              </ul>
              <button className="btn btn-ghost" onClick={() => go('faq')}>Domluvit ukázku</button>
            </div>
          </div>
          <p className="plans-note">Ceny jsou bez DPH. Konečnou cenu ladíme podle velikosti a potřeb domu.</p>
        </section>
      </div>

      {/* faq */}
      <div className="wrap" id="faq">
        <section className="band">
          <div className="kicker">Časté dotazy</div>
          <h2>Na co se ptají výbory nejčastěji</h2>
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

      {/* final CTA */}
      <div className="wrap">
        <section className="band" style={{ borderTop: 'none' }}>
          <div className="cta-band">
            <h2>Chcete Tasker Living na svém domě?</h2>
            <p>Vyzkoušejte si aplikaci v demu, nebo si domluvte ukázku pro váš dům a my se postaráme o zbytek.</p>
            <div className="cta-row">
              <button className="btn btn-gold" onClick={() => nav('/prihlaseni')}>Vyzkoušet demo</button>
              <button className="btn btn-ghost" onClick={() => go('faq')}>Domluvit ukázku</button>
            </div>
          </div>
        </section>
      </div>

      {/* footer */}
      <footer className="foot">
        <div className="wrap">
          <div className="foot-cols">
            <div>
              <div className="logo"><span className="mark"><span className="f f1" /><span className="f f2" /><span className="f f3" /><span className="w" /></span><div><b>Tasker Living</b><small>Součást Tasker</small></div></div>
              <p className="foot-blurb">Celý dům v jedné aplikaci. Nástěnka, správa, platby a ověřené služby Tasker pro rezidenty i výbor SVJ.</p>
            </div>
            <div className="foot-col"><h5>Produkt</h5><a onClick={() => go('funkce')}>Funkce</a><a onClick={() => go('prokoho')}>Pro koho</a><a onClick={() => go('cenik')}>Ceník</a><a onClick={() => nav('/prihlaseni')}>Přihlásit se</a></div>
            <div className="foot-col"><h5>Společnost</h5><a>O Tasker</a><a>Kontakt</a><a>Kariéra</a></div>
            <div className="foot-col"><h5>Právní</h5><a>Ochrana údajů</a><a>Podmínky</a><a>Cookies</a></div>
          </div>
          <div className="foot-bar"><span>© 2026 Tasker Living. Součást rodiny Tasker.</span><span>tasker.cz</span></div>
        </div>
      </footer>
    </div>
  )
}
