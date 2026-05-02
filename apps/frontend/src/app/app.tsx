import { useAuth0 } from '@auth0/auth0-react';
import { Box, Container, useMediaQuery, useTheme } from '@mui/material';
import { Suspense, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import * as LazyPages from './lazy-routes';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { DeferredFloatingWhatsApp } from '../components/common/DeferredFloatingWhatsApp';
import LoadingPage from '../components/common/LoadingPage';
import AgentOnboardingModal from '../components/dialogs/AgentOnboardingModal';
import AgentBottomNav from '../components/layout/AgentBottomNav';
import ClientBottomNav from '../components/layout/ClientBottomNav';
import Footer from '../components/layout/Footer';
import GuestBottomNav from '../components/layout/GuestBottomNav';
import Header from '../components/layout/Header';
import AppRedirect from '../components/pages/AppRedirect';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import { useAgentOnboarding } from '../hooks/useAgentOnboarding';

import SmartBatchOrders from '../components/routing/SmartBatchOrders';
import SmartDashboard from '../components/routing/SmartDashboard';
import SmartHome from '../components/routing/SmartHome';
import SmartOrders from '../components/routing/SmartOrders';
import { useAgentLocationTracker } from '../hooks/useAgentLocationTracker';
import { useAuthFlow } from '../hooks/useAuthFlow';
import { useDetectedCountry } from '../hooks/useDetectedCountry';
import { usePushSubscription } from '../hooks/usePushSubscription';

function RouteSuspenseFallback() {
  const { t } = useTranslation();
  return (
    <LoadingPage
      message={t('common.loadingRoute', 'Loading')}
      subtitle={t('common.loadingRouteSubtitle', 'Please wait')}
      showProgress={true}
    />
  );
}

function App() {
  const { isLoading } = useAuth0();
  const { isAuthenticated, isCheckingProfile } = useAuthFlow();
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
  const hasMobileBottomNav =
    showAgentBottomNav || showClientBottomNav || showGuestBottomNav;
  const whatsappBottomOffset = hasMobileBottomNav ? 92 : 24;
  const isItemDetailPage = /^\/items\/[^/]+\/?$/.test(location.pathname);
  const isPlaceOrderFlowPage = /^\/items\/[^/]+\/place_order(?:\/anon-address)?\/?$/.test(
    location.pathname
  );
  const shouldHideWhatsappWidget =
    isMobile && (isItemDetailPage || isPlaceOrderFlowPage);

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
          <Suspense fallback={<RouteSuspenseFallback />}>
            <Routes>
            <Route path="/" element={<SmartHome />} />
            <Route path="/who-we-are" element={<LazyPages.LandingPage />} />
            <Route
              path="/auth/login"
              element={<Navigate to="/" replace />}
            />
            <Route path="/auth/otp" element={<LazyPages.OtpAuthPage />} />
            <Route path="/signup" element={<LazyPages.SignupPage />} />

            {/* Public routes */}
            <Route
              path="/rentals/requests"
              element={
                <ProtectedRoute>
                  <LazyPages.ClientRentalRequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rentals/request-submitted"
              element={
                <ProtectedRoute>
                  <LazyPages.RentalRequestSubmittedPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rentals/bookings/:bookingId"
              element={
                <ProtectedRoute>
                  <LazyPages.RentalBookingDetailPage />
                </ProtectedRoute>
              }
            />
            <Route path="/rentals" element={<LazyPages.RentalsPage />} />
            <Route
              path="/rentals/:listingId"
              element={<LazyPages.RentalListingDetailPage />}
            />
            <Route path="/items" element={<LazyPages.ItemsPage />} />
            <Route path="/deals" element={<LazyPages.DealsPage />} />
            <Route path="/support" element={<LazyPages.SupportPage />} />
            <Route path="/about" element={<LazyPages.AboutUsPage />} />
            <Route
              path="/privacy"
              element={<LazyPages.PrivacyPolicyPage />}
            />
            <Route
              path="/terms"
              element={<LazyPages.TermsOfServicePage />}
            />

            {/* Cart route */}
            <Route
              path="/cart"
              element={
                <ProtectedRoute>
                  <LazyPages.CartPage />
                </ProtectedRoute>
              }
            />

            {/* Checkout route */}
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <LazyPages.CheckoutPage />
                </ProtectedRoute>
              }
            />

            {/* Place Order route */}
            <Route
              path="/items/:id/place_order"
              element={
                <ProtectedRoute>
                  <LazyPages.PlaceOrderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/items/:id/place_order/anon-address"
              element={
                <ProtectedRoute>
                  <LazyPages.AnonAddressPage />
                </ProtectedRoute>
              }
            />

            {/* Share / OG landing path on web origin (proxy to API in production) */}
            <Route
              path="/items/:id/seo"
              element={<LazyPages.ItemSeoShareRedirectPage />}
            />

            {/* Item detail (public) */}
            <Route path="/items/:id" element={<LazyPages.ItemDetailPage />} />

            {/* Order Confirmation route */}
            <Route
              path="/orders/confirmation"
              element={
                <ProtectedRoute>
                  <LazyPages.OrderConfirmationPage />
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
                  <LazyPages.AdminManageAgents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/clients"
              element={
                <ProtectedRoute>
                  <LazyPages.AdminManageClients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/businesses"
              element={
                <ProtectedRoute>
                  <LazyPages.AdminManageBusinesses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/rental-listings/moderation"
              element={
                <ProtectedRoute>
                  <LazyPages.AdminRentalListingsModerationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/configurations"
              element={
                <ProtectedRoute>
                  <LazyPages.AdminConfigurationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/application-setup"
              element={
                <ProtectedRoute>
                  <LazyPages.ApplicationSetupPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/country-onboarding"
              element={
                <ProtectedRoute>
                  <LazyPages.CountryOnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/commission-accounts"
              element={
                <ProtectedRoute>
                  <LazyPages.AdminCommissionAccounts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/pending-mobile-payments"
              element={
                <ProtectedRoute>
                  <LazyPages.AdminPendingMobilePaymentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/site-events"
              element={
                <ProtectedRoute>
                  <LazyPages.AdminSiteEventsPage />
                </ProtectedRoute>
              }
            />

            {/* Content Management routes */}
            <Route
              path="/content-management/brands"
              element={
                <ProtectedRoute>
                  <LazyPages.BrandsManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/content-management/categories"
              element={
                <ProtectedRoute>
                  <LazyPages.CategoriesManagementPage />
                </ProtectedRoute>
              }
            />

            {/* Profile management routes */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <LazyPages.Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/complete-profile"
              element={
                <ProtectedRoute>
                  <LazyPages.CompleteProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/select-persona"
              element={
                <ProtectedRoute>
                  <LazyPages.SelectPersonaPage />
                </ProtectedRoute>
              }
            />

            {/* FAQ route */}
            <Route path="/faq" element={<LazyPages.FAQ />} />

            {/* Support tickets - user's own tickets */}
            <Route
              path="/support/tickets"
              element={
                <ProtectedRoute>
                  <LazyPages.SupportTicketsPage />
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
                  <LazyPages.ManageOrderPage />
                </ProtectedRoute>
              }
            />

            {/* Open Orders route - for agents */}
            <Route
              path="/open-orders"
              element={
                <ProtectedRoute>
                  <LazyPages.AgentDashboard />
                </ProtectedRoute>
              }
            />

            {/* Business routes */}
            <Route
              path="/business/analytics"
              element={
                <ProtectedRoute>
                  <LazyPages.BusinessAnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/refunds"
              element={
                <ProtectedRoute>
                  <LazyPages.BusinessRefundRequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/locations"
              element={
                <ProtectedRoute>
                  <LazyPages.BusinessLocationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/items"
              element={
                <ProtectedRoute>
                  <LazyPages.BusinessItemsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/items/add-from-image"
              element={
                <ProtectedRoute>
                  <LazyPages.AddSaleItemFromImagePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/images"
              element={
                <ProtectedRoute>
                  <LazyPages.BusinessImagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/onboarding/first-sale-item"
              element={
                <ProtectedRoute>
                  <LazyPages.FirstSaleItemOnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/onboarding/add-rental-item"
              element={
                <ProtectedRoute>
                  <LazyPages.FirstRentalItemOnboardingPage />
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
                  <LazyPages.BusinessRentalsCatalogPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/rentals/requests"
              element={
                <ProtectedRoute>
                  <LazyPages.BusinessRentalsRequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/rentals/schedule"
              element={
                <ProtectedRoute>
                  <LazyPages.BusinessRentalsSchedulePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/rentals/items/:itemId"
              element={
                <ProtectedRoute>
                  <LazyPages.BusinessRentalItemViewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/rentals/items/:itemId/edit"
              element={
                <ProtectedRoute>
                  <LazyPages.BusinessRentalItemEditPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/rentals"
              element={
                <ProtectedRoute>
                  <LazyPages.BusinessRentalsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/rental-images"
              element={
                <ProtectedRoute>
                  <LazyPages.RentalItemImagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/failed-deliveries"
              element={
                <ProtectedRoute>
                  <LazyPages.FailedDeliveriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business/failed-deliveries"
              element={
                <ProtectedRoute>
                  <LazyPages.FailedDeliveriesPage />
                </ProtectedRoute>
              }
            />

            {/* Item Form route - handles both add and edit */}
            <Route
              path="/business/items/add"
              element={
                <ProtectedRoute>
                  <LazyPages.ItemFormPage />
                </ProtectedRoute>
              }
            />

            {/* Edit Item route */}
            <Route
              path="/business/items/edit/:itemId"
              element={
                <ProtectedRoute>
                  <LazyPages.ItemFormPage />
                </ProtectedRoute>
              }
            />

            {/* Item detail (after static /business/items/* paths) */}
            <Route
              path="/business/items/:itemId"
              element={
                <ProtectedRoute>
                  <LazyPages.ItemViewPage />
                </ProtectedRoute>
              }
            />

            {/* Document Management route */}
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <LazyPages.DocumentManagementPage />
                </ProtectedRoute>
              }
            />

            {/* Messages Center route */}
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <LazyPages.MessagesCenterPage />
                </ProtectedRoute>
              }
            />

            {/* Admin User Documents route */}
            <Route
              path="/admin/:userType/:userId/documents"
              element={
                <ProtectedRoute>
                  <LazyPages.AdminUserDocumentsPage />
                </ProtectedRoute>
              }
            />

            {/* Admin User Messages route */}
            <Route
              path="/admin/:userType/:userId/messages"
              element={
                <ProtectedRoute>
                  <LazyPages.AdminUserMessagesPage />
                </ProtectedRoute>
              }
            />

            {/* Unknown paths: same persona rules as home */}
            <Route path="*" element={<SmartHome />} />
          </Routes>
          </Suspense>
        </Container>
      </Box>

      <Footer />

      {/* Agent Bottom Navigation - Only visible for agents on mobile */}
      <AgentBottomNav />

      {/* Client Bottom Navigation - Only visible for clients on mobile */}
      <ClientBottomNav />

      {/* Guest Bottom Navigation - Only visible for unauthenticated users on mobile */}
      <GuestBottomNav />

      <DeferredFloatingWhatsApp
        whatsappBottomOffset={whatsappBottomOffset}
        hidden={shouldHideWhatsappWidget}
      />

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
