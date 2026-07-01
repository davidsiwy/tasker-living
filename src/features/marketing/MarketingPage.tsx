import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'

// Compact marketing entry. The full landing page lives in the standalone
// prototype and in production becomes a static, SEO-optimised site.
export default function MarketingPage() {
  const nav = useNavigate()
  const who = [
    { n: 'Rezident', h: 'Bydlím v domě', p: 'Nástěnka, závady, můj nájem, sousedé a Tasker služby na jednom místě.' },
    { n: 'Výbor SVJ', h: 'Spravuji dům', p: 'Oznámení, schůze, hlasování per rollam a přehled stížností po bytech.' },
    { n: 'Developer', h: 'Postavil jsem dům', p: 'Předání domu s aplikací a přehled nájmů i plateb napříč jednotkami.' },
    { n: 'Investor', h: 'Pronajímám byty', p: 'Nájemníci, platby spárované z banky a hlídání konců smluv.' },
  ]
  return (
    <div>
      <nav style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
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
            <p className="sub" style={{ marginTop: 18 }}>Nástěnka, závady, platby a schůze pro rezidenty i výbor. A jako jediní umíme na pár kliknutí poslat ověřeného pracovníka Tasker přímo k vám.</p>
            <div className="cta-row" style={{ marginTop: 24 }}>
              <button className="btn btn-gold" onClick={() => nav('/prihlaseni')}>Vyzkoušet demo</button>
              <button className="btn btn-ghost" onClick={() => nav('/prihlaseni')}>Přihlásit kódem</button>
            </div>
          </div>
          <div className="stat" style={{ padding: 22 }}>
            <div className="card-h"><h3>Rezidence Vista Park</h3><span className="pill pill-ok"><span className="dot" /> 40 jednotek</span></div>
            <div className="doc-row"><span className="cf-ic"><Icon name="water" small /></span><div><b>Odstávka vody</b><span>Čtvrtek 8 až 12</span></div></div>
            <div className="doc-row"><span className="cf-ic"><Icon name="bank" small /></span><div><b>Nájem spárován</b><span>B-204, dle VS</span></div></div>
            <div className="doc-row"><span className="cf-ic"><Icon name="sluzby" small /></span><div><b>Úklid objednán</b><span>Marek H. přijede zítra</span></div></div>
          </div>
        </section>

        <section className="band">
          <div className="eyebrow"><span className="dot" /> Pro koho</div>
          <h2>Čtyři role, jedna aplikace nad daty domu</h2>
          <div className="grid-4" style={{ marginTop: 24 }}>
            {who.map((w) => (
              <div className="who-card" key={w.n}><div className="n">{w.n}</div><h3>{w.h}</h3><p>{w.p}</p></div>
            ))}
          </div>
        </section>
      </div>

      <div style={{ background: 'var(--green-900)', color: '#d7ddd0', padding: '26px 0' }}>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 12 }}>Tasker Living · Součást rodiny Tasker</span>
          <button className="btn btn-gold" onClick={() => nav('/prihlaseni')}>Otevřít aplikaci</button>
        </div>
      </div>
    </div>
  )
}
