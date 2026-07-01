import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireAuth, RequireOperator, PostLogin } from './state/session'
import AppShell from './components/AppShell'
import MarketingPage from './features/marketing/MarketingPage'
import AuthPage from './features/auth/AuthPage'
import FeedPage from './features/feed/FeedPage'
import FaultsPage from './features/faults/FaultsPage'
import RentPage from './features/rent/RentPage'
import ServicesPage from './features/services/ServicesPage'
import MeetingsPage from './features/meetings/MeetingsPage'
import ContactsPage from './features/contacts/ContactsPage'
import ComplaintsPage from './features/complaints/ComplaintsPage'
import AdminPage from './features/admin/AdminPage'
import SettingsPage from './features/settings/SettingsPage'
import OperatorShell from './features/platform/OperatorShell'
import OverviewPage from './features/platform/OverviewPage'
import ClientsPage from './features/platform/ClientsPage'
import { OrgsPage, OrgDetailPage } from './features/platform/OrgsPages'
import { ActivityPage, OperatorsPage } from './features/platform/ActivityOperatorsPages'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MarketingPage />} />
      <Route path="/prihlaseni" element={<AuthPage />} />
      <Route path="/go" element={<PostLogin />} />
      <Route path="/operator" element={<RequireOperator><OperatorShell /></RequireOperator>}>
        <Route index element={<OverviewPage />} />
        <Route path="klienti" element={<ClientsPage />} />
        <Route path="organizace" element={<OrgsPage />} />
        <Route path="organizace/:id" element={<OrgDetailPage />} />
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
  )
}
