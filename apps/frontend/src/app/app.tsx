// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import { useAuth0 } from '@auth0/auth0-react';
import { Box, Container } from '@mui/material';
import { useMemo } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import LoadingPage from '../components/common/LoadingPage';
import Header from '../components/layout/Header';
import AgentDashboard from '../components/pages/AgentDashboard';
import AppRedirect from '../components/pages/AppRedirect';
import BusinessDashboard from '../components/pages/BusinessDashboard';
import BusinessInventoryPage from '../components/pages/BusinessInventoryPage';
import BusinessItemsPage from '../components/pages/BusinessItemsPage';
import BusinessLocationsPage from '../components/pages/BusinessLocationsPage';
import BusinessOrdersPage from '../components/pages/BusinessOrdersPage';
import { ClientOrders } from '../components/pages/ClientOrders';
import CompleteProfile from '../components/pages/CompleteProfile';
import Dashboard from '../components/pages/Dashboard';
import ItemViewPage from '../components/pages/ItemViewPage';
import LandingPage from '../components/pages/LandingPage';
import LoadingDemo from '../components/pages/LoadingDemo';
import Profile from '../components/pages/Profile';
import PublicItemsPage from '../components/pages/PublicItemsPage';
import { useAuthFlow } from '../hooks/useAuthFlow';

function App() {
  const { isLoading } = useAuth0();
  const { isCheckingProfile } = useAuthFlow();
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
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          {/* Public routes */}
          <Route path="/items" element={<PublicItemsPage />} />

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
            path="/business/inventory"
            element={
              <ProtectedRoute>
                <BusinessInventoryPage />
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

          {/* Catch-all route - redirect to landing page */}
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </Container>
    </Box>
  );
}

export default App;
