import { useAuth0 } from '@auth0/auth0-react';
import {
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
    Chip,
    Container,
    Pagination,
    Paper,
    Skeleton,
    Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useOrders } from '../../hooks';
import { useHorizontalScrollEdges } from '../../hooks/useHorizontalScrollEdges';
import {
    InventoryItem,
    InventorySortMode,
    useInventoryItems,
} from '../../hooks/useInventoryItems';
import { usePublicBrowserGeo } from '../../hooks/usePublicBrowserGeo';
import { useTopInventoryLocations } from '../../hooks/useTopInventoryLocations';
import { useTrackItemView } from '../../hooks/useTrackItemView';
import { useMetaPixel } from '../../hooks/useMetaPixel';
import {
  SITE_EVENT_INVENTORY_LOCATION_SELECT,
  SITE_EVENT_INVENTORY_SORT_SELECT,
  useTrackSiteEvent,
} from '../../hooks/useTrackSiteEvent';
import {
  metaPixelContentCategoryFromItem,
  metaPixelGoogleProductCategoryFromItem,
} from '../../utils/metaPixelContentCategory';
import AddressAlert from '../common/AddressAlert';
import DashboardItemCard from '../common/DashboardItemCard';
import ItemsPageFilter, {
    ItemsPageFilterState,
} from '../common/ItemsPageFilter';
import TopLocationsStrip from '../common/TopLocationsStrip';
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

function CatalogSection({
  title,
  subtitle,
  items,
  loading,
  formatCurrency,
  onOrderClick,
  onAddToCart,
  isPublicView,
  canOrder,
  showCartButtons,
  loginButtonText,
  orderButtonText,
  addToCartButtonText,
  buyNowButtonText,
}: {
  title: string;
  subtitle?: string;
  items: InventoryItem[];
  loading: boolean;
  formatCurrency: (amount: number, currency?: string) => string;
  onOrderClick: (item: InventoryItem) => void;
  onAddToCart: (item: InventoryItem) => void;
  isPublicView: boolean;
  canOrder: boolean;
  showCartButtons: boolean;
  loginButtonText: string;
  orderButtonText: string;
  addToCartButtonText: string;
  buyNowButtonText: string;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { isScrollable, showLeftFade, showRightFade } =
    useHorizontalScrollEdges(scrollRef);

  if (!loading && items.length === 0) return null;

  return (
    <Box
      sx={{
        mb: 2.5,
        width: '100%',
        minWidth: 0,
        maxWidth: 900,
        mx: 'auto',
      }}
    >
      <Box sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.25 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
        {!loading && isScrollable && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.5 }}
          >
            {t(
              'public.items.catalogRow.hint',
              'Swipe sideways to see more products'
            )}
          </Typography>
        )}
      </Box>
      <Box sx={{ position: 'relative' }}>
        {showLeftFade && (
          <Box
            aria-hidden
            sx={(theme) => ({
              pointerEvents: 'none',
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 18,
              zIndex: 1,
              background: `linear-gradient(90deg, ${theme.palette.background.default} 0%, rgba(0,0,0,0) 100%)`,
            })}
          />
        )}
        {showRightFade && (
          <Box
            aria-hidden
            sx={(theme) => ({
              pointerEvents: 'none',
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 22,
              zIndex: 1,
              background: `linear-gradient(270deg, ${theme.palette.background.default} 0%, rgba(0,0,0,0) 100%)`,
            })}
          />
        )}
        <Box
          ref={scrollRef}
          sx={{
            display: 'flex',
            gap: 2,
            overflowX: 'auto',
            pb: 0.5,
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x',
            scrollSnapType: 'x mandatory',
            scrollbarGutter: 'stable',
            '& > *': { scrollSnapAlign: 'start' },
            '&::-webkit-scrollbar': { height: 6 },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'action.disabled',
              borderRadius: 999,
            },
          }}
        >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Box
                key={i}
                sx={{
                  // Mobile: show a "peek" of the next card.
                  minWidth: { xs: '82%', sm: 280, md: 300 },
                  maxWidth: { xs: '100%', sm: 320, md: 320 },
                  flex: '0 0 auto',
                }}
              >
                <ItemCardSkeleton />
              </Box>
            ))
          : items.slice(0, 8).map((inventoryItem) => (
              <Box
                key={inventoryItem.id}
                sx={{
                  minWidth: { xs: '82%', sm: 280, md: 300 },
                  maxWidth: { xs: '100%', sm: 320, md: 320 },
                  flex: '0 0 auto',
                }}
              >
                <DashboardItemCard
                  item={inventoryItem}
                  viewsCount={inventoryItem.viewsCount}
                  formatCurrency={formatCurrency}
                  onOrderClick={onOrderClick}
                  onAddToCart={onAddToCart}
                  estimatedDistance={inventoryItem.distance_text}
                  estimatedDuration={inventoryItem.duration_text}
                  isPublicView={isPublicView}
                  canOrder={canOrder}
                  showCartButtons={showCartButtons}
                  loginButtonText={loginButtonText}
                  orderButtonText={orderButtonText}
                  addToCartButtonText={addToCartButtonText}
                  buyNowButtonText={buyNowButtonText}
                />
              </Box>
            ))}
        </Box>
      </Box>
    </Box>
  );
}

const ItemsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const searchTerm = useMemo(() => {
    return new URLSearchParams(location.search).get('search') ?? '';
  }, [location.search]);
  const setSearchTerm = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!value) next.delete('search');
          else next.set('search', value);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const { isAuthenticated, loginWithRedirect, user } = useAuth0();
  const { profile } = useUserProfileContext();
  const { addToCart } = useCart();
  const [filters, setFilters] = useState<ItemsPageFilterState>({
    category: '',
    subcategory: '',
    brand: '',
    location: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [sort, setSort] = useState<InventorySortMode>('relevance');
  const [businessLocationId, setBusinessLocationId] = useState<string | null>(
    null
  );
  const itemsPerPage = 100;

  const browserGeo = usePublicBrowserGeo(!isAuthenticated);

  const { locations: topLocations, loading: topLocationsLoading } =
    useTopInventoryLocations({
      limit: 3,
      anonymousOrigin: browserGeo,
    });

  const inventorySearch =
    searchTerm.trim() !== '' ? searchTerm.trim() : undefined;

  // Backend applies search (name, description, SKU, brand, tags); client filter refines category/location etc.
  const { inventoryItems, loading, error } = useInventoryItems({
    page: 1,
    limit: 1000,
    is_active: true,
    sort,
    business_location_id: businessLocationId ?? undefined,
    anonymousOrigin: browserGeo,
    search: inventorySearch,
  });

  const { inventoryItems: dealsItems, loading: dealsLoading } = useInventoryItems({
    page: 1,
    limit: 12,
    is_active: true,
    sort: 'deals',
    business_location_id: businessLocationId ?? undefined,
    anonymousOrigin: browserGeo,
  });

  const { inventoryItems: topRatedItems, loading: topRatedLoading } = useInventoryItems({
    page: 1,
    limit: 12,
    is_active: true,
    sort: 'top_rated',
    business_location_id: businessLocationId ?? undefined,
    anonymousOrigin: browserGeo,
  });

  const { inventoryItems: popularItems, loading: popularLoading } = useInventoryItems({
    page: 1,
    limit: 12,
    is_active: true,
    sort: 'relevance',
    business_location_id: businessLocationId ?? undefined,
    anonymousOrigin: browserGeo,
  });

  // Only fetch orders when signed in (avoids unnecessary /orders request for anonymous users)
  const { orders, refreshOrders } = useOrders({ enabled: isAuthenticated });

  // Display items from ItemsPageFilter; when no filters applied, show inventoryItems until filter callback runs
  const displayItems = useMemo(() => {
    if (filteredItems.length > 0) return filteredItems;
    const noFilters =
      !searchTerm &&
      !filters.category &&
      !filters.subcategory &&
      !filters.brand &&
      !filters.location;
    if (noFilters) return inventoryItems;
    return [];
  }, [filteredItems, inventoryItems, searchTerm, filters]);

  const topCategoryChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const inv of inventoryItems) {
      const name = inv.item.item_sub_category?.item_category?.name?.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  }, [inventoryItems]);

  const resultsCountLabel = useMemo(() => {
    const count = displayItems.length;
    if (loading) {
      return t('public.items.results.loading', 'Loading items…');
    }
    if (count === 0) {
      return t('public.items.results.none', 'No items to show');
    }
    return t('public.items.results.count', '{{count}} items', { count });
  }, [displayItems.length, loading, t]);

  // Reset to first page when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    filters.category,
    filters.subcategory,
    filters.brand,
    filters.location,
    sort,
    businessLocationId,
  ]);

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

  const { trackView } = useTrackItemView(null);
  const { trackAddToCart } = useMetaPixel();
  const { trackSiteEvent } = useTrackSiteEvent();

  const handleOrderClick = (item: InventoryItem) => {
    trackView(item.id);
    if (!isAuthenticated) {
      handleLogin();
      return;
    }
    // For authenticated users, redirect to place order page for this specific item
    navigate(`/items/${item.id}/place_order`);
  };

  const handleAddToCart = (item: InventoryItem) => {
    trackView(item.id);
    if (!isAuthenticated) {
      handleLogin();
      return;
    }

    const hasDeal =
      item.hasActiveDeal &&
      typeof item.original_price === 'number' &&
      typeof item.discounted_price === 'number' &&
      item.original_price > 0;

    const unitPrice = hasDeal ? (item.discounted_price ?? item.selling_price) : item.selling_price;
    const contentCategory = metaPixelContentCategoryFromItem(item.item);
    const googleCategory = metaPixelGoogleProductCategoryFromItem(item.item);

    trackAddToCart({
      content_type: 'product',
      content_ids: [item.id],
      contents: [{ id: item.id, quantity: 1, item_price: unitPrice }],
      value: unitPrice,
      currency: item.item.currency || 'USD',
      content_name: item.item.name,
      ...(contentCategory && { content_category: contentCategory }),
      ...(googleCategory && { google_product_category: googleCategory }),
    });

    addToCart({
      inventoryItemId: item.id,
      quantity: 1,
      businessId: item.business_location.business_id,
      businessLocationId: item.business_location_id,
      itemData: {
        name: item.item.name,
        price: unitPrice,
        currency: item.item.currency,
        ...(contentCategory && { contentCategory }),
        ...(googleCategory && { googleProductCategory: googleCategory }),
        imageUrl: item.item.item_images?.[0]?.image_url,
        weight: item.item.weight,
        maxOrderQuantity: item.item.max_order_quantity || undefined,
        minOrderQuantity: item.item.min_order_quantity || undefined,
        originalPrice: hasDeal ? item.original_price : undefined,
        discountedPrice: hasDeal ? item.discounted_price : undefined,
        hasActiveDeal: hasDeal,
        dealEndAt: hasDeal ? item.deal_end_at : undefined,
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
    searchTerm ||
      filters.category ||
      filters.subcategory ||
      filters.brand ||
      filters.location ||
      businessLocationId
  );

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setBusinessLocationId(null);
    setFilters({
      category: '',
      subcategory: '',
      brand: '',
      location: '',
    });
  };

  const handleSelectTopLocation = (loc: {
    id: string;
    name: string;
  }) => {
    if (businessLocationId === loc.id) {
      setBusinessLocationId(null);
      setFilters((f) => ({ ...f, location: '' }));
    } else {
      setBusinessLocationId(loc.id);
      setFilters((f) => ({ ...f, location: loc.name }));
    }
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_LOCATION_SELECT,
      metadata: {
        business_location_id: loc.id,
        name: loc.name,
        selected: businessLocationId !== loc.id,
      },
    });
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
      maxWidth={false}
      disableGutters
      sx={{ mt: 2, mb: 2, px: 0 }}
    >
      <SEOHead
        title={t('seo.public-items.title')}
        description={t('seo.public-items.description')}
        keywords={t('seo.public-items.keywords')}
      />

      {/* Header / Hero */}
      <Box sx={{ mb: 2.5, px: { xs: 1, sm: 2 } }}>
        <Paper
          elevation={0}
          sx={(theme) => ({
            borderRadius: 4,
            p: { xs: 2, sm: 3 },
            border: '1px solid',
            borderColor: alpha(theme.palette.divider, 0.9),
            background:
              theme.palette.mode === 'dark'
                ? `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.18)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 60%)`
                : `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 40%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`,
          })}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              mb: 1,
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  mb: 0.25,
                  fontSize: { xs: '1.75rem', sm: '2.125rem' },
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                }}
              >
                {isClient
                  ? t('dashboard.client.title', 'Client Dashboard')
                  : t('public.items.heroTitle', 'Shop local products near you')}
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}
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
                      'Discover amazing products from local businesses'
                    )}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isAuthenticated && user?.email_verified && (
                <StatusBadge type="verified" />
              )}
              <Chip
                size="small"
                label={resultsCountLabel}
                color={displayItems.length > 0 ? 'primary' : 'default'}
                variant={displayItems.length > 0 ? 'filled' : 'outlined'}
                sx={{ fontWeight: 700 }}
              />
            </Box>
          </Box>

          {/* Address Alert - Only for authenticated clients */}
          {isClient && <AddressAlert />}

          {/* Unified filter for all users (contains search bar) */}
          <ItemsPageFilter
            items={inventoryItems}
            searchTerm={searchTerm}
            onSearchSubmit={setSearchTerm}
            suggestionsQuery={{
              is_active: true,
              business_location_id: businessLocationId ?? undefined,
              origin_lat: browserGeo?.lat ?? undefined,
              origin_lng: browserGeo?.lng ?? undefined,
            }}
            filters={filters}
            onFiltersChange={setFilters}
            onFilterChange={setFilteredItems}
            loading={loading}
            onLocationFilterChange={(name) => {
              if (!name) {
                setBusinessLocationId(null);
              }
            }}
            onClearFilters={() => setBusinessLocationId(null)}
          />

          {/* Quick picks */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {(
              [
                'deals',
                'top_rated',
                'fastest',
                'cheapest',
                'relevance',
              ] as const
            ).map((mode) => {
              const selected = sort === mode;
              const label = t(
                `public.items.quickPick.${mode}`,
                mode === 'top_rated'
                  ? 'Top rated'
                  : mode === 'fastest'
                    ? 'Closest'
                    : mode === 'cheapest'
                      ? 'Cheap'
                      : mode === 'deals'
                        ? 'Deals'
                        : 'Popular'
              );
              return (
                <Chip
                  key={mode}
                  label={label}
                  onClick={() => setSort(mode)}
                  color={selected ? 'primary' : 'default'}
                  variant={selected ? 'filled' : 'outlined'}
                  size="medium"
                  sx={
                    mode === 'deals'
                      ? {
                          borderWidth: 2,
                          borderStyle: 'solid',
                          borderColor: selected ? 'secondary.dark' : 'secondary.main',
                          ...(selected
                            ? { bgcolor: 'secondary.main', color: 'secondary.contrastText' }
                            : {}),
                        }
                      : undefined
                  }
                />
              );
            })}

            {topCategoryChips.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {topCategoryChips.map((cat) => {
                  const selected = filters.category === cat;
                  return (
                    <Chip
                      key={cat}
                      label={cat}
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          category: selected ? '' : cat,
                          subcategory: '',
                        }))
                      }
                      color={selected ? 'primary' : 'default'}
                      variant={selected ? 'filled' : 'outlined'}
                      size="medium"
                    />
                  );
                })}
              </Box>
            )}

            {hasActiveFilters && (
              <Chip
                label={t('public.items.clearAll', 'Clear all')}
                onClick={handleClearAllFilters}
                variant="outlined"
                size="medium"
              />
            )}
          </Box>
        </Paper>

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
      </Box>

      {/* Items Section */}
      <Paper sx={{ p: { xs: 1, sm: 2 } }}>
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

        {/* Sort / filter bar */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {(
            [
              'relevance',
              'fastest',
              'cheapest',
              'top_rated',
              'deals',
            ] as const
          ).map((mode) => {
            const isDeals = mode === 'deals';
            const isSelected = sort === mode;
            const isDealsSelected = isDeals && isSelected;
            return (
              <Chip
                key={mode}
                label={t(
                  `public.items.sort.${mode === 'top_rated' ? 'topRated' : mode}`,
                  mode === 'top_rated'
                    ? 'Top rated'
                    : mode === 'fastest'
                      ? 'Closest to you'
                      : mode
                )}
                onClick={() => {
                  void trackSiteEvent({
                    eventType: SITE_EVENT_INVENTORY_SORT_SELECT,
                    metadata: { sort: mode },
                  });
                  setSort(mode);
                }}
                color={isDealsSelected ? 'default' : isSelected ? 'primary' : 'default'}
                variant={isSelected ? 'filled' : 'outlined'}
                size="medium"
                sx={
                  isDeals
                    ? {
                        ...(isDealsSelected
                          ? {
                              backgroundColor: '#c9972a',
                              color: '#1a1a1a',
                              border: '2px solid #b8860b',
                              fontWeight: 600,
                              '&:hover': {
                                backgroundColor: '#d4a84b',
                              },
                            }
                          : {
                              border: '2px solid #c9972a',
                              color: '#b8860b',
                              '&:hover': {
                                borderColor: '#d4a84b',
                                bgcolor: 'rgba(201, 151, 42, 0.08)',
                              },
                            }),
                      }
                    : undefined
                }
              />
            );
          })}
        </Box>

        <TopLocationsStrip
          locations={topLocations}
          loading={topLocationsLoading}
          selectedId={businessLocationId}
          onSelect={handleSelectTopLocation}
        />

        {/* Curated discovery sections (before full catalog grid) */}
        <CatalogSection
          title={t('public.items.sections.dealsTitle', 'Deals near you')}
          subtitle={t(
            'public.items.sections.dealsSubtitle',
            'Limited-time discounts from verified sellers'
          )}
          items={dealsItems}
          loading={dealsLoading}
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

        <CatalogSection
          title={t('public.items.sections.topRatedTitle', 'Top rated')}
          subtitle={t(
            'public.items.sections.topRatedSubtitle',
            'Products customers love'
          )}
          items={topRatedItems}
          loading={topRatedLoading}
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

        <CatalogSection
          title={t('public.items.sections.popularTitle', 'Popular picks')}
          subtitle={t(
            'public.items.sections.popularSubtitle',
            'Recommended based on what people browse and buy'
          )}
          items={popularItems}
          loading={popularLoading}
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
                  viewsCount={inventoryItem.viewsCount}
                  formatCurrency={formatCurrency}
                  onOrderClick={handleOrderClick}
                  onAddToCart={handleAddToCart}
                  estimatedDistance={inventoryItem.distance_text}
                  estimatedDuration={inventoryItem.duration_text}
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
