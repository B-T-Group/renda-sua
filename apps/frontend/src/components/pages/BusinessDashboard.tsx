import {
  AccountBalance as AccountBalanceIcon,
  Person as AgentIcon,
  TrendingUp as AnalyticsIcon,
  Business as BizIcon,
  Label as BrandIcon,
  Category as CategoryIcon,
  Description as DocumentsIcon,
  Error as ErrorIcon,
  Inventory2 as ItemsIcon,
  Handshake as RentalsIcon,
  LocationOn as LocationsIcon,
  Assignment as OrdersIcon,
  Settings as SettingsIcon,
  Group as UsersIcon,
  Image as ImageIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Container,
  Skeleton,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAccountInfo } from '../../hooks/useAccountInfo';
import { useDashboardAggregates } from '../../hooks/useDashboardAggregates';
import BusinessDashboardModuleCard, {
  BusinessDashboardModule,
} from '../business/BusinessDashboardModuleCard';
import BusinessDashboardSection from '../business/BusinessDashboardSection';
import AddressAlert from '../common/AddressAlert';
import StatusBadge from '../common/StatusBadge';
import UserAccount from '../common/UserAccount';
import SEOHead from '../seo/SEOHead';

const BusinessDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();

  const { accounts } = useAccountInfo();
  const {
    aggregates,
    loading: aggregatesLoading,
    error: aggregatesError,
  } = useDashboardAggregates(profile?.business?.id);

  const isLoading = aggregatesLoading;

  const ordersTotalNonCancelled = aggregates?.ordersTotal ?? 0;
  const orderCountByStatus = aggregates?.ordersByStatus ?? {};
  const itemCount = aggregates?.itemCount ?? 0;
  const locationCount = aggregates?.locationCount ?? 0;
  const inventoryCount = aggregates?.inventoryCount ?? 0;
  const pendingFailedDeliveriesCount = aggregates?.pendingFailedDeliveriesCount ?? 0;

  const orderModules: BusinessDashboardModule[] = [
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
      title: t('business.dashboard.failedDeliveries'),
      description: t('business.dashboard.failedDeliveriesDescription'),
      icon: <ErrorIcon sx={{ fontSize: 40 }} />,
      count: pendingFailedDeliveriesCount,
      color: '#d32f2f',
      path: '/business/failed-deliveries',
      showBadge: pendingFailedDeliveriesCount > 0,
    },
  ];

  const catalogModules: BusinessDashboardModule[] = [
    {
      title: t('common.items'),
      description: t('business.dashboard.itemsDescription'),
      icon: <ItemsIcon sx={{ fontSize: 40 }} />,
      count: itemCount,
      color: '#7b1fa2',
      path: '/business/items',
    },
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
      title: t('common.locations'),
      description: t('business.dashboard.locationsDescription'),
      icon: <LocationsIcon sx={{ fontSize: 40 }} />,
      count: locationCount,
      color: '#f57c00',
      path: '/business/locations',
    },
  ];

  const rentalModules: BusinessDashboardModule[] = [
    {
      title: t('business.dashboard.rentalsTitle', 'Rentals'),
      description: t(
        'business.dashboard.rentalsDescription',
        'Manage rental catalog, location listings, and client requests.'
      ),
      icon: <RentalsIcon sx={{ fontSize: 40 }} />,
      count: null,
      color: '#00695c',
      path: '/business/rentals',
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

  const adminPeopleModules: BusinessDashboardModule[] = [
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
  ];

  const adminCatalogModules: BusinessDashboardModule[] = [
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
      description: t('business.dashboard.manageCommissionAccountsDescription'),
      icon: <AccountBalanceIcon sx={{ fontSize: 40 }} />,
      count: null,
      color: '#1976d2',
      path: '/admin/commission-accounts',
    },
  ];

  const adminSystemModules: BusinessDashboardModule[] = [
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
  ];

  const renderModuleRow = (modules: BusinessDashboardModule[]) =>
    modules.map((mod) => (
      <BusinessDashboardModuleCard
        key={mod.path}
        module={mod}
        isLoading={isLoading}
      />
    ));

  if (!profile?.business) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          <Typography variant="h6" color="text.secondary">
            {t('business.dashboard.noBusinessProfile')}
          </Typography>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t('seo.business-dashboard.title')}
        description={t('seo.business-dashboard.description')}
        keywords={t('seo.business-dashboard.keywords')}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
          {t('business.dashboard.welcome', { name: profile.business.name })}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {profile.business.is_verified && <StatusBadge type="verified" />}
          {profile.business.is_admin && <StatusBadge type="admin" />}
        </Box>
      </Box>

      {accounts.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            {t('accounts.accountInformation')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {accounts.map((account) => (
              <UserAccount
                key={account.id}
                accountId={account.id}
                compactView={true}
                showTransactions={false}
              />
            ))}
          </Box>
        </Box>
      )}

      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        {t('business.dashboard.subtitle')}
      </Typography>

      <AddressAlert />

      {aggregatesError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {aggregatesError}
        </Alert>
      )}

      <BusinessDashboardSection
        title={t('business.dashboard.atAGlance', 'At a glance')}
        subtitle={t(
          'business.dashboard.atAGlanceHint',
          'Key numbers for your store and stock.'
        )}
      >
        <Card
          elevation={0}
          sx={{
            flex: {
              xs: '1 1 100%',
              sm: '1 1 calc(50% - 12px)',
              md: '1 1 calc(25% - 18px)',
            },
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              {t('common.totalOrders')}
            </Typography>
            {isLoading ? (
              <Skeleton variant="text" width={60} height={40} />
            ) : (
              <Typography variant="h4">{ordersTotalNonCancelled}</Typography>
            )}
          </CardContent>
        </Card>
        <Card
          elevation={0}
          sx={{
            flex: {
              xs: '1 1 100%',
              sm: '1 1 calc(50% - 12px)',
              md: '1 1 calc(25% - 18px)',
            },
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              {t('common.totalItems')}
            </Typography>
            {isLoading ? (
              <Skeleton variant="text" width={60} height={40} />
            ) : (
              <Typography variant="h4">{itemCount}</Typography>
            )}
          </CardContent>
        </Card>
        <Card
          elevation={0}
          sx={{
            flex: {
              xs: '1 1 100%',
              sm: '1 1 calc(50% - 12px)',
              md: '1 1 calc(25% - 18px)',
            },
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              {t('common.totalLocations')}
            </Typography>
            {isLoading ? (
              <Skeleton variant="text" width={60} height={40} />
            ) : (
              <Typography variant="h4">{locationCount}</Typography>
            )}
          </CardContent>
        </Card>
        <Card
          elevation={0}
          sx={{
            flex: {
              xs: '1 1 100%',
              sm: '1 1 calc(50% - 12px)',
              md: '1 1 calc(25% - 18px)',
            },
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              {t('common.totalInventory')}
            </Typography>
            {isLoading ? (
              <Skeleton variant="text" width={60} height={40} />
            ) : (
              <Typography variant="h4">{inventoryCount}</Typography>
            )}
          </CardContent>
        </Card>
      </BusinessDashboardSection>

      <BusinessDashboardSection
        title={t(
          'business.dashboard.sections.ordersAndDelivery',
          'Orders & delivery'
        )}
        subtitle={t(
          'business.dashboard.sections.ordersAndDeliveryHint',
          'Track sales, batch updates, and resolve delivery issues.'
        )}
      >
        {renderModuleRow(orderModules)}
      </BusinessDashboardSection>

      <BusinessDashboardSection
        title={t(
          'business.dashboard.sections.catalog',
          'Catalog & locations'
        )}
        subtitle={t(
          'business.dashboard.sections.catalogHint',
          'Products, images, and where you sell from.'
        )}
      >
        {renderModuleRow(catalogModules)}
      </BusinessDashboardSection>

      <BusinessDashboardSection
        title={t('business.dashboard.sections.rentals', 'Rentals')}
        subtitle={t(
          'business.dashboard.sections.rentalsHint',
          'Rental catalog, listings, and photo library.'
        )}
      >
        {renderModuleRow(rentalModules)}
      </BusinessDashboardSection>

      <BusinessDashboardSection
        title={t(
          'business.dashboard.sections.insights',
          'Insights & records'
        )}
        subtitle={t(
          'business.dashboard.sections.insightsHint',
          'Analytics and business documents.'
        )}
      >
        {renderModuleRow(insightModules)}
      </BusinessDashboardSection>

      {profile.business.is_admin && (
        <>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
            {t('business.dashboard.adminManagement')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              'business.dashboard.adminManagementHint',
              'Platform tools visible to administrators only.'
            )}
          </Typography>

          <BusinessDashboardSection
            title={t(
              'business.dashboard.sections.adminPeople',
              'People & businesses'
            )}
            subtitle={t(
              'business.dashboard.sections.adminPeopleHint',
              'Agents, clients, and business accounts.'
            )}
          >
            {renderModuleRow(adminPeopleModules)}
          </BusinessDashboardSection>

          <BusinessDashboardSection
            title={t(
              'business.dashboard.sections.adminCatalog',
              'Catalog & accounts'
            )}
            subtitle={t(
              'business.dashboard.sections.adminCatalogHint',
              'Taxonomy, brands, and commission-related accounts.'
            )}
          >
            {renderModuleRow(adminCatalogModules)}
          </BusinessDashboardSection>

          <BusinessDashboardSection
            title={t(
              'business.dashboard.sections.adminSystem',
              'System & onboarding'
            )}
            subtitle={t(
              'business.dashboard.sections.adminSystemHint',
              'Configuration, country setup, and application defaults.'
            )}
          >
            {renderModuleRow(adminSystemModules)}
          </BusinessDashboardSection>
        </>
      )}
    </Container>
  );
};

export default BusinessDashboard;
