import {
  TrendingUp as AnalyticsIcon,
  Inventory as InventoryIcon,
  Inventory2 as ItemsIcon,
  LocationOn as LocationsIcon,
  Assignment as OrdersIcon,
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
import SEOHead from '../seo/SEOHead';

const BusinessDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserProfile();

  const { orders } = useBusinessOrders();
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
      title: t('business.dashboard.orders'),
      description: t('business.dashboard.ordersDescription'),
      icon: <OrdersIcon sx={{ fontSize: 40 }} />,
      count: orders.length,
      color: '#1976d2',
      path: '/business/orders',
    },
    {
      title: t('business.dashboard.inventory'),
      description: t('business.dashboard.inventoryDescription'),
      icon: <InventoryIcon sx={{ fontSize: 40 }} />,
      count: inventory.length,
      color: '#388e3c',
      path: '/business/inventory',
    },
    {
      title: t('business.dashboard.locations'),
      description: t('business.dashboard.locationsDescription'),
      icon: <LocationsIcon sx={{ fontSize: 40 }} />,
      count: locations.length,
      color: '#f57c00',
      path: '/business/locations',
    },
    {
      title: t('business.dashboard.items'),
      description: t('business.dashboard.itemsDescription'),
      icon: <ItemsIcon sx={{ fontSize: 40 }} />,
      count: items.length,
      color: '#7b1fa2',
      path: '/business/items',
    },
    {
      title: t('business.dashboard.analytics'),
      description: t('business.dashboard.analyticsDescription'),
      icon: <AnalyticsIcon sx={{ fontSize: 40 }} />,
      count: null,
      color: '#d32f2f',
      path: '/business/analytics',
    },
  ];

  if (!profile?.business) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          {t('business.dashboard.noBusinessProfile')}
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

      <Typography variant="h4" gutterBottom>
        {t('business.dashboard.welcome', { name: profile.business.name })}
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {t('business.dashboard.subtitle')}
      </Typography>

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
                {t('business.dashboard.manage')}
              </Button>
            </CardActions>
          </Card>
        ))}
      </Box>

      {/* Quick Stats Section */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          {t('business.dashboard.quickStats')}
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
                {t('business.dashboard.totalOrders')}
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
                {t('business.dashboard.totalItems')}
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
                {t('business.dashboard.totalLocations')}
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
                {t('business.dashboard.totalInventory')}
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
