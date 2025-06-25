// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, Container } from '@mui/material';
import { useAuth0 } from '@auth0/auth0-react';

import Header from '../components/layout/Header';
import LandingPage from '../components/pages/LandingPage';
import Dashboard from '../components/pages/Dashboard';
import UserProfile from '../components/auth/UserProfile';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import LoadingPage from '../components/common/LoadingPage';
import LoadingDemo from '../components/pages/LoadingDemo';
import CompleteProfile from '../components/pages/CompleteProfile';
import { useLoginFlow } from '../hooks/useLoginFlow';

function App() {
  const { isAuthenticated, isLoading } = useAuth0();
  const { isCheckingProfile } = useLoginFlow();

  // Show loading page while Auth0 is loading or while checking user profile
  if (isLoading || isCheckingProfile) {
    return (
      <LoadingPage 
        message={isCheckingProfile ? "Checking Profile" : "Loading Rendasua"}
        subtitle={isCheckingProfile ? "Verifying your account information" : "Please wait while we authenticate your session"}
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
