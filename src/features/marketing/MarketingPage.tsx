import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'

// Marketing entry. Front desk status board is the signature: the product is the
// digital version of a well run building. In production this becomes a static,
// SEO optimised site.
export default function MarketingPage() {
  const nav = useNavigate()
  const who = [
    { n: 'Rezident', h: 'Bydlím v domě', p: 'Nástěnka, závady, můj nájem, sousedé a služby Tasker na jednom místě.' },
    { n: 'Výbor SVJ', h: 'Spravuji dům', p: 'Oznámení, schůze, hlasování per rollam a přehled stížností po bytech.' },
    { n: 'Developer', h: 'Postavil jsem dům', p: 'Předání domu s aplikací a přehled nájmů i plateb napříč jednotkami.' },
    { n: 'Investor', h: 'Pronajímám byty', p: 'Nájemníci, platby spárované z banky a hlídání konců smluv.' },
  ]
  const board = [
    { icon: 'water', t: 'Odstávka vody', s: 'Čtvrtek 8 až 12', tag: 'DŮM' },
    { icon: 'bank', t: 'Nájem spárován', s: 'Podle variabilního symbolu', tag: 'B-204' },
    { icon: 'sluzby', t: 'Úklid objednán', s: 'Marek H. přijede zítra', tag: 'B-205' },
    { icon: 'zavady', t: 'Výtah v řešení', s: 'Servis nahlášen dnes', tag: 'VCHOD C' },
  ]
  return (
    <div className="lp">
      <nav className="nav">
        <div className="nav-in">
          <div className="logo"><span className="mark"><span className="f f1" /><span className="f f2" /><span className="f f3" /><span className="w" /></span><div><b>Tasker Living</b><small>Součást Tasker</small></div></div>
          <button className="btn btn-primary" onClick={() => nav('/prihlaseni')}>Otevřít aplikaci</button>
        </div>
      </nav>

      <div className="wrap">
        <section className="hero">
          <div>
            <div className="eyebrow"><span className="dot" /> Celý dům v jedné aplikaci</div>
            <h1>Bydlení, správa a služby <em>na jednom místě</em></h1>
            <p className="sub" style={{ marginTop: 18 }}>Nástěnka, závady, platby a schůze pro rezidenty i výbor. A jako jediní umíme na pár kliknutí poslat ověřeného pracovníka Tasker přímo k vám do bytu.</p>
            <div className="cta-row" style={{ marginTop: 26 }}>
              <button className="btn btn-gold" onClick={() => nav('/prihlaseni')}>Vyzkoušet demo</button>
              <button className="btn btn-ghost" onClick={() => nav('/prihlaseni')}>Přihlásit kódem</button>
            </div>
            <div className="trust">
              <div><b>40</b>jednotek v pilotu</div>
              <div><b>9</b>modulů domu</div>
              <div><b>1</b>aplikace pro čtyři role</div>
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

      <div className="wrap">
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

      <div style={{ background: 'var(--ink)', color: '#c6ccc0', padding: '28px 0', marginTop: 8 }}>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 11.5, letterSpacing: '.04em' }}>TASKER LIVING · SOUČÁST RODINY TASKER</span>
          <button className="btn btn-primary" onClick={() => nav('/prihlaseni')}>Otevřít aplikaci</button>
        </div>
      </div>
    </div>
  )
}
