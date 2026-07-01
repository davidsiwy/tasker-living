import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireAuth } from './state/session'
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
import PlatformAdminPage from './features/platform/PlatformAdminPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MarketingPage />} />
      <Route path="/prihlaseni" element={<AuthPage />} />
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
        <Route path="operator" element={<PlatformAdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
