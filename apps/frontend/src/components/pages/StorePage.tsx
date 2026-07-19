import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Pagination,
  Paper,
  Typography,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useCart } from '../../contexts/CartContext';
import type { CartItem } from '../../contexts/CartContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  InventoryItem,
  useInventoryItems,
} from '../../hooks/useInventoryItems';
import { useCatalogStore } from '../../hooks/useCatalogStores';
import { usePublicBrowserGeo } from '../../hooks/usePublicBrowserGeo';
import { useTrackItemView } from '../../hooks/useTrackItemView';
import { useMetaPixel } from '../../hooks/useMetaPixel';
import { useLoginMethodDialog } from '../../hooks/useLoginMethodDialog';
import { useCatalogVariantFlow } from '../../hooks/useCatalogVariantFlow';
import {
  metaPixelContentCategoryFromItem,
  metaPixelGoogleProductCategoryFromItem,
} from '../../utils/metaPixelContentCategory';
import CatalogVariantPickerDialog from '../common/CatalogVariantPickerDialog';
import DashboardItemCard from '../common/DashboardItemCard';
import SEOHead from '../seo/SEOHead';
import { StoreDefaultAvatar } from '../illustrations/StoreDefaultAvatar';
import { storeAvatarPalette } from '../../utils/storeAvatarPalette';
import { alpha } from '@mui/material/styles';

const ITEMS_PER_PAGE = 24;

const StorePage: React.FC = () => {
  const { businessId: locationOrBusinessId } = useParams<{
    businessId: string;
  }>();
  const location = useLocation();
  const previewMode = useMemo(
    () => new URLSearchParams(location.search).get('preview') === '1',
    [location.search]
  );
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth0();
  const { openLoginDialog, loginMethodDialog } = useLoginMethodDialog();
  const { profile } = useUserProfileContext();
  const { addToCart } = useCart();
  const [currentPage, setCurrentPage] = useState(1);
  const browserGeo = usePublicBrowserGeo(!isAuthenticated);
  const isClientUser = profile?.user_type_id === 'client';
  const wantsOwnerPreview =
    previewMode && Boolean(profile?.business?.id);

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

  const storeMatchesRoute =
    Boolean(store) &&
    (store?.business_location_id === locationOrBusinessId ||
      store?.business_id === locationOrBusinessId);

  const { inventoryItems, loading, error, pagination } = useInventoryItems({
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
  });

  const { trackView } = useTrackItemView(null);
  const { trackAddToCart } = useMetaPixel();

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
    requireAuth: () => {
      if (!isAuthenticated) {
        openLoginDialog();
        return false;
      }
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
    const url = `${window.location.origin}/store/${shareId}`;
    const name = store?.name?.trim() || t('stores.unnamed', 'Store');
    const text = t(
      'stores.shareMessage',
      'Check out {{name}} on Rendasua: {{url}}',
      { name, url }
    );
    if (navigator.share) {
      await navigator.share({ title: name, text, url });
      return;
    }
    await navigator.clipboard.writeText(url);
  };

  const name = store?.name?.trim() || t('stores.unnamed', 'Store');
  const openingSoon =
    !!store?.is_storefront_visible && !store?.can_accept_orders;
  const catalogLoading = storeLoading || loading;
  const isEmpty = !catalogLoading && inventoryItems.length === 0;
  const palette = storeAvatarPalette(name);

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
          {t(
            'stores.previewBanner',
            'This is how customers see your store.'
          )}
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
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('stores.itemCount', '{{count}} items', {
                    count: store?.item_count ?? pagination?.total ?? 0,
                  })}
                </Typography>
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
                      to="/business/items"
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
                to="/business/items/add-from-image"
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

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Box
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
        {inventoryItems.map((item) => (
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

      {!catalogLoading && inventoryItems.length === 0 && !previewMode ? (
        <Typography color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
          {t(
            'stores.catalogEmpty',
            'No products available at this location right now.'
          )}
        </Typography>
      ) : null}

      {pagination && pagination.totalPages > 1 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={pagination.totalPages}
            page={currentPage}
            onChange={(_, p) => setCurrentPage(p)}
            color="primary"
          />
        </Box>
      ) : null}
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
