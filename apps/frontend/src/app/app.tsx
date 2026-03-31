import { useAuth0 } from '@auth0/auth0-react';
import { Box, Container, useMediaQuery, useTheme } from '@mui/material';
import { useCallback, useEffect, useMemo } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import LoadingPage from '../components/common/LoadingPage';
import LoadingScreen from '../components/common/LoadingScreen';
import AgentOnboardingModal from '../components/dialogs/AgentOnboardingModal';
import AgentBottomNav from '../components/layout/AgentBottomNav';
import ClientBottomNav from '../components/layout/ClientBottomNav';
import Footer from '../components/layout/Footer';
import GuestBottomNav from '../components/layout/GuestBottomNav';
import Header from '../components/layout/Header';
import AboutUsPage from '../components/pages/AboutUsPage';
import AdminCommissionAccounts from '../components/pages/AdminCommissionAccounts';
import AdminConfigurationPage from '../components/pages/AdminConfigurationPage';
import AdminPendingMobilePaymentsPage from '../components/pages/AdminPendingMobilePaymentsPage';
import AdminManageAgents from '../components/pages/AdminManageAgents';
import AdminManageBusinesses from '../components/pages/AdminManageBusinesses';
import AdminManageClients from '../components/pages/AdminManageClients';
import AdminRentalListingsModerationPage from '../components/pages/AdminRentalListingsModerationPage';
import AdminUserDocumentsPage from '../components/pages/AdminUserDocumentsPage';
import AdminUserMessagesPage from '../components/pages/AdminUserMessagesPage';
import CountryOnboardingPage from '../components/pages/CountryOnboardingPage';
import ApplicationSetupPage from '../components/pages/ApplicationSetupPage';
import AppRedirect from '../components/pages/AppRedirect';
import BrandsManagementPage from '../components/pages/BrandsManagementPage';
import BusinessAnalyticsPage from '../components/pages/BusinessAnalyticsPage';
import BusinessImagesPage from '../components/pages/BusinessImagesPage';
import BusinessItemsPage from '../components/pages/BusinessItemsPage';
import BusinessLocationsPage from '../components/pages/BusinessLocationsPage';
import BusinessRentalItemEditPage from '../components/pages/BusinessRentalItemEditPage';
import BusinessRentalItemViewPage from '../components/pages/BusinessRentalItemViewPage';
import BusinessRentalsCatalogPage from '../components/pages/BusinessRentalsCatalogPage';
import BusinessRentalsPage from '../components/pages/BusinessRentalsPage';
import BusinessRentalsRequestsPage from '../components/pages/BusinessRentalsRequestsPage';
import BusinessRentalsSchedulePage from '../components/pages/BusinessRentalsSchedulePage';
import RentalItemImagesPage from '../components/pages/RentalItemImagesPage';
import CartPage from '../components/pages/CartPage';
import ClientRentalRequestsPage from '../components/pages/ClientRentalRequestsPage';
import RentalRequestSubmittedPage from '../components/pages/RentalRequestSubmittedPage';
import CategoriesManagementPage from '../components/pages/CategoriesManagementPage';
import CheckoutPage from '../components/pages/CheckoutPage';
import CompleteProfile from '../components/pages/CompleteProfile';
import SelectPersonaPage from '../components/pages/SelectPersonaPage';
import { DocumentManagementPage } from '../components/pages/DocumentManagementPage';
import FailedDeliveriesPage from '../components/pages/FailedDeliveriesPage';
import FirstRentalItemOnboardingPage from '../components/pages/FirstRentalItemOnboardingPage';
import AddSaleItemFromImagePage from '../components/pages/AddSaleItemFromImagePage';
import FirstSaleItemOnboardingPage from '../components/pages/FirstSaleItemOnboardingPage';
import ItemFormPage from '../components/pages/ItemFormPage';
import OtpAuthPage from '../components/pages/OtpAuthPage';
import PrivacyPolicyPage from '../components/pages/PrivacyPolicyPage';
import TermsOfServicePage from '../components/pages/TermsOfServicePage';
import SignupPage from '../components/pages/SignupPage';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import { useAgentOnboarding } from '../hooks/useAgentOnboarding';

import AgentDashboard from '../components/pages/AgentDashboard';
import FAQ from '../components/pages/FAQ';
import ItemDetailPage from '../components/pages/ItemDetailPage';
import RentalBookingDetailPage from '../components/pages/RentalBookingDetailPage';
import RentalListingDetailPage from '../components/pages/RentalListingDetailPage';
import RentalsPage from '../components/pages/RentalsPage';
import ItemsPage from '../components/pages/ItemsPage';
import ItemViewPage from '../components/pages/ItemViewPage';
import DealsPage from '../components/pages/DealsPage';
import LandingPage from '../components/pages/LandingPage';
import ManageOrderPage from '../components/pages/ManageOrderPage';
import { MessagesCenterPage } from '../components/pages/MessagesCenterPage';
import OrderConfirmationPage from '../components/pages/OrderConfirmationPage';
import PlaceOrderPage from '../components/pages/PlaceOrderPage';
import Profile from '../components/pages/Profile';
import SupportPage from '../components/pages/SupportPage';
import SupportTicketsPage from '../components/pages/SupportTicketsPage';
import SmartBatchOrders from '../components/routing/SmartBatchOrders';
import SmartDashboard from '../components/routing/SmartDashboard';
import SmartHome from '../components/routing/SmartHome';
import SmartOrders from '../components/routing/SmartOrders';
import { useLoading } from '../contexts/LoadingContext';
import { useAgentLocationTracker } from '../hooks/useAgentLocationTracker';
import { useAuthFlow } from '../hooks/useAuthFlow';
import { useDetectedCountry } from '../hooks/useDetectedCountry';
import { usePushSubscription } from '../hooks/usePushSubscription';

function App() {
  const { isLoading } = useAuth0();
  const { isAuthenticated, isCheckingProfile } = useAuthFlow();
  const { isLoading: isApiLoading, loadingMessage } = useLoading();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    userType,
    profile,
    refetch,
    needsPersonaSelection,
    isProfileComplete,
    loading: profileLoading,
  } = useUserProfileContext();
  const { completeOnboarding, loading: onboardingLoading } = useAgentOnboarding();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Check if agent needs to complete onboarding (global check)
  const agentNeedsOnboarding = useMemo((): boolean => {
    return Boolean(
      isAuthenticated &&
      userType === 'agent' &&
      profile?.agent &&
      profile.agent.onboarding_complete === false
    );
  }, [isAuthenticated, userType, profile]);

  // Handler for completing onboarding
  const handleOnboardingComplete = useCallback(async () => {
    const success = await completeOnboarding();
    if (success) {
      // Refetch profile to update onboarding_complete status
      await refetch();
    }
  }, [completeOnboarding, refetch]);

  // Determine which bottom nav should be visible (only one at a time)
  const showAgentBottomNav = userType === 'agent' && isMobile;
  const showClientBottomNav = userType === 'client' && isMobile;
  const showGuestBottomNav = !isAuthenticated && isMobile;

  // Initialize agent location tracking (runs automatically for agents)
  useAgentLocationTracker();

  // Sync push subscription to backend once when user is logged in (prompts for permission once if needed)
  const { syncWhenGranted } = usePushSubscription();
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setTimeout(() => syncWhenGranted(), 800);
    return () => clearTimeout(t);
  }, [isAuthenticated, syncWhenGranted]);

  // Detect and store country for anonymous users (for inventory-items country_code)
  useDetectedCountry();

  useEffect(() => {
    if (!isAuthenticated || profileLoading || isLoading) return;
    if (!isProfileComplete || !needsPersonaSelection) return;
    const path = location.pathname;
    if (path === '/select-persona' || path.startsWith('/select-persona/')) {
      return;
    }
    if (path === '/complete-profile' || path.startsWith('/complete-profile/')) {
      return;
    }
    navigate('/select-persona', { replace: true });
  }, [
    isAuthenticated,
    profileLoading,
    isLoading,
    isProfileComplete,
    needsPersonaSelection,
    location.pathname,
    navigate,
  ]);

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
          // Add bottom padding when any bottom nav is visible to prevent content overlap
          paddingBottom:
            showAgentBottomNav || showClientBottomNav || showGuestBottomNav
              ? { xs: '80px', md: 4 }
              : 4,
        }}
      >
        <Container
          maxWidth="xl"
          sx={{
            px:
              location.pathname === '/items' ||
              location.pathname.startsWith('/items/')
                ? { xs: 0.5, sm: 1 }
                : { xs: 1.5, sm: 2, md: 3 },
          }}
        >
          <Routes>
            <Route path="/" element={<SmartHome />} />
            <Route path="/who-we-are" element={<LandingPage />} />
            <Route
              path="/auth/login"
              element={<Navigate to="/" replace />}
            />
            <Route path="/auth/otp" element={<OtpAuthPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Public routes */}
            <Route
              path="/rentals/requests"
              element={
                <ProtectedRoute>
                  <ClientRentalRequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rentals/request-submitted"
              element={
                <ProtectedRoute>
                  <RentalRequestSubmittedPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rentals/bookings/:bookingId"
              element={
                <ProtectedRoute>
                  <RentalBookingDetailPage />
                </ProtectedRoute>
              }
            />
            <Route path="/rentals" element={<RentalsPage />} />
            <Route path="/rentals/:listingId" element={<RentalListingDetailPage />} />
            <Route path="/items" element={<ItemsPage />} />
            <Route path="/deals" element={<DealsPage />} />
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

            {/* Item detail (public) */}
            <Route path="/items/:id" element={<ItemDetailPage />} />

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
              path="/admin/rental-listings/moderation"
              element={
                <ProtectedRoute>
                  <AdminRentalListingsModerationPage />
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
              path="/admin/country-onboarding"
              element={
                <ProtectedRoute>
                  <CountryOnboardingPage />
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
            <Route
              path="/admin/pending-mobile-payments"
              element={
                <ProtectedRoute>
                  <AdminPendingMobilePaymentsPage />
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
            <Route
              path="/select-persona"
              element={
                <ProtectedRoute>
                  <SelectPersonaPage />
                </ProtectedRoute>
              }
            />

            {/* FAQ route */}
            <Route path="/faq" element={<FAQ />} />

            {/* Support tickets - user's own tickets */}
            <Route
              path="/support/tickets"
              element={
                <ProtectedRoute>
                  <SupportTicketsPage />
                </ProtectedRoute>
              }
            />

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
                  <AgentDashboard />
                </ProtectedRoute>
              }
            />

            {/* Business routes */}
            <Route
              path="/business/analytics"
              element={
                <ProtectedRoute>
                  <BusinessAnalyticsPage />
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
            <Route
              path="/business/items/add-from-image"
              element={
                <ProtectedRoute>
                  <AddSaleItemFromImagePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/images"
              element={
                <ProtectedRoute>
                  <BusinessImagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/onboarding/first-sale-item"
              element={
                <ProtectedRoute>
                  <FirstSaleItemOnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/onboarding/add-rental-item"
              element={
                <ProtectedRoute>
                  <FirstRentalItemOnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/onboarding/first-rental-item"
              element={<Navigate to="/business/onboarding/add-rental-item" replace />}
            />
            <Route
              path="/business/rentals/catalog"
              element={
                <ProtectedRoute>
                  <BusinessRentalsCatalogPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/rentals/requests"
              element={
                <ProtectedRoute>
                  <BusinessRentalsRequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/rentals/schedule"
              element={
                <ProtectedRoute>
                  <BusinessRentalsSchedulePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/rentals/items/:itemId"
              element={
                <ProtectedRoute>
                  <BusinessRentalItemViewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/rentals/items/:itemId/edit"
              element={
                <ProtectedRoute>
                  <BusinessRentalItemEditPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/rentals"
              element={
                <ProtectedRoute>
                  <BusinessRentalsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/rental-images"
              element={
                <ProtectedRoute>
                  <RentalItemImagesPage />
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

            {/* Item detail (after static /business/items/* paths) */}
            <Route
              path="/business/items/:itemId"
              element={
                <ProtectedRoute>
                  <ItemViewPage />
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

            {/* Unknown paths: same persona rules as home */}
            <Route path="*" element={<SmartHome />} />
          </Routes>
        </Container>
      </Box>

      <Footer />

      {/* Agent Bottom Navigation - Only visible for agents on mobile */}
      <AgentBottomNav />

      {/* Client Bottom Navigation - Only visible for clients on mobile */}
      <ClientBottomNav />

      {/* Guest Bottom Navigation - Only visible for unauthenticated users on mobile */}
      <GuestBottomNav />

      {/* Global API Loading Screen */}
      <LoadingScreen open={isApiLoading} message={loadingMessage} />

      {/* Agent Onboarding - Forces onboarding for agents who haven't completed it */}
      <AgentOnboardingModal
        open={agentNeedsOnboarding}
        onComplete={handleOnboardingComplete}
        loading={onboardingLoading}
      />
    </Box>
  );
}

export default App;
