// Legal pages: privacy (GDPR), terms, cookies. Czech is the legally
// authoritative version (see legal:translationNotice, shown on EN/DE only) —
// per product decision, translated now but Czech governs on any conflict.
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import logo from '../../assets/logo-sm.png'

const OPERATOR = 'Tasker s.r.o. [doplňte přesný název, IČO a sídlo provozovatele]'
const CONTACT = 'info@tasker.cz'
const UPDATED = '15. 7. 2026'

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const { t, i18n } = useTranslation('legal')
  return (
    <div className="lp">
      <nav className="nav">
        <div className="nav-in">
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="logo"><img className="l-logo" src={logo} alt="Tasker Living" /><small>Součást Tasker</small></div>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LanguageSwitcher />
            <Link to="/" className="btn btn-ghost" style={{ textDecoration: 'none' }}>{t('backToSite')}</Link>
          </div>
        </div>
      </nav>
      <div className="wrap" style={{ maxWidth: 780, margin: '0 auto' }}>
        <section className="band" style={{ borderTop: 'none' }}>
          <h1 style={{ fontSize: 'clamp(26px, 4vw, 38px)', marginBottom: 6 }}>{title}</h1>
          <p className="plans-note">{t('updated', { date: UPDATED })}</p>
          {i18n.resolvedLanguage !== 'cs' && (
            <p style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--ink-2)', marginTop: 14 }}>
              {t('translationNotice')}
            </p>
          )}
          <div className="legal" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--ink-2)', marginTop: 22 }}>
            {children}
          </div>
        </section>
      </div>
      <footer className="foot"><div className="wrap"><div className="foot-bar"><span>{t('footer')}</span><span><Link to="/">taskerliving</Link></span></div></div></footer>
    </div>
  )
}

const H = ({ children }: { children: React.ReactNode }) => <h3 style={{ margin: '26px 0 8px', color: 'var(--ink-1, #12161d)' }}>{children}</h3>

export default function LegalPage({ page }: { page: 'privacy' | 'terms' | 'cookies' }) {
  const { t } = useTranslation('legal')

  if (page === 'privacy') {
    return (
      <Shell title={t('privacy.title')}>
        <p>{t('privacy.intro', { operator: OPERATOR, contact: CONTACT })}</p>
        <H>{t('privacy.h1')}</H><p>{t('privacy.p1')}</p>
        <H>{t('privacy.h2')}</H><p>{t('privacy.p2')}</p>
        <H>{t('privacy.h3')}</H><p>{t('privacy.p3')}</p>
        <H>{t('privacy.h4')}</H><p>{t('privacy.p4')}</p>
        <H>{t('privacy.h5')}</H><p>{t('privacy.p5')}</p>
        <H>{t('privacy.h6')}</H><p>{t('privacy.p6')}</p>
      </Shell>
    )
  }
  if (page === 'terms') {
    return (
      <Shell title={t('terms.title')}>
        <p>{t('terms.intro', { operator: OPERATOR })}</p>
        <H>{t('terms.h1')}</H><p>{t('terms.p1')}</p>
        <H>{t('terms.h2')}</H><p>{t('terms.p2')}</p>
        <H>{t('terms.h3')}</H><p>{t('terms.p3')}</p>
        <H>{t('terms.h4')}</H><p>{t('terms.p4')}</p>
        <H>{t('terms.h5')}</H><p>{t('terms.p5')}</p>
      </Shell>
    )
  }
  return (
    <Shell title={t('cookies.title')}>
      <p>{t('cookies.intro')}</p>
      <H>{t('cookies.h1')}</H><p>{t('cookies.p1')}</p>
      <H>{t('cookies.h2')}</H><p>{t('cookies.p2')}</p>
      <H>{t('cookies.h3')}</H>
      <p>{t('cookies.p3', { contact: CONTACT })} <Link to="/ochrana-udaju">{t('cookies.p3link')}</Link>.</p>
      <p style={{ marginTop: 30 }}><Icon name="check" small /> {t('cookies.noBanner')}</p>
    </Shell>
  )
}
