import { lazy, Suspense, useEffect, Component } from 'react'
import type { ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { RequireAuth, RequireOperator, PostLogin } from './state/session'
import AppShell from './components/AppShell'
import MarketingPage from './features/marketing/MarketingPage'
import AuthPage from './features/auth/AuthPage'
import CodePage from './features/auth/CodePage'
import ResetPage from './features/auth/ResetPage'
import FeedPage from './features/feed/FeedPage'
import FaultsPage from './features/faults/FaultsPage'
import RentPage from './features/rent/RentPage'
import ServicesPage from './features/services/ServicesPage'
import MeetingsPage from './features/meetings/MeetingsPage'
import ContactsPage from './features/contacts/ContactsPage'
import ComplaintsPage from './features/complaints/ComplaintsPage'
import AdminPage from './features/admin/AdminPage'
import SettingsPage from './features/settings/SettingsPage'

const OperatorShell = lazy(() => import('./features/platform/OperatorShell'))
const OverviewPage = lazy(() => import('./features/platform/OverviewPage'))
const ClientsPage = lazy(() => import('./features/platform/ClientsPage'))
const OrgsPages = lazy(() => import('./features/platform/OrgsPages').then((m) => ({ default: m.OrgsPage })))
const OrgDetail = lazy(() => import('./features/platform/OrgsPages').then((m) => ({ default: m.OrgDetailPage })))
const ActivityPage = lazy(() => import('./features/platform/ActivityOperatorsPages').then((m) => ({ default: m.ActivityPage })))
const OperatorsPage = lazy(() => import('./features/platform/ActivityOperatorsPages').then((m) => ({ default: m.OperatorsPage })))
const LegalPage = lazy(() => import('./features/marketing/LegalPage'))

const TITLES: Record<string, string> = {
  '/': 'Tasker Living, celý dům v jedné aplikaci',
  '/prihlaseni': 'Přihlášení · Tasker Living',
  '/kod': 'Připojit se k domu · Tasker Living',
  '/reset': 'Nové heslo · Tasker Living',
  '/ochrana-udaju': 'Ochrana osobních údajů · Tasker Living',
  '/podminky': 'Podmínky užití · Tasker Living',
  '/cookies': 'Cookies · Tasker Living',
}
function TitleSync() {
  const loc = useLocation()
  useEffect(() => {
    const base = TITLES[loc.pathname]
    document.title = base || (loc.pathname.startsWith('/operator') ? 'Operátor · Tasker Living' : loc.pathname.startsWith('/app') ? 'Tasker Living' : 'Tasker Living')
    window.scrollTo(0, 0)
  }, [loc.pathname])
  return null
}

class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() {
    if (this.state.err) {
      return (
        <div style={{ maxWidth: 460, margin: '18vh auto', textAlign: 'center', padding: 24 }}>
          <h2 style={{ marginBottom: 10 }}>Něco se pokazilo</h2>
          <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 18 }}>Omlouváme se, aplikace narazila na chybu. Zkuste stránku načíst znovu.</p>
          <button className="btn btn-primary" onClick={() => { this.setState({ err: null }); window.location.reload() }}>Načíst znovu</button>
        </div>
      )
    }
    return this.props.children
  }
}

const Fallback = () => <div style={{ padding: 40, color: 'var(--ink-3)' }}>Načítání...</div>

export default function App() {
  return (
    <ErrorBoundary>
      <TitleSync />
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/" element={<MarketingPage />} />
          <Route path="/prihlaseni" element={<AuthPage />} />
          <Route path="/kod" element={<CodePage />} />
          <Route path="/reset" element={<ResetPage />} />
          <Route path="/go" element={<PostLogin />} />
          <Route path="/ochrana-udaju" element={<LegalPage page="privacy" />} />
          <Route path="/podminky" element={<LegalPage page="terms" />} />
          <Route path="/cookies" element={<LegalPage page="cookies" />} />
          <Route path="/operator" element={<RequireOperator><OperatorShell /></RequireOperator>}>
            <Route index element={<OverviewPage />} />
            <Route path="klienti" element={<ClientsPage />} />
            <Route path="organizace" element={<OrgsPages />} />
            <Route path="organizace/:id" element={<OrgDetail />} />
            <Route path="aktivita" element={<ActivityPage />} />
            <Route path="operatori" element={<OperatorsPage />} />
          </Route>
          <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route index element={<Navigate to="nastenka" replace />} />
            <Route path="nastenka" element={<FeedPage />} />
            <Route path="zavady" element={<FaultsPage />} />
            <Route path="najmy" element={<RentPage />} />
            <Route path="sluzby" element={<ServicesPage />} />
            <Route path="schuze" element={<MeetingsPage />} />
            <Route path="kontakty" element={<ContactsPage />} />
            <Route path="stiznosti" element={<ComplaintsPage />} />
            <Route path="sprava" element={<AdminPage />} />
            <Route path="nastaveni" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
