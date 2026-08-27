import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import SEOHead from '../seo/SEOHead';
import { useCart } from '../../contexts/CartContext';
import { useCatalogVariantFlow } from '../../hooks/useCatalogVariantFlow';
import { useFoodSubCategories } from '../../hooks/useFoodSubCategories';
import { usePublicBrowserGeo } from '../../hooks/usePublicBrowserGeo';
import {
  InventoryItem,
  InventorySortMode,
  useInventoryItems,
} from '../../hooks/useInventoryItems';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import CatalogVariantPickerDialog from '../common/CatalogVariantPickerDialog';
import DashboardItemCard from '../common/DashboardItemCard';
import FoodsMenuHero from '../foods/FoodsMenuHero';
import FoodsEmptyStateIllustration from '../illustrations/FoodsEmptyStateIllustration';

const PAGE_SIZE = 24;

const FOOD_SORTS: Array<{ value: InventorySortMode; labelKey: string; fallback: string }> = [
  { value: 'relevance', labelKey: 'foods.sort.relevance', fallback: 'Best match' },
  { value: 'fastest', labelKey: 'foods.sort.nearMe', fallback: 'Near me' },
  { value: 'cheapest', labelKey: 'foods.sort.cheapest', fallback: 'Lowest price' },
  { value: 'top_rated', labelKey: 'foods.sort.topRated', fallback: 'Top rated' },
];

const FOODS_GRID_SX = {
  display: 'grid',
  gap: 2,
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(2, minmax(0, 1fr))',
    md: 'repeat(3, minmax(0, 1fr))',
    lg: 'repeat(4, minmax(0, 1fr))',
  },
} as const;

/**
 * Restaurant menu browsing. Dishes being served now come first, and each card
 * shows whether the kitchen is open, so a shopper can tell at a glance what
 * they can actually order.
 */
const FoodsPage: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const { profile } = useUserProfileContext();
  const { addToCart } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') ?? '');
  const [page, setPage] = useState(1);

  const search = searchParams.get('q')?.trim() || undefined;
  const subcategory = searchParams.get('subcategory')?.trim() || undefined;
  const sort = (searchParams.get('sort') as InventorySortMode) || 'relevance';

  const isClientUser =
    isAuthenticated && profile?.client !== null && profile?.client !== undefined;
  const browserGeo = usePublicBrowserGeo(!isAuthenticated);
  const { subCategories } = useFoodSubCategories();

  const {
    inventoryItems,
    loading,
    loadingMore,
    error,
    pagination,
  } = useInventoryItems({
    food_only: true,
    page,
    limit: PAGE_SIZE,
    search,
    subcategory,
    sort,
    anonymousOrigin: browserGeo,
  });

  useEffect(() => {
    setPage(1);
  }, [search, subcategory, sort]);

  const updateParam = useCallback(
    (key: string, value?: string) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleSearchSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      updateParam('q', searchDraft.trim() || undefined);
    },
    [searchDraft, updateParam]
  );

  const variantFlow = useCatalogVariantFlow({
    onCartBuilt: (cartItem) => addToCart(cartItem),
    requireAuth: () => {
      if (!isAuthenticated) {
        void loginWithRedirect();
        return false;
      }
      return true;
    },
  });

  const handleOrderClick = useCallback(
    (item: InventoryItem, selectionId?: string | null) => {
      variantFlow.requestOrder(item, selectionId);
    },
    [variantFlow]
  );

  const handleAddToCart = useCallback(
    (item: InventoryItem, selectionId?: string | null) => {
      variantFlow.requestAddToCart(item, selectionId);
    },
    [variantFlow]
  );

  const formatCurrency = useCallback((amount: number, currency = 'XAF') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }, []);

  const totalPages = pagination?.totalPages ?? 1;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || page >= totalPages || loading || loadingMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setPage((prev) => prev + 1);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [page, totalPages, loading, loadingMore]);

  const hasFilters = Boolean(search || subcategory);
  const showEmptyState = !loading && inventoryItems.length === 0;

  const sortChips = useMemo(
    () =>
      FOOD_SORTS.map((option) => (
        <Chip
          key={option.value}
          label={t(option.labelKey, option.fallback)}
          onClick={() =>
            updateParam(
              'sort',
              option.value === 'relevance' ? undefined : option.value
            )
          }
          color={sort === option.value ? 'primary' : 'default'}
          variant={sort === option.value ? 'filled' : 'outlined'}
          size="small"
        />
      )),
    [sort, t, updateParam]
  );

  return (
    <>
      <SEOHead
        title={t('foods.seo.title', 'Order food from local restaurants')}
        description={t(
          'foods.seo.description',
          'Browse cooked meals from restaurants near you and order while the kitchen is open.'
        )}
      />
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <FoodsMenuHero />

        <Stack spacing={2} sx={{ mb: 3 }}>
          <Box component="form" onSubmit={handleSearchSubmit}>
            <TextField
              fullWidth
              size="small"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={t('foods.searchPlaceholder', 'Search dishes')}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{sortChips}</Box>

          {subCategories.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={t('foods.allDishes', 'All dishes')}
                onClick={() => updateParam('subcategory', undefined)}
                color={!subcategory ? 'primary' : 'default'}
                variant={!subcategory ? 'filled' : 'outlined'}
                size="small"
              />
              {subCategories.map((option) => (
                <Chip
                  key={option.id}
                  label={option.name}
                  onClick={() => updateParam('subcategory', option.name)}
                  color={subcategory === option.name ? 'primary' : 'default'}
                  variant={subcategory === option.name ? 'filled' : 'outlined'}
                  size="small"
                />
              ))}
            </Box>
          )}
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && inventoryItems.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : showEmptyState ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <FoodsEmptyStateIllustration />
            <Typography variant="h6" sx={{ mt: 2 }}>
              {hasFilters
                ? t('foods.empty.noMatches', 'No dishes match your search')
                : t('foods.empty.noDishes', 'No restaurants near you yet')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {hasFilters
                ? t(
                    'foods.empty.tryAgain',
                    'Try another dish name or clear the filters.'
                  )
                : t(
                    'foods.empty.checkBack',
                    'Check back soon as restaurants join the platform.'
                  )}
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={FOODS_GRID_SX}>
              {inventoryItems.map((inventoryItem) => (
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

            {page < totalPages && (
              <Box ref={sentinelRef} sx={{ height: 1, width: '100%' }} />
            )}
            {loadingMore && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={28} />
              </Box>
            )}
          </>
        )}
      </Container>

      <CatalogVariantPickerDialog
        open={variantFlow.pickerOpen}
        item={variantFlow.pickerItem}
        onClose={variantFlow.closePicker}
        onConfirm={variantFlow.onPickerConfirm}
        confirmLabel={variantFlow.confirmLabel}
        formatCurrency={formatCurrency}
      />
    </>
  );
};

export default FoodsPage;
