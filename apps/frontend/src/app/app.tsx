import { useAuth0 } from '@auth0/auth0-react';
import { Box, Container } from '@mui/material';
import { useMemo } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import AccountInformation from '../components/common/AccountInformation';
import LoadingPage from '../components/common/LoadingPage';
import LoadingScreen from '../components/common/LoadingScreen';
import Footer from '../components/layout/Footer';
import Header from '../components/layout/Header';
import AboutUsPage from '../components/pages/AboutUsPage';
import AdminConfigurationPage from '../components/pages/AdminConfigurationPage';
import AdminManageAgents from '../components/pages/AdminManageAgents';
import AdminManageBusinesses from '../components/pages/AdminManageBusinesses';
import AdminManageClients from '../components/pages/AdminManageClients';
import AdminUserDocumentsPage from '../components/pages/AdminUserDocumentsPage';
import AdminUserMessagesPage from '../components/pages/AdminUserMessagesPage';
import AppRedirect from '../components/pages/AppRedirect';
import BrandsManagementPage from '../components/pages/BrandsManagementPage';
import BusinessItemsPage from '../components/pages/BusinessItemsPage';
import BusinessLocationsPage from '../components/pages/BusinessLocationsPage';
import CartPage from '../components/pages/CartPage';
import CategoriesManagementPage from '../components/pages/CategoriesManagementPage';
import CheckoutPage from '../components/pages/CheckoutPage';
import CompleteProfile from '../components/pages/CompleteProfile';
import { DocumentManagementPage } from '../components/pages/DocumentManagementPage';
import ItemFormPage from '../components/pages/ItemFormPage';
import PrivacyPolicyPage from '../components/pages/PrivacyPolicyPage';
import TermsOfServicePage from '../components/pages/TermsOfServicePage';
import { useUserProfileContext } from '../contexts/UserProfileContext';

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
import SmartDashboard from '../components/routing/SmartDashboard';
import SmartOrders from '../components/routing/SmartOrders';
import { useLoading } from '../contexts/LoadingContext';
import { useAuthFlow } from '../hooks/useAuthFlow';

function App() {
  const { isLoading, isAuthenticated } = useAuth0();
  const { isCheckingProfile } = useAuthFlow();
  const { isLoading: isApiLoading, loadingMessage } = useLoading();
  const { userType } = useUserProfileContext();
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
      {/* Global Account Information for authenticated users (excluding clients and business) */}
      {isAuthenticated && userType !== 'client' && userType !== 'business' && (
        <AccountInformation
          onRefresh={undefined}
          compactView={false}
          showTransactions={true}
        />
      )}
      <Box sx={{ flex: 1, py: 4 }}>
        <Container maxWidth="xl">
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

      {/* Global API Loading Screen */}
      <LoadingScreen open={isApiLoading} message={loadingMessage} />
    </Box>
  );
}

export default App;
