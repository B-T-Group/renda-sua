import {
  Person as AgentIcon,
  TrendingUp as AnalyticsIcon,
  Business as BizIcon,
  Description as DocumentsIcon,
  Inventory2 as ItemsIcon,
  LocationOn as LocationsIcon,
  Assignment as OrdersIcon,
  Group as UsersIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Container,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBusinessInventory } from '../../hooks/useBusinessInventory';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import { useBusinessOrders } from '../../hooks/useBusinessOrders';
import { useItems } from '../../hooks/useItems';
import { useUserProfile } from '../../hooks/useUserProfile';
import AddressAlert from '../common/AddressAlert';
import StatusBadge from '../common/StatusBadge';
import SEOHead from '../seo/SEOHead';

const BusinessDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserProfile();

  const { orders } = useBusinessOrders(profile?.business?.id);
  const { inventory } = useBusinessInventory(profile?.business?.id);
  const { locations } = useBusinessLocations(profile?.business?.id);
  const { items } = useItems(profile?.business?.id);

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

  const dashboardCards = [
    {
      title: t('common.orders'),
      description: t('business.dashboard.ordersDescription'),
      icon: <OrdersIcon sx={{ fontSize: 40 }} />,
      count: orders.length,
      color: '#1976d2',
      path: '/business/orders',
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
      title: 'Documents',
      description: 'Manage your business documents and files',
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
    {
      title: 'Manage Agents',
      description: 'View and update agents',
      icon: <AgentIcon sx={{ fontSize: 40 }} />,
      count: null,
      color: '#2e7d32',
      path: '/admin/agents',
    },
    {
      title: 'Manage Clients',
      description: 'View and update clients',
      icon: <UsersIcon sx={{ fontSize: 40 }} />,
      count: null,
      color: '#0288d1',
      path: '/admin/clients',
    },
    {
      title: 'Manage Businesses',
      description: 'View and update businesses',
      icon: <BizIcon sx={{ fontSize: 40 }} />,
      count: null,
      color: '#6d4c41',
      path: '/admin/businesses',
    },
  ];

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
          Account Summary
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

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 6 }}>
        {dashboardCards.map((card, index) => (
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
                  {card.count}
                </Typography>
              )}
            </CardContent>
            <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
              <Button
                variant="contained"
                onClick={() => navigate(card.path)}
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
        ))}
      </Box>

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
              <Typography variant="h4">{orders.length}</Typography>
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
              <Typography variant="h4">{items.length}</Typography>
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
              <Typography variant="h4">{locations.length}</Typography>
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
              <Typography variant="h4">{inventory.length}</Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Container>
  );
};

export default BusinessDashboard;
