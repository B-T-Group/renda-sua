import { lazy } from 'react';

export const AboutUsPage = lazy(() => import('../components/pages/AboutUsPage'));
export const AdminCommissionAccounts = lazy(
  () => import('../components/pages/AdminCommissionAccounts')
);
export const AdminConfigurationPage = lazy(
  () => import('../components/pages/AdminConfigurationPage')
);
export const AdminPendingMobilePaymentsPage = lazy(
  () => import('../components/pages/AdminPendingMobilePaymentsPage')
);
export const AdminSiteEventsPage = lazy(
  () => import('../components/pages/AdminSiteEventsPage')
);
export const AdminManageAgents = lazy(
  () => import('../components/pages/AdminManageAgents')
);
export const AdminManageBusinesses = lazy(
  () => import('../components/pages/AdminManageBusinesses')
);
export const AdminManageClients = lazy(
  () => import('../components/pages/AdminManageClients')
);
export const AdminRentalListingsModerationPage = lazy(
  () => import('../components/pages/AdminRentalListingsModerationPage')
);
export const AdminUserDocumentsPage = lazy(
  () => import('../components/pages/AdminUserDocumentsPage')
);
export const AdminUserMessagesPage = lazy(
  () => import('../components/pages/AdminUserMessagesPage')
);
export const CountryOnboardingPage = lazy(
  () => import('../components/pages/CountryOnboardingPage')
);
export const ApplicationSetupPage = lazy(
  () => import('../components/pages/ApplicationSetupPage')
);
export const AppRedirect = lazy(() => import('../components/pages/AppRedirect'));
export const BrandsManagementPage = lazy(
  () => import('../components/pages/BrandsManagementPage')
);
export const BusinessAnalyticsPage = lazy(
  () => import('../components/pages/BusinessAnalyticsPage')
);
export const BusinessRefundRequestsPage = lazy(
  () => import('../components/pages/BusinessRefundRequestsPage')
);
export const BusinessImagesPage = lazy(
  () => import('../components/pages/BusinessImagesPage')
);
export const BusinessItemsPage = lazy(
  () => import('../components/pages/BusinessItemsPage')
);
export const BusinessLocationsPage = lazy(
  () => import('../components/pages/BusinessLocationsPage')
);
export const BusinessRentalItemEditPage = lazy(
  () => import('../components/pages/BusinessRentalItemEditPage')
);
export const BusinessRentalItemViewPage = lazy(
  () => import('../components/pages/BusinessRentalItemViewPage')
);
export const BusinessRentalsCatalogPage = lazy(
  () => import('../components/pages/BusinessRentalsCatalogPage')
);
export const BusinessRentalsPage = lazy(
  () => import('../components/pages/BusinessRentalsPage')
);
export const BusinessRentalsRequestsPage = lazy(
  () => import('../components/pages/BusinessRentalsRequestsPage')
);
export const BusinessRentalsSchedulePage = lazy(
  () => import('../components/pages/BusinessRentalsSchedulePage')
);
export const RentalItemImagesPage = lazy(
  () => import('../components/pages/RentalItemImagesPage')
);
export const CartPage = lazy(() => import('../components/pages/CartPage'));
export const ClientRentalRequestsPage = lazy(
  () => import('../components/pages/ClientRentalRequestsPage')
);
export const RentalRequestSubmittedPage = lazy(
  () => import('../components/pages/RentalRequestSubmittedPage')
);
export const CategoriesManagementPage = lazy(
  () => import('../components/pages/CategoriesManagementPage')
);
export const CheckoutPage = lazy(() => import('../components/pages/CheckoutPage'));
export const CompleteProfile = lazy(
  () => import('../components/pages/CompleteProfile')
);
export const SelectPersonaPage = lazy(
  () => import('../components/pages/SelectPersonaPage')
);
export const DocumentManagementPage = lazy(() =>
  import('../components/pages/DocumentManagementPage').then((m) => ({
    default: m.DocumentManagementPage,
  }))
);
export const FailedDeliveriesPage = lazy(
  () => import('../components/pages/FailedDeliveriesPage')
);
export const FirstRentalItemOnboardingPage = lazy(
  () => import('../components/pages/FirstRentalItemOnboardingPage')
);
export const AddSaleItemFromImagePage = lazy(
  () => import('../components/pages/AddSaleItemFromImagePage')
);
export const FirstSaleItemOnboardingPage = lazy(
  () => import('../components/pages/FirstSaleItemOnboardingPage')
);
export const ItemFormPage = lazy(() => import('../components/pages/ItemFormPage'));
export const OtpAuthPage = lazy(() => import('../components/pages/OtpAuthPage'));
export const PrivacyPolicyPage = lazy(
  () => import('../components/pages/PrivacyPolicyPage')
);
export const TermsOfServicePage = lazy(
  () => import('../components/pages/TermsOfServicePage')
);
export const SignupPage = lazy(() => import('../components/pages/SignupPage'));
export const AgentDashboard = lazy(() => import('../components/pages/AgentDashboard'));
export const FAQ = lazy(() => import('../components/pages/FAQ'));
export const ItemDetailPage = lazy(() => import('../components/pages/ItemDetailPage'));
export const ItemSeoShareRedirectPage = lazy(
  () => import('../components/pages/ItemSeoShareRedirectPage')
);
export const RentalBookingDetailPage = lazy(
  () => import('../components/pages/RentalBookingDetailPage')
);
export const RentalListingDetailPage = lazy(
  () => import('../components/pages/RentalListingDetailPage')
);
export const RentalsPage = lazy(() => import('../components/pages/RentalsPage'));
export const ItemsPage = lazy(() => import('../components/pages/ItemsPage'));
export const ItemViewPage = lazy(() => import('../components/pages/ItemViewPage'));
export const DealsPage = lazy(() => import('../components/pages/DealsPage'));
export const LandingPage = lazy(() => import('../components/pages/LandingPage'));
export const ManageOrderPage = lazy(
  () => import('../components/pages/ManageOrderPage')
);
export const MessagesCenterPage = lazy(() =>
  import('../components/pages/MessagesCenterPage').then((m) => ({
    default: m.MessagesCenterPage,
  }))
);
export const OrderConfirmationPage = lazy(
  () => import('../components/pages/OrderConfirmationPage')
);
export const AnonAddressPage = lazy(
  () => import('../components/pages/AnonAddressPage')
);
export const PlaceOrderPage = lazy(() => import('../components/pages/PlaceOrderPage'));
export const Profile = lazy(() => import('../components/pages/Profile'));
export const SupportPage = lazy(() => import('../components/pages/SupportPage'));
export const SupportTicketsPage = lazy(
  () => import('../components/pages/SupportTicketsPage')
);
export const SmartBatchOrders = lazy(
  () => import('../components/routing/SmartBatchOrders')
);
export const SmartDashboard = lazy(
  () => import('../components/routing/SmartDashboard')
);
export const SmartHome = lazy(() => import('../components/routing/SmartHome'));
export const SmartOrders = lazy(() => import('../components/routing/SmartOrders'));

export const FloatingWhatsApp = lazy(() =>
  import('@digicroz/react-floating-whatsapp').then((m) => ({
    default: m.FloatingWhatsApp,
  }))
);
