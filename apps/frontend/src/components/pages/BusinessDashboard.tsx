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
  Badge,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Container,
  Skeleton,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAccountInfo } from '../../hooks/useAccountInfo';
import { useDashboardAggregates } from '../../hooks/useDashboardAggregates';
import AddressAlert from '../common/AddressAlert';
import StatusBadge from '../common/StatusBadge';
import UserAccount from '../common/UserAccount';
import SEOHead from '../seo/SEOHead';

const ORDER_STATUS_BOX_COLORS: Record<string, string> = {
  pending: '#fff3e0',
  pending_payment: '#fff8e1',
  confirmed: '#e3f2fd',
  preparing: '#e3f2fd',
  ready_for_pickup: '#e8eaf6',
  assigned_to_agent: '#e8eaf6',
  picked_up: '#e1f5fe',
  in_transit: '#e1f5fe',
  out_for_delivery: '#e0f7fa',
  delivered: '#e8f5e9',
  complete: '#e8f5e9',
  completed: '#e8f5e9',
};

const getOrderStatusBoxColor = (status: string): string =>
  ORDER_STATUS_BOX_COLORS[status] ?? '#f5f5f5';

const BusinessDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const businessCards = [
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
    {
      title: t('common.locations'),
      description: t('business.dashboard.locationsDescription'),
      icon: <LocationsIcon sx={{ fontSize: 40 }} />,
      count: locationCount,
      color: '#f57c00',
      path: '/business/locations',
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
    {
      title: t('business.dashboard.documents'),
      description: t('business.dashboard.documentsDescription'),
      icon: <DocumentsIcon sx={{ fontSize: 40 }} />,
      count: null,
      color: '#795548',
      path: '/documents',
    },
    {
      title: t('common.analytics'),
      description: t('business.dashboard.analyticsDescription'),
      icon: <AnalyticsIcon sx={{ fontSize: 40 }} />,
      count: null,
      color: '#d32f2f',
      path: '/business/analytics',
    },
  ];

  const agentsTotal =
    (aggregates?.agentsVerified ?? 0) + (aggregates?.agentsUnverified ?? 0);
  const businessesTotal =
    (aggregates?.businessesVerified ?? 0) +
    (aggregates?.businessesNotVerified ?? 0);

  const adminCards = [
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
      title: t('business.dashboard.manageCommissionAccounts'),
      description: t('business.dashboard.manageCommissionAccountsDescription'),
      icon: <AccountBalanceIcon sx={{ fontSize: 40 }} />,
      count: null,
      color: '#1976d2',
      path: '/admin/commission-accounts',
    },
  ];

  const renderCards = (cards: typeof businessCards) => {
    return cards.map((card, index) => (
      <Card
        key={index}
        sx={{
          width: {
            xs: '100%',
            sm: 'calc(50% - 12px)',
            md: 'calc(33.333% - 16px)',
          },
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
          },
        }}
      >
        <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mb: 2,
              color: card.color,
            }}
          >
            {card.icon}
          </Box>
          <Typography variant="h6" component="h2" gutterBottom>
            {card.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {card.description}
          </Typography>
          {card.count !== null && (
            <Badge
              badgeContent={card.showBadge ? card.count : 0}
              color="error"
              invisible={!card.showBadge}
            >
              <Typography
                variant="h4"
                component="div"
                color="primary"
                sx={{ mb: 1 }}
              >
                {isLoading ? (
                  <Skeleton
                    variant="text"
                    width={60}
                    height={40}
                    sx={{ mx: 'auto' }}
                  />
                ) : (
                  card.count
                )}
              </Typography>
            </Badge>
          )}
          {'countBreakdown' in card && card.countBreakdown && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 1 }}
              component="div"
            >
              {t('business.dashboard.verified', 'Verified')}:{' '}
              {card.countBreakdown.verified} · {card.countBreakdown.otherLabel}:{' '}
              {card.countBreakdown.other}
            </Typography>
          )}
          {card.orderCountByStatus &&
            Object.keys(card.orderCountByStatus).length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1, justifyContent: 'center' }}>
                {Object.entries(card.orderCountByStatus)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([status, n]) => (
                    <Box
                      key={status}
                      sx={{
                        bgcolor: getOrderStatusBoxColor(status),
                        color: 'text.primary',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '0.75rem',
                        fontWeight: 500,
                      }}
                    >
                      {t(`common.orderStatus.${status}`, status)}: {n}
                    </Box>
                  ))}
              </Box>
            )}
        </CardContent>
        <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button
            variant="contained"
            onClick={() => navigate(card.path)}
            disabled={isLoading}
            sx={{
              backgroundColor: card.color,
              '&:hover': {
                backgroundColor: card.color,
                opacity: 0.9,
              },
            }}
          >
            {t('common.manage')}
          </Button>
        </CardActions>
      </Card>
    ));
  };

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

      {/* Account Information */}
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

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {t('business.dashboard.subtitle')}
      </Typography>

      {/* Address Alert */}
      <AddressAlert />

      {aggregatesError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {aggregatesError}
        </Alert>
      )}

      {/* Account Summary Section */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h5"
          gutterBottom
          sx={{ mb: 3, textAlign: 'center' }}
        >
          {t('business.dashboard.accountSummary')}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
          }}
        ></Box>
      </Box>

      {/* Business Management Section */}
      <Box sx={{ mb: 6 }}>
        <Typography
          variant="h5"
          gutterBottom
          sx={{ mb: 3, textAlign: 'center', fontWeight: 600 }}
        >
          {t('business.dashboard.businessManagement')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {renderCards(businessCards)}
        </Box>
      </Box>

      {/* Admin Management Section */}
      {profile.business.is_admin && (
        <Box sx={{ mb: 6 }}>
          <Typography
            variant="h5"
            gutterBottom
            sx={{ mb: 3, textAlign: 'center', fontWeight: 600 }}
          >
            {t('business.dashboard.adminManagement')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {renderCards(adminCards)}
          </Box>
        </Box>
      )}

      {/* Quick Stats Section */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          {t('common.quickStats')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Card
            sx={{
              flex: {
                xs: '1 1 100%',
                sm: '1 1 calc(50% - 8px)',
                md: '1 1 calc(25% - 12px)',
              },
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
            sx={{
              flex: {
                xs: '1 1 100%',
                sm: '1 1 calc(50% - 8px)',
                md: '1 1 calc(25% - 12px)',
              },
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
            sx={{
              flex: {
                xs: '1 1 100%',
                sm: '1 1 calc(50% - 8px)',
                md: '1 1 calc(25% - 12px)',
              },
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
            sx={{
              flex: {
                xs: '1 1 100%',
                sm: '1 1 calc(50% - 8px)',
                md: '1 1 calc(25% - 12px)',
              },
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
        </Box>
      </Box>
    </Container>
  );
};

export default BusinessDashboard;
