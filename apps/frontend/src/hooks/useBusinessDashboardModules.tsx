import {
  AccountBalance as AccountBalanceIcon,
  Person as AgentIcon,
  TrendingUp as AnalyticsIcon,
  Business as BizIcon,
  Label as BrandIcon,
  Category as CategoryIcon,
  FactCheck as RentalModerationIcon,
  CalendarMonth as RentalCalendarIcon,
  Description as DocumentsIcon,
  Error as ErrorIcon,
  Inbox as RentalInboxIcon,
  Inventory2 as ItemsIcon,
  LocationOn as LocationsIcon,
  Assignment as OrdersIcon,
  Settings as SettingsIcon,
  Storefront as RentalCatalogIcon,
  Group as UsersIcon,
  Image as ImageIcon,
  Payments as PaymentsIcon,
  Public as PublicIcon,
  MoneyOff as RefundsIcon,
  AccountBalanceWallet as CashReconciliationIcon,
  MoreHoriz as MoreIcon,
} from '@mui/icons-material';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { BusinessDashboardModule } from '../components/business/BusinessDashboardModuleCard';
import type { DashboardAggregates } from './useDashboardAggregates';

interface UseBusinessDashboardModulesOptions {
  aggregates: DashboardAggregates | null;
  isRentalFocused: boolean;
}

export function useBusinessDashboardModules({
  aggregates,
  isRentalFocused,
}: UseBusinessDashboardModulesOptions) {
  const { t } = useTranslation();

  return useMemo(() => {
    const ordersTotalNonCancelled = aggregates?.ordersTotal ?? 0;
    const orderCountByStatus = aggregates?.ordersByStatus ?? {};
    const itemCount = aggregates?.itemCount ?? 0;
    const locationCount = aggregates?.locationCount ?? 0;
    const pendingFailedDeliveriesCount =
      aggregates?.pendingFailedDeliveriesCount ?? 0;
    const pendingCashReconciliationCount =
      aggregates?.pendingCashReconciliationCount ?? 0;

    const primaryOrderModules: BusinessDashboardModule[] = [
      {
        title: t('common.orders'),
        description: t('business.dashboard.ordersDescription'),
        icon: <OrdersIcon sx={{ fontSize: 40 }} />,
        count: ordersTotalNonCancelled,
        color: '#1976d2',
        path: '/orders',
        orderCountByStatus,
      },
      {
        title: t(
          'business.dashboard.cashReconciliationTitle',
          'Cash reconciliation'
        ),
        description: t(
          'business.dashboard.cashReconciliationDescription',
          'Orders completed with a cash exception—collect mobile payment to settle payouts.'
        ),
        icon: <CashReconciliationIcon sx={{ fontSize: 40 }} />,
        count: pendingCashReconciliationCount,
        color: '#ed6c02',
        path: '/orders?cashReconciliation=pending',
        showBadge: pendingCashReconciliationCount > 0,
      },
      {
        title: t('business.dashboard.failedDeliveries'),
        description: t('business.dashboard.failedDeliveriesDescription'),
        icon: <ErrorIcon sx={{ fontSize: 40 }} />,
        count: pendingFailedDeliveriesCount,
        color: '#d32f2f',
        path: '/business/failed-deliveries',
        showBadge: pendingFailedDeliveriesCount > 0,
      },
    ];

    const moreHubModule: BusinessDashboardModule = {
      title: t('common.more', 'More'),
      description: t(
        'business.dashboard.moreHubDescription',
        'Refund requests, batch orders, rentals, analytics, and more.'
      ),
      icon: <MoreIcon sx={{ fontSize: 40 }} />,
      count: null,
      color: '#616161',
      path: '/business/dashboard/more',
    };

    const primaryCatalogModules: BusinessDashboardModule[] = [
      {
        title: t('common.items'),
        description: t('business.dashboard.itemsDescription'),
        icon: <ItemsIcon sx={{ fontSize: 40 }} />,
        count: itemCount,
        color: '#7b1fa2',
        path: '/business/items',
      },
      {
        title: t('common.locations'),
        description: t('business.dashboard.locationsDescription'),
        icon: <LocationsIcon sx={{ fontSize: 40 }} />,
        count: locationCount,
        color: '#f57c00',
        path: '/business/locations',
      },
    ];

    const catalogMenuHubModule: BusinessDashboardModule = {
      title: t('business.dashboard.catalogMenuTitle', 'Catalog tools'),
      description: t(
        'business.dashboard.catalogMenuDescription',
        'Image libraries and bulk media tools.'
      ),
      icon: <MoreIcon sx={{ fontSize: 40 }} />,
      count: null,
      color: '#8e24aa',
      path: '/business/dashboard/catalog-menu',
    };

    const catalogMenuModules: BusinessDashboardModule[] = [
      {
        title: t('business.images.title', 'Item Images Library'),
        description: t(
          'business.images.subtitle',
          'Bulk upload, organize, and connect images to your items.'
        ),
        icon: <ImageIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#8e24aa',
        path: '/business/images',
      },
      {
        title: t(
          'business.rentalImages.dashboardTitle',
          'Rental image library'
        ),
        description: t(
          'business.rentalImages.dashboardDescription',
          'Upload rental photos, run AI cleanup, and link or create rental items.'
        ),
        icon: <ImageIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#00838f',
        path: '/business/rental-images',
      },
    ];

    const morePageOrderModules: BusinessDashboardModule[] = [
      {
        title: t('business.dashboard.batchOrdersTitle', 'Batch process orders'),
        description: t(
          'business.dashboard.batchOrdersDescription',
          'Quickly update the status of multiple orders at once'
        ),
        icon: <OrdersIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#1565c0',
        path: '/orders/batch',
      },
      {
        title: t('business.dashboard.refundsTitle', 'Refund requests'),
        description: t(
          'business.dashboard.refundsDescription',
          'Review and resolve client return and refund requests'
        ),
        icon: <RefundsIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#00897b',
        path: '/business/refunds',
      },
    ];

    const rentalModules: BusinessDashboardModule[] = [
      {
        title: t('business.dashboard.rentalCatalogModule', 'Rental catalog'),
        description: t(
          'business.dashboard.rentalCatalogModuleDescription',
          'Rental items, listings per location, preview and edit.'
        ),
        icon: <RentalCatalogIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#00695c',
        path: '/business/rentals/catalog',
      },
      {
        title: t('business.dashboard.rentalRequestsModule', 'Rental requests'),
        description: t(
          'business.dashboard.rentalRequestsModuleDescription',
          'Incoming client requests and responses.'
        ),
        icon: <RentalInboxIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#00796b',
        path: '/business/rentals/requests',
      },
      {
        title: t('business.dashboard.rentalScheduleModule', 'Rental schedule'),
        description: t(
          'business.dashboard.rentalScheduleModuleDescription',
          'Calendar of bookings by rental item.'
        ),
        icon: <RentalCalendarIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#004d40',
        path: '/business/rentals/schedule',
      },
    ];

    const insightModules: BusinessDashboardModule[] = [
      {
        title: t('common.analytics'),
        description: t('business.dashboard.analyticsDescription'),
        icon: <AnalyticsIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#c62828',
        path: '/business/analytics',
      },
      {
        title: t('business.dashboard.documents'),
        description: t('business.dashboard.documentsDescription'),
        icon: <DocumentsIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#795548',
        path: '/documents',
      },
    ];

    const agentsTotal =
      (aggregates?.agentsVerified ?? 0) + (aggregates?.agentsUnverified ?? 0);
    const businessesTotal =
      (aggregates?.businessesVerified ?? 0) +
      (aggregates?.businessesNotVerified ?? 0);

    const adminModules: BusinessDashboardModule[] = [
      {
        title: t('business.dashboard.manageAgents'),
        description: t('business.dashboard.manageAgentsDescription'),
        icon: <AgentIcon sx={{ fontSize: 40 }} />,
        count: agentsTotal > 0 ? agentsTotal : null,
        countBreakdown:
          agentsTotal > 0
            ? {
                verified: aggregates?.agentsVerified ?? 0,
                other: aggregates?.agentsUnverified ?? 0,
                otherLabel: t('business.dashboard.unverified', 'Unverified'),
              }
            : undefined,
        color: '#2e7d32',
        path: '/admin/agents',
      },
      {
        title: t('business.dashboard.manageClients'),
        description: t('business.dashboard.manageClientsDescription'),
        icon: <UsersIcon sx={{ fontSize: 40 }} />,
        count: aggregates?.clientCount ?? null,
        color: '#0288d1',
        path: '/admin/clients',
      },
      {
        title: t('business.dashboard.manageBusinesses'),
        description: t('business.dashboard.manageBusinessesDescription'),
        icon: <BizIcon sx={{ fontSize: 40 }} />,
        count: businessesTotal > 0 ? businessesTotal : null,
        countBreakdown:
          businessesTotal > 0
            ? {
                verified: aggregates?.businessesVerified ?? 0,
                other: aggregates?.businessesNotVerified ?? 0,
                otherLabel: t(
                  'business.dashboard.notVerified',
                  'Not verified'
                ),
              }
            : undefined,
        color: '#6d4c41',
        path: '/admin/businesses',
      },
      {
        title: t('business.dashboard.manageBrands'),
        description: t('business.dashboard.manageBrandsDescription'),
        icon: <BrandIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#9c27b0',
        path: '/content-management/brands',
      },
      {
        title: t('business.dashboard.manageCategories'),
        description: t('business.dashboard.manageCategoriesDescription'),
        icon: <CategoryIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#ff9800',
        path: '/content-management/categories',
      },
      {
        title: t('business.dashboard.manageCommissionAccounts'),
        description: t(
          'business.dashboard.manageCommissionAccountsDescription'
        ),
        icon: <AccountBalanceIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#1976d2',
        path: '/admin/commission-accounts',
      },
      {
        title: t('business.dashboard.manageRentalListingModeration'),
        description: t(
          'business.dashboard.manageRentalListingModerationDescription'
        ),
        icon: <RentalModerationIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#5d4037',
        path: '/admin/rental-listings/moderation',
      },
      {
        title: t(
          'business.dashboard.manageRentalAiReviews',
          'Rental AI review audit'
        ),
        description: t(
          'business.dashboard.manageRentalAiReviewsDescription',
          'Review AI auto-approval decisions and apply overrides for prompt tuning.'
        ),
        icon: <RentalModerationIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#6d4c41',
        path: '/admin/rental-listings/ai-reviews',
      },
      {
        title: t('business.dashboard.manageConfigurations'),
        description: t('business.dashboard.manageConfigurationsDescription'),
        icon: <SettingsIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#607d8b',
        path: '/admin/configurations',
      },
      {
        title: t('business.dashboard.applicationSetup'),
        description: t(
          'business.dashboard.applicationSetupDescription',
          'Configure delivery and application settings for your country'
        ),
        icon: <SettingsIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#00695c',
        path: '/admin/application-setup',
      },
      {
        title: t(
          'business.dashboard.countryOnboarding',
          'Country onboarding'
        ),
        description: t(
          'business.dashboard.countryOnboardingDescription',
          'Multi-step wizard to configure delivery slots and supported states for a country'
        ),
        icon: <PublicIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#00838f',
        path: '/admin/country-onboarding',
      },
      {
        title: t(
          'business.dashboard.pendingMobilePaymentsModule',
          'Pending mobile payments'
        ),
        description: t(
          'business.dashboard.pendingMobilePaymentsModuleDescription',
          'Stuck MyPVit or Freemopay transactions: view provider status and replay callbacks'
        ),
        icon: <PaymentsIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#5e35b1',
        path: '/admin/pending-mobile-payments',
      },
      {
        title: t('business.dashboard.siteEventsModule', 'Site events'),
        description: t(
          'business.dashboard.siteEventsModuleDescription',
          'Reporting and CSV export for client analytics events'
        ),
        icon: <SettingsIcon sx={{ fontSize: 40 }} />,
        count: null,
        color: '#455a64',
        path: '/admin/site-events',
      },
    ];

    const adminHubModule: BusinessDashboardModule = {
      title: t('business.dashboard.adminMenuTitle', 'Admin tools'),
      description: t(
        'business.dashboard.adminMenuDescription',
        'Platform administration for agents, businesses, and system settings.'
      ),
      icon: <SettingsIcon sx={{ fontSize: 40 }} />,
      count: null,
      color: '#455a64',
      path: '/business/dashboard/admin',
    };

    return {
      isRentalFocused,
      primaryOrderModules,
      moreHubModule,
      primaryCatalogModules,
      catalogMenuHubModule,
      catalogMenuModules,
      morePageOrderModules,
      rentalModules,
      insightModules,
      adminModules,
      adminHubModule,
    };
  }, [aggregates, isRentalFocused, t]);
}
