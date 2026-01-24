import { useAuth0 } from '@auth0/auth0-react';
import { Box, Container, useMediaQuery, useTheme } from '@mui/material';
import { useMemo } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import LoadingPage from '../components/common/LoadingPage';
import LoadingScreen from '../components/common/LoadingScreen';
import AgentBottomNav from '../components/layout/AgentBottomNav';
import ClientBottomNav from '../components/layout/ClientBottomNav';
import Footer from '../components/layout/Footer';
import Header from '../components/layout/Header';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import AboutUsPage from '../components/pages/AboutUsPage';
import AdminCommissionAccounts from '../components/pages/AdminCommissionAccounts';
import AdminConfigurationPage from '../components/pages/AdminConfigurationPage';
import AdminManageAgents from '../components/pages/AdminManageAgents';
import AdminManageBusinesses from '../components/pages/AdminManageBusinesses';
import AdminManageClients from '../components/pages/AdminManageClients';
import AdminUserDocumentsPage from '../components/pages/AdminUserDocumentsPage';
import AdminUserMessagesPage from '../components/pages/AdminUserMessagesPage';
import ApplicationSetupPage from '../components/pages/ApplicationSetupPage';
import AppRedirect from '../components/pages/AppRedirect';
import BrandsManagementPage from '../components/pages/BrandsManagementPage';
import BusinessItemsPage from '../components/pages/BusinessItemsPage';
import BusinessLocationsPage from '../components/pages/BusinessLocationsPage';
import CartPage from '../components/pages/CartPage';
import CategoriesManagementPage from '../components/pages/CategoriesManagementPage';
import CheckoutPage from '../components/pages/CheckoutPage';
import CompleteProfile from '../components/pages/CompleteProfile';
import { DocumentManagementPage } from '../components/pages/DocumentManagementPage';
import FailedDeliveriesPage from '../components/pages/FailedDeliveriesPage';
import ItemFormPage from '../components/pages/ItemFormPage';
import PrivacyPolicyPage from '../components/pages/PrivacyPolicyPage';
import TermsOfServicePage from '../components/pages/TermsOfServicePage';

import FAQ from '../components/pages/FAQ';
import ItemsPage from '../components/pages/ItemsPage';
import ItemViewPage from '../components/pages/ItemViewPage';
import LandingPage from '../components/pages/LandingPage';
import ManageOrderPage from '../components/pages/ManageOrderPage';
import { MessagesCenterPage } from '../components/pages/MessagesCenterPage';
import OpenOrdersPage from '../components/pages/OpenOrdersPage';
import OrderConfirmationPage from '../components/pages/OrderConfirmationPage';
import PlaceOrderPage from '../components/pages/PlaceOrderPage';
import Profile from '../components/pages/Profile';
import SupportPage from '../components/pages/SupportPage';
import SmartBatchOrders from '../components/routing/SmartBatchOrders';
import SmartDashboard from '../components/routing/SmartDashboard';
import SmartOrders from '../components/routing/SmartOrders';
import { useLoading } from '../contexts/LoadingContext';
import { useAgentLocationTracker } from '../hooks/useAgentLocationTracker';
import { useAuthFlow } from '../hooks/useAuthFlow';

function App() {
  const { isLoading } = useAuth0();
  const { isCheckingProfile } = useAuthFlow();
  const { isLoading: isApiLoading, loadingMessage } = useLoading();
  const location = useLocation();
  const { userType } = useUserProfileContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Determine if agent bottom nav should be visible
  const showAgentBottomNav = userType === 'agent' && isMobile;
  const showClientBottomNav = userType === 'client' && isMobile;

  // Initialize agent location tracking (runs automatically for agents)
  useAgentLocationTracker();

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

      <Box
        sx={{
          flex: 1,
          py: 4,
          // Add bottom padding when agent bottom nav is visible to prevent content overlap
          paddingBottom:
            showAgentBottomNav || showClientBottomNav
              ? { xs: '80px', md: 4 }
              : 4,
        }}
      >
        <Container
          maxWidth="xl"
          sx={{ px: { xs: 1.5, sm: 2, md: 3 } }}
        >
          <Routes>
            <Route path="/" element={<LandingPage />} />

            {/* Public routes */}
            <Route path="/items" element={<ItemsPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/about" element={<AboutUsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />

            {/* Cart route */}
            <Route
              path="/cart"
              element={
                <ProtectedRoute>
                  <CartPage />
                </ProtectedRoute>
              }
            />

            {/* Checkout route */}
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <CheckoutPage />
                </ProtectedRoute>
              }
            />

            {/* Place Order route */}
            <Route
              path="/items/:id/place_order"
              element={
                <ProtectedRoute>
                  <PlaceOrderPage />
                </ProtectedRoute>
              }
            />

            {/* Order Confirmation route */}
            <Route
              path="/orders/confirmation"
              element={
                <ProtectedRoute>
                  <OrderConfirmationPage />
                </ProtectedRoute>
              }
            />

            {/* App route - redirects to appropriate dashboard based on auth flow */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppRedirect />
                </ProtectedRoute>
              }
            />

            {/* Smart dashboard route */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <SmartDashboard />
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
            <Route
              path="/admin/configurations"
              element={
                <ProtectedRoute>
                  <AdminConfigurationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/application-setup"
              element={
                <ProtectedRoute>
                  <ApplicationSetupPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/commission-accounts"
              element={
                <ProtectedRoute>
                  <AdminCommissionAccounts />
                </ProtectedRoute>
              }
            />

            {/* Content Management routes */}
            <Route
              path="/content-management/brands"
              element={
                <ProtectedRoute>
                  <BrandsManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/content-management/categories"
              element={
                <ProtectedRoute>
                  <CategoriesManagementPage />
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

            {/* FAQ route */}
            <Route path="/faq" element={<FAQ />} />

            {/* Smart orders route */}
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <SmartOrders />
                </ProtectedRoute>
              }
            />

            {/* Batch orders route */}
            <Route
              path="/orders/batch"
              element={
                <ProtectedRoute>
                  <SmartBatchOrders />
                </ProtectedRoute>
              }
            />

            {/* Order Management route */}
            <Route
              path="/orders/:orderId"
              element={
                <ProtectedRoute>
                  <ManageOrderPage />
                </ProtectedRoute>
              }
            />

            {/* Open Orders route - for agents */}
            <Route
              path="/open-orders"
              element={
                <ProtectedRoute>
                  <OpenOrdersPage />
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
            <Route
              path="/business/failed-deliveries"
              element={
                <ProtectedRoute>
                  <FailedDeliveriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/failed-deliveries"
              element={
                <ProtectedRoute>
                  <FailedDeliveriesPage />
                </ProtectedRoute>
              }
            />

            {/* Item Form route - handles both add and edit */}
            <Route
              path="/business/items/add"
              element={
                <ProtectedRoute>
                  <ItemFormPage />
                </ProtectedRoute>
              }
            />

            {/* Edit Item route */}
            <Route
              path="/business/items/edit/:itemId"
              element={
                <ProtectedRoute>
                  <ItemFormPage />
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

      {/* Agent Bottom Navigation - Only visible for agents on mobile */}
      <AgentBottomNav />

      {/* Client Bottom Navigation - Only visible for clients on mobile */}
      <ClientBottomNav />

      {/* Global API Loading Screen */}
      <LoadingScreen open={isApiLoading} message={loadingMessage} />
    </Box>
  );
}

export default App;
