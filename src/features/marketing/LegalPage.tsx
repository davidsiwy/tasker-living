// Legal pages: privacy (GDPR), terms, cookies. Czech, written for the pilot.
// Placeholders in [brackets] must be filled with the operating company details.
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'

const OPERATOR = 'Tasker s.r.o. [doplňte přesný název, IČO a sídlo provozovatele]'
const CONTACT = 'info@tasker.cz'
const UPDATED = '15. 7. 2026'

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="lp">
      <nav className="nav">
        <div className="nav-in">
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="logo"><span className="mark"><span className="f f1" /><span className="f f2" /><span className="f f3" /><span className="w" /></span><div><b>Tasker Living</b><small>Součást Tasker</small></div></div>
          </Link>
          <Link to="/" className="btn btn-ghost" style={{ textDecoration: 'none' }}>Zpět na web</Link>
        </div>
      </nav>
      <div className="wrap" style={{ maxWidth: 780, margin: '0 auto' }}>
        <section className="band" style={{ borderTop: 'none' }}>
          <h1 style={{ fontSize: 'clamp(26px, 4vw, 38px)', marginBottom: 6 }}>{title}</h1>
          <p className="plans-note">Poslední aktualizace: {UPDATED}</p>
          <div className="legal" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--ink-2)', marginTop: 22 }}>
            {children}
          </div>
        </section>
      </div>
      <footer className="foot"><div className="wrap"><div className="foot-bar"><span>© 2026 Tasker Living. Součást rodiny Tasker.</span><span><Link to="/">taskerliving</Link></span></div></div></footer>
    </div>
  )
}

const H = ({ children }: { children: React.ReactNode }) => <h3 style={{ margin: '26px 0 8px', color: 'var(--ink-1, #12161d)' }}>{children}</h3>

export default function LegalPage({ page }: { page: 'privacy' | 'terms' | 'cookies' }) {
  if (page === 'privacy') {
    return (
      <Shell title="Zásady ochrany osobních údajů">
        <p>Tyto zásady popisují, jak aplikace a web Tasker Living nakládají s osobními údaji. Správcem osobních údajů je {OPERATOR}. Kontakt pro záležitosti ochrany údajů: {CONTACT}.</p>
        <H>Jaké údaje zpracováváme</H>
        <p>Při registraci do aplikace zpracováváme jméno a příjmení, e-mail, heslo (uložené výhradně v zabezpečené podobě), přiřazení k domu a jednotce a roli v domě. Dobrovolně můžete doplnit telefonní číslo pro adresář sousedů; jeho viditelnost pro sousedy si zapínáte a vypínáte sami. Při používání aplikace vznikají údaje o obsahu, který vytvoříte: příspěvky na nástěnce, komentáře, nahlášené závady včetně fotografií, zprávy sousedům, hlasování, stížnosti, objednávky služeb a platební předpisy. Z kontaktního formuláře na webu zpracováváme jméno, e-mail, telefon a obsah zprávy.</p>
        <H>Proč a na jakém základě</H>
        <p>Údaje zpracováváme pro poskytování služby (plnění smlouvy): provoz nástěnky, evidence závad, plateb, schůzí, hlasování a dalších funkcí domu. Stížnosti evidujeme k číslu bytu, nikoli ke jménu ohlašovatele, právě kvůli ochraně soukromí sousedů. Kontaktní formulář zpracováváme na základě vaší žádosti o nabídku (jednání o smlouvě). Provozní a bezpečnostní záznamy vedeme na základě oprávněného zájmu na zabezpečení služby.</p>
        <H>Kdo má k údajům přístup</H>
        <p>Data ukládáme u společnosti Supabase v datovém centru v Evropské unii (Frankfurt nad Mohanem, Německo). Obsah v rámci domu vidí pouze členové vašeho domu podle rolí a nastavení viditelnosti; přehled stížností vidí pouze výbor a správce. Provozovatel platformy má přístup pro technickou správu a podporu. Údaje nepředáváme třetím stranám pro marketing.</p>
        <H>Jak dlouho údaje uchováváme</H>
        <p>Údaje uchováváme po dobu trvání členství v domě a poté po dobu nezbytnou pro vypořádání právních povinností. Po odebrání z domu nebo smazání účtu obsah vázaný na účet mažeme nebo anonymizujeme, nejpozději do 30 dnů, s výjimkou záznamů, které je nutné uchovat ze zákona.</p>
        <H>Vaše práva</H>
        <p>Máte právo na přístup ke svým údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost a právo vznést námitku. Žádosti vyřizujeme na {CONTACT}. Máte také právo podat stížnost u Úřadu pro ochranu osobních údajů (uoou.gov.cz).</p>
        <H>Zabezpečení</H>
        <p>Přístup k datům je chráněn přihlášením a oprávněními na úrovni jednotlivých řádků databáze. Komunikace probíhá šifrovaně (HTTPS). Dokumenty domu se otevírají časově omezenými podepsanými odkazy.</p>
      </Shell>
    )
  }
  if (page === 'terms') {
    return (
      <Shell title="Podmínky užití">
        <p>Tyto podmínky upravují používání webu a aplikace Tasker Living, kterou provozuje {OPERATOR} (dále jen provozovatel).</p>
        <H>Služba</H>
        <p>Tasker Living je aplikace pro komunikaci a správu bytového domu: nástěnka, závady, platby, schůze a hlasování, dokumenty, kontakty a objednávání služeb Tasker. Přístup do domu získáváte přístupovým kódem od výboru, správce nebo developera. Za správnost údajů o domě, jednotkách a předpisech plateb odpovídá subjekt, který dům spravuje.</p>
        <H>Účet a pravidla chování</H>
        <p>Účet je osobní a jste odpovědní za ochranu svých přihlašovacích údajů. V aplikaci je zakázáno zveřejňovat obsah protiprávní, urážlivý nebo porušující práva třetích osob. Výbor a správce mohou nevhodný obsah odstranit a provozovatel může při závažném porušení účet zablokovat.</p>
        <H>Platby</H>
        <p>Aplikace zobrazuje platební předpisy a QR kódy pro platbu na účet domu, který nastavil výbor nebo správce. Provozovatel není stranou platebního vztahu mezi rezidentem a domem a nenese odpovědnost za správnost účtu zadaného správou domu. Objednávky služeb Tasker se řídí podmínkami platformy Tasker.</p>
        <H>Dostupnost a odpovědnost</H>
        <p>Službu poskytujeme tak, jak je. Vyvíjíme přiměřené úsilí o její dostupnost a zabezpečení, negarantujeme však nepřetržitý provoz. Provozovatel neodpovídá za škody vzniklé nesprávnými údaji vloženými uživateli ani za rozhodnutí učiněná na základě obsahu v aplikaci. Hlasování v aplikaci je podkladem pro rozhodování společenství; jeho právní účinky se řídí stanovami a zákonem.</p>
        <H>Změny podmínek</H>
        <p>Podmínky můžeme přiměřeně měnit; o podstatných změnách informujeme v aplikaci. Pokračováním v používání služby změny přijímáte. Tyto podmínky se řídí právem České republiky.</p>
      </Shell>
    )
  }
  return (
    <Shell title="Cookies">
      <p>Web a aplikace Tasker Living používají pouze technické uložení dat nezbytné pro fungování služby.</p>
      <H>Co ukládáme</H>
      <p>Po přihlášení ukládáme do úložiště prohlížeče přihlašovací relaci (token), aby zůstalo přihlášení zachované mezi návštěvami. Toto uložení je nezbytné pro fungování aplikace a nelze jej vypnout, dokud jste přihlášeni; smaže se odhlášením.</p>
      <H>Co neukládáme</H>
      <p>Nepoužíváme marketingové ani sledovací cookies třetích stran a nenasazujeme reklamní systémy. Pokud v budoucnu přidáme analytiku návštěvnosti, budeme o tom informovat zde a tam, kde to vyžaduje zákon, si vyžádáme souhlas.</p>
      <H>Kontakt</H>
      <p>S dotazy k soukromí se obraťte na {CONTACT}. Souvislosti zpracování osobních údajů popisují <Link to="/ochrana-udaju">zásady ochrany osobních údajů</Link>.</p>
      <p style={{ marginTop: 30 }}><Icon name="check" small /> Web funguje i bez jakéhokoliv souhlasu s cookies, žádný banner nepotřebujete odklikávat.</p>
    </Shell>
  )
}
