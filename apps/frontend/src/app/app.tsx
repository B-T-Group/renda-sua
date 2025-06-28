// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import { useAuth0 } from '@auth0/auth0-react';
import { Box, Container } from '@mui/material';
import { useMemo } from 'react';
import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import UserProfile from '../components/auth/UserProfile';
import LoadingPage from '../components/common/LoadingPage';
import Header from '../components/layout/Header';
import CompleteProfile from '../components/pages/CompleteProfile';
import Dashboard from '../components/pages/Dashboard';
import LandingPage from '../components/pages/LandingPage';
import LoadingDemo from '../components/pages/LoadingDemo';

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
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <UserProfile />
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
          <Route path="/loading-demo" element={<LoadingDemo />} />
        </Routes>
      </Container>
    </Box>
  );
}

export default App;
