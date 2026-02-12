import { useAuth0 } from '@auth0/auth0-react';
import {
    AccountCircle as AccountIcon,
    Assignment,
    Inventory,
    Search as SearchIcon,
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Container,
    Pagination,
    Paper,
    Skeleton,
    Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useOrders } from '../../hooks';
import {
    InventoryItem,
    useInventoryItems,
} from '../../hooks/useInventoryItems';
import AddressAlert from '../common/AddressAlert';
import DashboardItemCard from '../common/DashboardItemCard';
import ItemsPageFilter, {
    ItemsPageFilterState,
} from '../common/ItemsPageFilter';
import OrderActionCard from '../common/OrderActionCard';
import StatusBadge from '../common/StatusBadge';
import SEOHead from '../seo/SEOHead';

// ItemCardSkeleton component for better loading UX
const ItemCardSkeleton: React.FC = () => (
  <Card sx={{ height: '100%' }}>
    <Skeleton variant="rectangular" height={240} />
    <CardContent sx={{ p: 2 }}>
      <Skeleton variant="text" width="80%" height={24} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="60%" height={20} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="40%" height={16} sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Skeleton variant="rounded" width={60} height={24} />
        <Skeleton variant="rounded" width={80} height={24} />
      </Box>
      <Skeleton variant="rectangular" width="100%" height={36} />
    </CardContent>
  </Card>
);

const ItemsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, loginWithRedirect, user } = useAuth0();
  const { profile } = useUserProfileContext();
  const { addToCart } = useCart();

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<ItemsPageFilterState>({
    category: '',
    subcategory: '',
    brand: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const itemsPerPage = 12;

  // Primary or first address for location-based inventory filtering (when logged in)
  const userAddress = useMemo(() => {
    if (!profile?.addresses?.length) return null;
    return (
      profile.addresses.find((a) => a.is_primary) ?? profile.addresses[0]
    );
  }, [profile?.addresses]);

  // Fetch all inventory items; pass country_code and state when user is logged in and has an address
  const { inventoryItems, loading, error } = useInventoryItems({
    page: 1,
    limit: 1000, // Get all items for client-side filtering
    is_active: true,
    ...(isAuthenticated &&
      userAddress && {
        country_code: userAddress.country,
        state: userAddress.state,
      }),
  });

  // Only fetch orders when signed in (avoids unnecessary /orders request for anonymous users)
  const { orders, refreshOrders } = useOrders({ enabled: isAuthenticated });

  // Display items from ItemsPageFilter; when no filters applied, show inventoryItems until filter callback runs
  const displayItems = useMemo(() => {
    if (filteredItems.length > 0) return filteredItems;
    const noFilters =
      !searchTerm && !filters.category && !filters.subcategory && !filters.brand;
    if (noFilters) return inventoryItems;
    return [];
  }, [filteredItems, inventoryItems, searchTerm, filters]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters.category, filters.subcategory, filters.brand]);

  // Pagination
  const totalPages = Math.ceil(displayItems.length / itemsPerPage);
  const paginatedItems = displayItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Dashboard-specific logic for authenticated clients
  const isClient =
    isAuthenticated &&
    profile?.client !== null &&
    profile?.client !== undefined;

  // Filter orders that require action based on user type and status
  const ordersRequiringAction = React.useMemo(() => {
    if (!orders || !profile?.user_type_id) return [];

    const userType = profile.user_type_id;

    return orders.filter((order) => {
      const status = order.current_status;

      switch (userType) {
        case 'business':
          return ['pending', 'preparing', 'delivered'].includes(status);
        case 'client':
          return ['delivered'].includes(status);
        case 'agent':
          return (
            (status === 'ready_for_pickup' && !order.assigned_agent_id) ||
            ['picked_up', 'in_transit'].includes(status)
          );
        default:
          return false;
      }
    });
  }, [orders, profile?.user_type_id]);

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setCurrentPage(value);
    // Smooth scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = () => {
    loginWithRedirect({
      appState: {
        returnTo: window.location.pathname,
      },
    });
  };

  // Check if user is a client (can place orders)
  const isClientUser =
    isAuthenticated &&
    profile?.client !== null &&
    profile?.client !== undefined;

  const handleOrderClick = (item: InventoryItem) => {
    if (!isAuthenticated) {
      handleLogin();
      return;
    }
    // For authenticated users, redirect to place order page for this specific item
    navigate(`/items/${item.id}/place_order`);
  };

  const handleAddToCart = (item: InventoryItem) => {
    if (!isAuthenticated) {
      handleLogin();
      return;
    }

    addToCart({
      inventoryItemId: item.id,
      quantity: 1,
      businessId: item.business_location.business_id,
      businessLocationId: item.business_location_id,
      itemData: {
        name: item.item.name,
        price: item.selling_price,
        currency: item.item.currency,
        imageUrl: item.item.item_images?.[0]?.image_url,
        weight: item.item.weight,
      },
    });
  };

  // Format currency helper
  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Check if any filters are active
  const hasActiveFilters = Boolean(
    searchTerm || filters.category || filters.subcategory || filters.brand
  );

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setFilters({ category: '', subcategory: '', brand: '' });
  };

  if (error) {
    return (
      <Container
        maxWidth="lg"
        sx={{ mt: 4, mb: 4, px: { xs: 0, sm: 2 } }}
      >
        <Alert severity="error">{t('common.errorLoadingData')}</Alert>
      </Container>
    );
  }

  return (
    <Container
      maxWidth="lg"
      sx={{ mt: 4, mb: 4, px: { xs: 0, sm: 2 } }}
    >
      <SEOHead
        title={t('seo.public-items.title')}
        description={t('seo.public-items.description')}
        keywords={t('seo.public-items.keywords')}
      />

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            mb: 2,
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              mb: 0,
              fontSize: { xs: '1.75rem', sm: '2.125rem' },
            }}
          >
            {isClient
              ? t('dashboard.client.title', 'Client Dashboard')
              : t('public.items.title', 'Browse Items')}
          </Typography>
          {isAuthenticated && user?.email_verified && (
            <StatusBadge type="verified" />
          )}
        </Box>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
        >
          {isClient
            ? t(
                'dashboard.client.subtitle',
                'Welcome back, {{name}}! Browse available items and manage your orders.',
                {
                  name:
                    `${user?.first_name || ''} ${
                      user?.last_name || ''
                    }`.trim() || user?.email,
                }
              )
            : t(
                'public.items.subtitle',
                'Discover great products from verified sellers'
              )}
        </Typography>

        {/* Address Alert - Only for authenticated clients */}
        {isClient && <AddressAlert />}

        {/* Orders Requiring Action - Only for authenticated clients */}
        {isClient && ordersRequiringAction.length > 0 && (
          <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                fontSize: { xs: '1.1rem', sm: '1.25rem' },
              }}
            >
              <Assignment color="primary" />
              {t(
                'dashboard.ordersRequiringAction',
                'Orders Requiring Action'
              )}{' '}
              ({ordersRequiringAction.length})
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(3, 1fr)',
                },
                gap: { xs: 2, sm: 3 },
              }}
            >
              {ordersRequiringAction.map((order) => (
                <OrderActionCard
                  key={order.id}
                  order={order}
                  userType={
                    profile?.user_type_id as 'client' | 'business' | 'agent'
                  }
                  formatCurrency={formatCurrency}
                  onActionComplete={refreshOrders}
                />
              ))}
            </Box>
          </Paper>
        )}

        {/* Authentication CTA - Only for non-authenticated users */}
        {!isAuthenticated && (
          <Alert
            severity="info"
            icon={<AccountIcon />}
            action={
              <Button
                variant="contained"
                size="medium"
                onClick={handleLogin}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  minWidth: 120,
                }}
              >
                {t('public.items.authCta.button', 'Sign In')}
              </Button>
            }
            sx={{
              mb: 4,
              '& .MuiAlert-message': {
                width: '100%',
              },
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5 }}>
              {t('public.items.authCta.title', 'Sign in to place orders')}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mt: 0.5 }}
            >
              {t(
                'public.items.authCta.description',
                'Create an account to browse and order items.'
              )}
            </Typography>
          </Alert>
        )}
      </Box>

      {/* Items Section */}
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography
          variant="h6"
          gutterBottom
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
          }}
        >
          <Inventory color="primary" />
          {isClient
            ? t('dashboard.availableItems', 'Available Items')
            : t('public.items.availableItems', 'Available Items')}
        </Typography>

        {/* Unified filter for all users */}
        <ItemsPageFilter
          items={inventoryItems}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filters={filters}
          onFiltersChange={setFilters}
          onFilterChange={setFilteredItems}
          loading={loading}
        />

        {/* Items Grid */}
        {loading ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)',
              },
              gap: 3,
            }}
          >
            {Array.from(new Array(itemsPerPage)).map((_, index) => (
              <ItemCardSkeleton key={index} />
            ))}
          </Box>
        ) : displayItems.length === 0 ? (
          /* Enhanced Empty State */
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              px: 2,
            }}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'grey.100',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 3,
              }}
            >
              <SearchIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
            </Box>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              {hasActiveFilters
                ? t(
                    'public.items.noMatchingItems',
                    'No items match your filters'
                  )
                : t('public.items.noItemsAvailable', 'No items available yet')}
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}
            >
              {hasActiveFilters
                ? t(
                    'public.items.tryDifferentFilters',
                    "Try adjusting your filters or search terms to find what you're looking for."
                  )
                : t(
                    'public.items.checkBackSoon',
                    'Check back soon for new items from our sellers.'
                  )}
            </Typography>
            {hasActiveFilters && (
              <Button
                variant="outlined"
                size="large"
                onClick={handleClearAllFilters}
              >
                {t('public.items.clearSearch', 'Clear filters')}
              </Button>
            )}
          </Box>
        ) : (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(3, 1fr)',
                  lg: 'repeat(4, 1fr)',
                },
                gap: 3,
              }}
            >
              {paginatedItems.map((inventoryItem) => (
                <DashboardItemCard
                  key={inventoryItem.id}
                  item={inventoryItem}
                  formatCurrency={formatCurrency}
                  onOrderClick={handleOrderClick}
                  onAddToCart={handleAddToCart}
                  isPublicView={!isAuthenticated}
                  canOrder={!isAuthenticated || isClientUser}
                  showCartButtons={isAuthenticated && isClientUser}
                  loginButtonText={t('public.items.login', 'Sign In to Order')}
                  orderButtonText={t('common.orderNow', 'Order Now')}
                  addToCartButtonText={t('cart.addToCart', 'Add to Cart')}
                  buyNowButtonText={t('cart.buyNow', 'Buy Now')}
                />
              ))}
            </Box>

            {/* Pagination */}
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={handlePageChange}
                  color="primary"
                />
              </Box>
            )}
          </>
        )}
      </Paper>
    </Container>
  );
};

export default ItemsPage;
