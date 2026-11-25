import SearchIcon from '@mui/icons-material/Search';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useCart } from '../../contexts/CartContext';
import type { CartItem } from '../../contexts/CartContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  InventoryItem,
  useInventoryItems,
} from '../../hooks/useInventoryItems';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import { useCatalogStore } from '../../hooks/useCatalogStores';
import { useStoreBrowseContext } from '../../hooks/useStoreBrowseContext';
import { usePublicBrowserGeo } from '../../hooks/usePublicBrowserGeo';
import { useTrackItemView } from '../../hooks/useTrackItemView';
import { useMetaAddToCartTrack } from '../../hooks/useMetaAddToCartTrack';
import { useLoginMethodDialog } from '../../hooks/useLoginMethodDialog';
import { useCatalogVariantFlow } from '../../hooks/useCatalogVariantFlow';
import {
  metaPixelContentCategoryFromItem,
  metaPixelGoogleProductCategoryFromItem,
} from '../../utils/metaPixelContentCategory';
import { composeStoreFeed } from '../../utils/composeStoreFeed';
import CatalogVariantPickerDialog from '../common/CatalogVariantPickerDialog';
import DashboardItemCard from '../common/DashboardItemCard';
import StoreFeedStop from '../store/StoreFeedStop';
import SEOHead from '../seo/SEOHead';
import { StoreDefaultAvatar } from '../illustrations/StoreDefaultAvatar';
import { storeAvatarPalette } from '../../utils/storeAvatarPalette';
import { formatDistanceKm } from '../../utils/formatDistanceKm';

const ITEMS_PER_PAGE = 24;
const SEARCH_DEBOUNCE_MS = 300;

const StorePage: React.FC = () => {
  const { businessId: locationOrBusinessId } = useParams<{
    businessId: string;
  }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const previewMode = useMemo(
    () => searchParams.get('preview') === '1',
    [searchParams]
  );
  const foodMenu = useMemo(
    () => searchParams.get('menu') === 'food',
    [searchParams]
  );
  const searchTerm = useMemo(
    () => searchParams.get('search') ?? '',
    [searchParams]
  );
  const categoryFilter = useMemo(
    () => searchParams.get('category') ?? '',
    [searchParams]
  );
  const collectionFilter = useMemo(
    () => searchParams.get('collection') ?? '',
    [searchParams]
  );
  const sortFilter = useMemo(
    () => searchParams.get('sort') ?? '',
    [searchParams]
  );
  const { t } = useTranslation();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const isSmUp = useMediaQuery(theme.breakpoints.up('sm'));
  const gridColumns = isMdUp ? 3 : isSmUp ? 2 : 1;
  const productsPerChunk = gridColumns * 2;
  const { isAuthenticated } = useSessionAuth();
  const { openLoginDialog, loginMethodDialog } = useLoginMethodDialog();
  const { profile } = useUserProfileContext();
  const { addToCart } = useCart();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState(searchTerm);
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const browserGeo = usePublicBrowserGeo(true);
  const isClientUser = profile?.user_type_id === 'client';
  const wantsOwnerPreview =
    previewMode && Boolean(profile?.business?.id);

  useEffect(() => {
    setSearchDraft(searchTerm);
    setDebouncedSearch(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchDraft.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set('search', debouncedSearch);
    else next.delete('search');
    if (next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, searchParams, setSearchParams]);

  const { store, loading: storeLoading, error: storeError } = useCatalogStore(
    locationOrBusinessId,
    {
      owner_preview: wantsOwnerPreview,
      anonymousOrigin: browserGeo,
    }
  );

  const isOwnerPreview =
    wantsOwnerPreview &&
    Boolean(store?.business_id) &&
    profile?.business?.id === store?.business_id;

  const { locations: previewLocations } = useBusinessLocations(
    wantsOwnerPreview ? profile?.business?.id : undefined
  );

  const handlePreviewLocationChange = (event: SelectChangeEvent<string>) => {
    const nextLocationId = event.target.value;
    if (!nextLocationId || nextLocationId === store?.business_location_id) {
      return;
    }
    setCurrentPage(1);
    const preview = 'preview=1';
    const menu = foodMenu ? '&menu=food' : '';
    navigate(`/store/${nextLocationId}?${preview}${menu}`);
  };

  const storeMatchesRoute =
    Boolean(store) &&
    (store?.business_location_id === locationOrBusinessId ||
      store?.business_id === locationOrBusinessId);

  const {
    context: browseContext,
  } = useStoreBrowseContext({
    businessId: storeMatchesRoute ? locationOrBusinessId : undefined,
    foodOnly: foodMenu,
    ownerPreview: isOwnerPreview,
    enabled: storeMatchesRoute,
  });

  const {
    inventoryItems,
    loading,
    loadingMore,
    error,
    pagination,
  } = useInventoryItems({
    enabled: Boolean(storeMatchesRoute && store?.business_location_id),
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    is_active: true,
    business_location_id: storeMatchesRoute
      ? store?.business_location_id
      : undefined,
    ...(isOwnerPreview && store?.business_id
      ? {
          business_id: store.business_id,
          include_unavailable: true,
          owner_preview: true,
        }
      : {}),
    anonymousOrigin: browserGeo,
    ...(foodMenu && { food_only: true }),
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(categoryFilter && { category: categoryFilter }),
    ...(collectionFilter && { collection: collectionFilter }),
    ...(sortFilter === 'deals' && { sort: 'deals' }),
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearch,
    categoryFilter,
    collectionFilter,
    sortFilter,
    store?.business_location_id,
    foodMenu,
  ]);

  const totalPages = pagination?.totalPages ?? 0;
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const pageAdvanceLockRef = useRef(false);

  useEffect(() => {
    if (!loadingMore) pageAdvanceLockRef.current = false;
  }, [loadingMore]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry?.isIntersecting &&
          !loading &&
          !loadingMore &&
          !pageAdvanceLockRef.current &&
          currentPage < totalPages
        ) {
          pageAdvanceLockRef.current = true;
          setCurrentPage((p) => p + 1);
        }
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, loadingMore, currentPage, totalPages]);

  const suppressStops =
    debouncedSearch.length > 0 ||
    categoryFilter.length > 0 ||
    collectionFilter.length > 0 ||
    sortFilter === 'deals';

  const feedRows = useMemo(
    () =>
      composeStoreFeed({
        inventoryItems,
        productsPerChunk,
        suppressStops,
        deals: browseContext?.deals ?? [],
        popular: browseContext?.popular ?? [],
        collections: browseContext?.collections ?? [],
      }),
    [inventoryItems, productsPerChunk, suppressStops, browseContext]
  );

  const setStoreQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (!value) next.delete(key);
        else next.set(key, value);
      });
      setCurrentPage(1);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const { trackView } = useTrackItemView(null);
  const trackAddToCart = useMetaAddToCartTrack();

  const formatCurrency = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
      amount
    );

  const onCartBuilt = useCallback(
    (cartItem: CartItem, item: InventoryItem) => {
      const unitPrice = cartItem.itemData.price;
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
        ...cartItem,
        itemData: {
          ...cartItem.itemData,
          ...(contentCategory && { contentCategory }),
          ...(googleCategory && { googleProductCategory: googleCategory }),
        },
      });
    },
    [addToCart, trackAddToCart]
  );

  const variantFlow = useCatalogVariantFlow({
    onCartBuilt,
    requireAuth: (run) => {
      if (!isAuthenticated) {
        openLoginDialog();
        return false;
      }
      void run();
      return true;
    },
  });

  const handleOrderClick = (
    item: InventoryItem,
    selectionId?: string | null
  ) => {
    trackView(item.id);
    variantFlow.requestOrder(item, selectionId);
  };

  const handleAddToCart = (
    item: InventoryItem,
    selectionId?: string | null
  ) => {
    trackView(item.id);
    variantFlow.requestAddToCart(item, selectionId);
  };

  const handleShare = async () => {
    const shareId =
      store?.business_location_id ?? locationOrBusinessId;
    const name = store?.name?.trim() || t('stores.unnamed', 'Store');
    const { shareStorefront } = await import('../../utils/shareStorefront');
    try {
      await shareStorefront({
        businessId: shareId,
        name,
        shareMessage: t(
          'stores.shareMessage',
          'Check out {{name}} on Rendasua: {{url}}',
          { name, url: `${window.location.origin}/store/${shareId}` }
        ),
      });
    } catch {
      // user cancelled
    }
  };

  const name = store?.name?.trim() || t('stores.unnamed', 'Store');
  const openingSoon =
    !!store?.is_storefront_visible && !store?.can_accept_orders;
  const catalogLoading = storeLoading || loading;
  const isEmpty = !catalogLoading && inventoryItems.length === 0;
  const palette = storeAvatarPalette(name);
  const distanceKm = formatDistanceKm(store?.distance_meters);
  const catalogCount = store?.item_count ?? pagination?.total ?? 0;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <SEOHead
        title={t('stores.seoTitle', '{{name}} | Rendasua', { name })}
        description={t(
          'stores.seoDescription',
          'Shop products from {{name}} on Rendasua.',
          { name }
        )}
      />
      {loginMethodDialog}

      {isOwnerPreview ? (
        <Alert
          severity="info"
          icon={<VisibilityOutlinedIcon />}
          sx={{ mb: 2 }}
        >
          <Typography variant="body2" sx={{ mb: previewLocations.length > 1 ? 1.5 : 0 }}>
            {t(
              'stores.previewBanner',
              'This is how customers see your store.'
            )}
          </Typography>
          {previewLocations.length > 1 ? (
            <FormControl size="small" fullWidth sx={{ maxWidth: 360, mt: 0.5 }}>
              <InputLabel id="store-preview-location-label">
                {t('stores.previewLocation', 'Preview location')}
              </InputLabel>
              <Select
                labelId="store-preview-location-label"
                label={t('stores.previewLocation', 'Preview location')}
                value={store?.business_location_id ?? ''}
                onChange={handlePreviewLocationChange}
              >
                {previewLocations.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {loc.name}
                    {loc.is_primary
                      ? ` (${t('business.locations.primary', 'Primary')})`
                      : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
        </Alert>
      ) : null}

      {storeError && !store ? (
        <Alert severity="error">{storeError}</Alert>
      ) : (
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            border: 1,
            borderColor: alpha(palette.bg, 0.25),
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: 96,
              background: `linear-gradient(135deg, ${palette.bgSoft} 0%, ${alpha(palette.accent, 0.35)} 55%, ${palette.bgSoft} 100%)`,
              position: 'relative',
              borderBottom: `1px solid ${alpha(palette.accent, 0.35)}`,
            }}
          >
            <StorefrontOutlinedIcon
              sx={{
                position: 'absolute',
                right: 20,
                top: 16,
                fontSize: 72,
                color: alpha(palette.bg, 0.2),
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                left: 20,
                bottom: 14,
                display: 'flex',
                gap: 0.75,
              }}
            >
              {[palette.accent, palette.bg, palette.accentSoft].map((c) => (
                <Box
                  key={c}
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: c,
                  }}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              {store?.logo_url ? (
                <Box
                  component="img"
                  src={store.logo_url}
                  alt={name}
                  sx={{
                    width: 80,
                    height: 80,
                    objectFit: 'contain',
                    borderRadius: 2,
                    border: `2px solid ${alpha(palette.bg, 0.3)}`,
                    bgcolor: 'common.white',
                  }}
                />
              ) : storeLoading ? (
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: 2,
                    bgcolor: alpha(palette.bg, 0.12),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: palette.bg,
                  }}
                >
                  <StorefrontOutlinedIcon />
                </Box>
              ) : (
                <StoreDefaultAvatar name={name} size={80} />
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h4" fontWeight={800} gutterBottom>
                  {storeLoading ? '…' : name}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: distanceKm ? 0.5 : 1 }}
                >
                  {foodMenu
                    ? t('foods.restaurants.dishCount', '{{count}} dishes', {
                        count: pagination?.total ?? catalogCount,
                      })
                    : t('stores.itemCount', '{{count}} items', {
                        count: catalogCount,
                      })}
                </Typography>
                {distanceKm ? (
                  <Typography
                    variant="body2"
                    color="primary.main"
                    fontWeight={600}
                    sx={{ mb: 1 }}
                  >
                    {t('foods.distanceFromYou', '{{km}} km from you', {
                      km: distanceKm,
                    })}
                  </Typography>
                ) : null}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                  {store?.is_verified ? (
                    <Chip
                      size="small"
                      color="success"
                      label={t('stores.verified', 'Verified')}
                    />
                  ) : null}
                  {openingSoon ? (
                    <Chip
                      size="small"
                      color="warning"
                      label={t(
                        'business.lifecycle.openingSoonBadge',
                        'Opening Soon'
                      )}
                    />
                  ) : null}
                  {isOwnerPreview && store && !store.is_storefront_visible ? (
                    <Chip
                      size="small"
                      color="warning"
                      label={t(
                        'stores.notVisibleYet',
                        'Not visible to customers yet'
                      )}
                    />
                  ) : null}
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => void handleShare()}
                    sx={{
                      bgcolor: palette.bg,
                      '&:hover': {
                        bgcolor: palette.bg,
                        filter: 'brightness(0.92)',
                      },
                    }}
                  >
                    {t('stores.share', 'Share store')}
                  </Button>
                  {isOwnerPreview ? (
                    <Button
                      size="small"
                      variant="outlined"
                      component={RouterLink}
                      to={
                        store?.business_location_id
                          ? `/business/items?location=${encodeURIComponent(store.business_location_id)}`
                          : '/business/items'
                      }
                    >
                      {t('stores.manageItems', 'Manage items')}
                    </Button>
                  ) : null}
                </Box>
              </Box>
            </Box>

          {isOwnerPreview && isEmpty ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography fontWeight={700} gutterBottom>
                {t('stores.previewEmptyTitle', 'Your store looks empty')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t(
                  'stores.previewEmptyBody',
                  'Add products with photos and stock so customers have something to browse.'
                )}
              </Typography>
              <Button
                component={RouterLink}
                to={
                  store?.business_location_id
                    ? `/business/items/add-from-image?location=${encodeURIComponent(store.business_location_id)}`
                    : '/business/items/add-from-image'
                }
                variant="contained"
                size="small"
              >
                {t('stores.addProducts', 'Add products')}
              </Button>
            </Alert>
          ) : null}

          {isOwnerPreview && !isEmpty ? (
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {inventoryItems.some(
                (i) => !(i.item.item_images?.length > 0)
              ) ? (
                <Typography variant="body2" color="warning.main">
                  {t(
                    'stores.completenessPhotos',
                    'Some products are missing photos'
                  )}
                </Typography>
              ) : null}
              {inventoryItems.some(
                (i) => (i.computed_available_quantity ?? 0) <= 0
              ) ? (
                <Typography variant="body2" color="warning.main">
                  {t(
                    'stores.completenessStock',
                    'Some products are out of stock'
                  )}
                </Typography>
              ) : null}
              {store && !store.is_storefront_visible ? (
                <Typography variant="body2" color="warning.main">
                  {t(
                    'stores.completenessHidden',
                    'Your storefront is not visible to customers yet'
                  )}
                </Typography>
              ) : null}
            </Box>
          ) : null}
          </Box>
        </Paper>
      )}

      <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
        {t('stores.catalogTitle', 'Products')}
      </Typography>

      <TextField
        fullWidth
        size="small"
        value={searchDraft}
        onChange={(event) => setSearchDraft(event.target.value)}
        placeholder={t(
          'stores.catalogSearchPlaceholder',
          'Search this store…'
        )}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 1.5 }}
      />

      {(browseContext?.categories.length ?? 0) > 0 ? (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            overflowX: 'auto',
            pb: 1,
            mb: 2,
            scrollbarWidth: 'thin',
          }}
        >
          <Chip
            label={t('stores.allCategories', 'All')}
            color={!categoryFilter ? 'primary' : 'default'}
            variant={!categoryFilter ? 'filled' : 'outlined'}
            onClick={() => setStoreQuery({ category: null })}
          />
          {browseContext?.categories.map((category) => {
            const selected = categoryFilter === category.name;
            return (
              <Chip
                key={category.id}
                label={category.name}
                color={selected ? 'primary' : 'default'}
                variant={selected ? 'filled' : 'outlined'}
                onClick={() =>
                  setStoreQuery({
                    category: selected ? null : category.name,
                  })
                }
              />
            );
          })}
        </Box>
      ) : null}

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {feedRows.map((row) => {
          if (row.type === 'stop') {
            return (
              <StoreFeedStop
                key={row.stop.id}
                stop={row.stop}
                formatCurrency={formatCurrency}
                onOrderClick={handleOrderClick}
                onAddToCart={handleAddToCart}
                onSeeAllDeals={() => setStoreQuery({ sort: 'deals' })}
                onCollectionClick={(slug) =>
                  setStoreQuery({ collection: slug })
                }
                isPublicView={!isAuthenticated}
                canOrder={!isAuthenticated || isClientUser}
                showCartButtons={isAuthenticated && isClientUser}
              />
            );
          }
          return (
            <Box
              key={row.id}
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(3, 1fr)',
                },
              }}
            >
              {row.items.map((item) => (
                <DashboardItemCard
                  key={item.id}
                  item={item}
                  formatCurrency={formatCurrency}
                  onOrderClick={handleOrderClick}
                  onAddToCart={handleAddToCart}
                  isPublicView={!isAuthenticated}
                  canOrder={!isAuthenticated || isClientUser}
                  showCartButtons={isAuthenticated && isClientUser}
                />
              ))}
            </Box>
          );
        })}
      </Box>

      {!catalogLoading && inventoryItems.length === 0 && !previewMode ? (
        <Typography color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
          {t(
            'stores.catalogEmpty',
            'No products available at this location right now.'
          )}
        </Typography>
      ) : null}

      {loadingMore ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={28} />
        </Box>
      ) : null}
      <Box ref={loadMoreSentinelRef} sx={{ height: 1, width: '100%' }} />

      <CatalogVariantPickerDialog
        open={variantFlow.pickerOpen}
        item={variantFlow.pickerItem}
        onClose={variantFlow.closePicker}
        onConfirm={variantFlow.onPickerConfirm}
        confirmLabel={variantFlow.confirmLabel}
        formatCurrency={formatCurrency}
      />
    </Container>
  );
};

export default StorePage;
