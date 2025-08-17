// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import { useAuth0 } from '@auth0/auth0-react';
import { Box, Container } from '@mui/material';
import { useMemo } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import EmailVerificationNotice from '../components/auth/EmailVerificationNotice';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import LoadingPage from '../components/common/LoadingPage';
import LoadingScreen from '../components/common/LoadingScreen';
import Footer from '../components/layout/Footer';
import Header from '../components/layout/Header';
import AddItemPage from '../components/pages/AddItemPage';
import AdminManageAgents from '../components/pages/AdminManageAgents';
import AdminManageBusinesses from '../components/pages/AdminManageBusinesses';
import AdminManageClients from '../components/pages/AdminManageClients';
import AdminUserDocumentsPage from '../components/pages/AdminUserDocumentsPage';
import AdminUserMessagesPage from '../components/pages/AdminUserMessagesPage';
import AgentDashboard from '../components/pages/AgentDashboard';
import AppRedirect from '../components/pages/AppRedirect';
import BusinessDashboard from '../components/pages/BusinessDashboard';
import BusinessItemsPage from '../components/pages/BusinessItemsPage';
import BusinessLocationsPage from '../components/pages/BusinessLocationsPage';
import BusinessOrdersPage from '../components/pages/BusinessOrdersPage';
import ClientOrders from '../components/pages/ClientOrders';
import CompleteProfile from '../components/pages/CompleteProfile';
import Dashboard from '../components/pages/Dashboard';
import { DocumentManagementPage } from '../components/pages/DocumentManagementPage';
import EditItemPage from '../components/pages/EditItemPage';
import FAQ from '../components/pages/FAQ';
import ItemViewPage from '../components/pages/ItemViewPage';
import LandingPage from '../components/pages/LandingPage';
import LoadingDemo from '../components/pages/LoadingDemo';
import { MessagesCenterPage } from '../components/pages/MessagesCenterPage';
import Profile from '../components/pages/Profile';
import PublicItemsPage from '../components/pages/PublicItemsPage';
import SupportPage from '../components/pages/SupportPage';
import { useLoading } from '../contexts/LoadingContext';
import { useAuthFlow } from '../hooks/useAuthFlow';

function App() {
  const { isLoading } = useAuth0();
  const { isCheckingProfile } = useAuthFlow();
  const { isLoading: isApiLoading, loadingMessage } = useLoading();
  const location = useLocation();

  // Only show loading for auth flow when on /app route
  const shouldShowLoading = useMemo(() => {
    if (location.pathname === '/app') {
      return isLoading || isCheckingProfile;
    }
    return isLoading;
  }, [isLoading, isCheckingProfile, location.pathname]);

  // Show loading page while Auth0 is loading or checking profile
  if (shouldShowLoading) {
    return (
      <LoadingPage
        message={isCheckingProfile ? 'Checking Profile' : 'Loading Rendasua'}
        subtitle={
          isCheckingProfile
            ? 'Verifying your account information'
            : 'Please wait while we authenticate your session'
        }
        showProgress={true}
      />
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Header />
      <EmailVerificationNotice />
      <Box sx={{ flex: 1, py: 4 }}>
        <Container maxWidth="xl">
          <Routes>
            <Route path="/" element={<LandingPage />} />

            {/* Public routes */}
            <Route path="/items" element={<PublicItemsPage />} />
            <Route path="/support" element={<SupportPage />} />

            {/* App route - redirects to appropriate dashboard based on auth flow */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppRedirect />
                </ProtectedRoute>
              }
            />

            {/* Individual dashboard routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent-dashboard"
              element={
                <ProtectedRoute>
                  <AgentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business-dashboard"
              element={
                <ProtectedRoute>
                  <BusinessDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/agents"
              element={
                <ProtectedRoute>
                  <AdminManageAgents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/clients"
              element={
                <ProtectedRoute>
                  <AdminManageClients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/businesses"
              element={
                <ProtectedRoute>
                  <AdminManageBusinesses />
                </ProtectedRoute>
              }
            />

            {/* Profile management routes */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/complete-profile"
              element={
                <ProtectedRoute>
                  <CompleteProfile />
                </ProtectedRoute>
              }
            />

            {/* Demo route */}
            <Route path="/loading-demo" element={<LoadingDemo />} />

            {/* FAQ route */}
            <Route path="/faq" element={<FAQ />} />

            {/* Client Orders route */}
            <Route
              path="/client-orders"
              element={
                <ProtectedRoute>
                  <ClientOrders />
                </ProtectedRoute>
              }
            />

            {/* Item View route */}
            <Route
              path="/business/items/:itemId"
              element={
                <ProtectedRoute>
                  <ItemViewPage />
                </ProtectedRoute>
              }
            />

            {/* Business routes */}
            <Route
              path="/business/orders"
              element={
                <ProtectedRoute>
                  <BusinessOrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/locations"
              element={
                <ProtectedRoute>
                  <BusinessLocationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/items"
              element={
                <ProtectedRoute>
                  <BusinessItemsPage />
                </ProtectedRoute>
              }
            />

            {/* Add Item route */}
            <Route
              path="/business/items/add"
              element={
                <ProtectedRoute>
                  <AddItemPage />
                </ProtectedRoute>
              }
            />

            {/* Edit Item route */}
            <Route
              path="/business/items/edit/:itemId"
              element={
                <ProtectedRoute>
                  <EditItemPage />
                </ProtectedRoute>
              }
            />

            {/* Document Management route */}
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <DocumentManagementPage />
                </ProtectedRoute>
              }
            />

            {/* Messages Center route */}
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <MessagesCenterPage />
                </ProtectedRoute>
              }
            />

            {/* Admin User Documents route */}
            <Route
              path="/admin/:userType/:userId/documents"
              element={
                <ProtectedRoute>
                  <AdminUserDocumentsPage />
                </ProtectedRoute>
              }
            />

            {/* Admin User Messages route */}
            <Route
              path="/admin/:userType/:userId/messages"
              element={
                <ProtectedRoute>
                  <AdminUserMessagesPage />
                </ProtectedRoute>
              }
            />

            {/* Catch-all route - redirect to landing page */}
            <Route path="*" element={<LandingPage />} />
          </Routes>
        </Container>
      </Box>

      <Footer />

      {/* Global API Loading Screen */}
      <LoadingScreen open={isApiLoading} message={loadingMessage} />
    </Box>
  );
}

export default App;
