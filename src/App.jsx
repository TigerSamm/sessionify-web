import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/Landing.jsx';
import LoginPage from './pages/Login.jsx';
import PortalHomePage from './pages/PortalHome.jsx';
import SessionBookingSetupPage from './pages/SessionBookingSetup.jsx';
import PublicBookingPage from './pages/PublicBookingPage.jsx';
import AccountPage from './pages/Account.jsx';
import OrganisationPage from './pages/Organisation.jsx';
import GoogleIntegrationPage from './pages/GoogleIntegration.jsx';
import HelpCenterPage from './pages/HelpCenter.jsx';
import SignupPage from './pages/Signup.jsx';
import { ThemeProvider } from './components/ThemeProvider.jsx';

const App = () => {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/help" element={<HelpCenterPage />} />
        <Route path="/app/login" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app/signup" element={<SignupPage />} />
        <Route path="/app" element={<PortalHomePage />} />
        <Route path="/app/booking" element={<SessionBookingSetupPage />} />
        <Route path="/app/account" element={<AccountPage />} />
        <Route path="/app/organisation" element={<OrganisationPage />} />
        <Route path="/app/google-int" element={<GoogleIntegrationPage />} />
        <Route path="/booking/:slug" element={<PublicBookingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
};

export default App;
