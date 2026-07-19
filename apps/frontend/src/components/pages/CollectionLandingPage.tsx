import {
  Alert,
  Box,
  Container,
  Pagination,
  Paper,
  Typography,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useCart } from '../../contexts/CartContext';
import type { CartItem } from '../../contexts/CartContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  InventoryItem,
  useInventoryItems,
} from '../../hooks/useInventoryItems';
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
import { useCollections } from '../../hooks/useCollections';

const ITEMS_PER_PAGE = 24;

const CollectionLandingPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth0();
  const { openLoginDialog, loginMethodDialog } = useLoginMethodDialog();
  const { profile } = useUserProfileContext();
  const { addToCart } = useCart();
  const [currentPage, setCurrentPage] = useState(1);
  const browserGeo = usePublicBrowserGeo(!isAuthenticated);
  const isClientUser = profile?.user_type_id === 'client';

  const { collections, loading: metaLoading } = useCollections({
    enabled: Boolean(slug),
    anonymousOrigin: browserGeo,
  });
  const collectionMeta = useMemo(
    () => collections.find((c) => c.slug === slug),
    [collections, slug]
  );

  const { inventoryItems, loading, error, pagination } = useInventoryItems({
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    is_active: true,
    collection: slug,
    anonymousOrigin: browserGeo,
  });

  const { trackView } = useTrackItemView(null);
  const { trackAddToCart } = useMetaPixel();

  const formatCurrency = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

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

  const handleOrderClick = (item: InventoryItem) => {
    trackView(item.id);
    variantFlow.requestOrder(item);
  };

  const handleAddToCart = (item: InventoryItem) => {
    trackView(item.id);
    variantFlow.requestAddToCart(item);
  };

  const title =
    collectionMeta?.name ??
    slug?.replace(/-/g, ' ') ??
    t('collections.landing', 'Collection');

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4, px: { xs: 1, sm: 2 } }}>
      <SEOHead
        title={title}
        description={
          collectionMeta?.description ??
          t('collections.landingDescription', 'Browse products in this collection')
        }
      />
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          {title}
        </Typography>
        {collectionMeta?.description ? (
          <Typography variant="body1" color="text.secondary">
            {collectionMeta.description}
          </Typography>
        ) : null}
      </Paper>
      {error ? (
        <Alert severity="error">{t('common.errorLoadingData', 'Error loading data')}</Alert>
      ) : null}
      {(loading || metaLoading) && inventoryItems.length === 0 ? (
        <Typography>{t('common.loading', 'Loading...')}</Typography>
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
          gap: 2,
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
            loginButtonText={t('public.items.login', 'Sign In to Order')}
            orderButtonText={t('common.orderNow', 'Order Now')}
            addToCartButtonText={t('cart.addToCart', 'Add to Cart')}
            buyNowButtonText={t('cart.buyNow', 'Buy Now')}
          />
        ))}
      </Box>
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
      {loginMethodDialog}
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

export default CollectionLandingPage;
