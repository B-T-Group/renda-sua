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
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useCart } from '../../contexts/CartContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  InventoryItem,
  useInventoryItems,
} from '../../hooks/useInventoryItems';
import { useCatalogStore } from '../../hooks/useCatalogStores';
import { usePublicBrowserGeo } from '../../hooks/usePublicBrowserGeo';
import { useTrackItemView } from '../../hooks/useTrackItemView';
import { useLoginMethodDialog } from '../../hooks/useLoginMethodDialog';
import DashboardItemCard from '../common/DashboardItemCard';
import SEOHead from '../seo/SEOHead';

const ITEMS_PER_PAGE = 24;

const StorePage: React.FC = () => {
  const { businessId } = useParams<{ businessId: string }>();
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
  const isOwnerPreview =
    previewMode &&
    Boolean(profile?.business?.id) &&
    profile?.business?.id === businessId;

  const { store, loading: storeLoading, error: storeError } = useCatalogStore(
    businessId,
    {
      include_unavailable: isOwnerPreview,
      owner_preview: isOwnerPreview,
      anonymousOrigin: browserGeo,
    }
  );

  const { inventoryItems, loading, error, pagination } = useInventoryItems({
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    is_active: true,
    business_id: businessId,
    include_unavailable: isOwnerPreview ? true : undefined,
    owner_preview: isOwnerPreview,
    anonymousOrigin: browserGeo,
  });

  const { trackView } = useTrackItemView(null);

  const formatCurrency = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
      amount
    );

  const handleOrderClick = (item: InventoryItem) => {
    trackView(item.id);
    if (!isAuthenticated) {
      openLoginDialog();
      return;
    }
    window.location.href = `/items/${item.id}/place_order`;
  };

  const handleAddToCart = (item: InventoryItem) => {
    trackView(item.id);
    if (!isAuthenticated) {
      openLoginDialog();
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
      },
    });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/store/${businessId}`;
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
  const isEmpty = !loading && inventoryItems.length === 0;

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
            p: 2.5,
            mb: 3,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            {store?.logo_url ? (
              <Box
                component="img"
                src={store.logo_url}
                alt={name}
                sx={{ width: 72, height: 72, objectFit: 'contain' }}
              />
            ) : (
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: 2,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 28,
                }}
              >
                {storeLoading ? (
                  <StorefrontOutlinedIcon />
                ) : (
                  name.slice(0, 1).toUpperCase()
                )}
              </Box>
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
              <Button size="small" variant="outlined" onClick={() => void handleShare()}>
                {t('stores.share', 'Share store')}
              </Button>
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

      {!loading && inventoryItems.length === 0 && !previewMode ? (
        <Typography color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
          {t(
            'stores.catalogEmpty',
            'No products available in this store right now.'
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
    </Container>
  );
};

export default StorePage;
