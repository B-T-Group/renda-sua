// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import { useAuth0 } from '@auth0/auth0-react';
import { Box, Container } from '@mui/material';
import { useMemo } from 'react';
import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import LoadingPage from '../components/common/LoadingPage';
import Header from '../components/layout/Header';
import AgentDashboard from '../components/pages/AgentDashboard';
import BusinessDashboard from '../components/pages/BusinessDashboard';
import { ClientOrders } from '../components/pages/ClientOrders';
import CompleteProfile from '../components/pages/CompleteProfile';
import Dashboard from '../components/pages/Dashboard';
import ItemViewPage from '../components/pages/ItemViewPage';
import LandingPage from '../components/pages/LandingPage';
import LoadingDemo from '../components/pages/LoadingDemo';
import Profile from '../components/pages/Profile';
import ProfileRouter from '../components/routing/ProfileRouter';

function App() {
  const { isLoading } = useAuth0();

  // Memoize the loading state to prevent unnecessary re-renders
  const shouldShowLoading = useMemo(() => {
    return isLoading;
  }, [isLoading]);

  // Show loading page while Auth0 is loading
  if (shouldShowLoading) {
    return (
      <LoadingPage
        message="Loading Rendasua"
        subtitle="Please wait while we authenticate your session"
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

          {/* Profile router - handles authentication and profile checking */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <ProfileRouter />
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

          {/* Catch-all route - redirect to profile router */}
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <ProfileRouter />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Container>
    </Box>
  );
}

export default App;
