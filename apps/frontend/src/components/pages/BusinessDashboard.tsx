import {
  Person as AgentIcon,
  TrendingUp as AnalyticsIcon,
  Business as BizIcon,
  Label as BrandIcon,
  Category as CategoryIcon,
  Description as DocumentsIcon,
  Inventory2 as ItemsIcon,
  LocationOn as LocationsIcon,
  Assignment as OrdersIcon,
  Settings as SettingsIcon,
  Group as UsersIcon,
  AccountBalance as AccountBalanceIcon,
} from '@mui/icons-material';
import {
  Alert,
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
import { useBusinessInventory } from '../../hooks/useBusinessInventory';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import { useBusinessOrders } from '../../hooks/useBusinessOrders';
import { useItems } from '../../hooks/useItems';
import AddressAlert from '../common/AddressAlert';
import StatusBadge from '../common/StatusBadge';
import UserAccount from '../common/UserAccount';
import SEOHead from '../seo/SEOHead';

const BusinessDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();

  const { accounts } = useAccountInfo();
  const { orders, loading: ordersLoading } = useBusinessOrders(profile?.business?.id);
  const { inventory, loading: inventoryLoading } = useBusinessInventory(profile?.business?.id);
  const { locations, loading: locationsLoading } = useBusinessLocations(profile?.business?.id);
  const { items, loading: itemsLoading } = useItems(profile?.business?.id);

  const isLoading = ordersLoading || inventoryLoading || locationsLoading || itemsLoading;

  // Debug logging
  console.log('Business Dashboard Data:', {
    profile: profile?.business,
    ordersCount: orders.length,
    inventoryCount: inventory.length,
    locationsCount: locations.length,
    itemsCount: items.length,
    profileLoading: profile === null,
    businessId: profile?.business?.id,
  });

  const businessCards = [
    {
      title: t('common.orders'),
      description: t('business.dashboard.ordersDescription'),
      icon: <OrdersIcon sx={{ fontSize: 40 }} />,
      count: orders.length,
      color: '#1976d2',
      path: '/orders',
    },
    {
      title: t('common.items'),
      description: t('business.dashboard.itemsDescription'),
      icon: <ItemsIcon sx={{ fontSize: 40 }} />,
      count: items.length,
      color: '#7b1fa2',
      path: '/business/items',
    },
    {
      title: t('common.locations'),
      description: t('business.dashboard.locationsDescription'),
      icon: <LocationsIcon sx={{ fontSize: 40 }} />,
      count: locations.length,
      color: '#f57c00',
      path: '/business/locations',
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

  const adminCards = [
    {
      title: t('business.dashboard.manageAgents'),
      description: t('business.dashboard.manageAgentsDescription'),
      icon: <AgentIcon sx={{ fontSize: 40 }} />,
      count: null,
      color: '#2e7d32',
      path: '/admin/agents',
    },
    {
      title: t('business.dashboard.manageClients'),
      description: t('business.dashboard.manageClientsDescription'),
      icon: <UsersIcon sx={{ fontSize: 40 }} />,
      count: null,
      color: '#0288d1',
      path: '/admin/clients',
    },
    {
      title: t('business.dashboard.manageBusinesses'),
      description: t('business.dashboard.manageBusinessesDescription'),
      icon: <BizIcon sx={{ fontSize: 40 }} />,
      count: null,
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
            <Typography
              variant="h4"
              component="div"
              color="primary"
              sx={{ mb: 1 }}
            >
              {isLoading ? <Skeleton variant="text" width={60} height={40} sx={{ mx: 'auto' }} /> : card.count}
            </Typography>
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
                <Typography variant="h4">{orders.length}</Typography>
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
                <Typography variant="h4">{items.length}</Typography>
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
                <Typography variant="h4">{locations.length}</Typography>
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
                <Typography variant="h4">{inventory.length}</Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Container>
  );
};

export default BusinessDashboard;
