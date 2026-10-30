import {
  Alert,
  Box,
  Container,
  Pagination,
  Paper,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useCart } from '../../contexts/CartContext';
import type { CartItem } from '../../contexts/CartContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  InventoryItem,
  useInventoryItems,
} from '../../hooks/useInventoryItems';
import { useMarket } from '../../hooks/useMarket';
import { usePublicBrowserGeo } from '../../hooks/usePublicBrowserGeo';
import { useTrackItemView } from '../../hooks/useTrackItemView';
import { useMetaAddToCartTrack } from '../../hooks/useMetaAddToCartTrack';
import { useLoginMethodDialog } from '../../hooks/useLoginMethodDialog';
import { useCatalogVariantFlow } from '../../hooks/useCatalogVariantFlow';
import {
  metaPixelContentCategoryFromItem,
  metaPixelGoogleProductCategoryFromItem,
} from '../../utils/metaPixelContentCategory';
import CatalogVariantPickerDialog from '../common/CatalogVariantPickerDialog';
import DashboardItemCard from '../common/DashboardItemCard';
import ExportCatalogIllustration from '../illustrations/ExportCatalogIllustration';
import SEOHead from '../seo/SEOHead';
import { MarketSelector } from '../market/MarketSelector';

const ITEMS_PER_PAGE = 24;

export function hasCatalogItem(
  row: InventoryItem | undefined | null
): row is InventoryItem {
  return Boolean(row?.item);
}

export function buildExportAddToCartEvent(
  cartItem: CartItem,
  item: InventoryItem
) {
  const catalog = item.item;
  const unitPrice = cartItem.itemData.price;
  const quantity = cartItem.quantity || 1;
  const contentId = String(item.item_id || item.id);
  return {
    content_ids: [contentId],
    content_name: catalog?.name,
    content_type: 'product' as const,
    content_category: metaPixelContentCategoryFromItem(catalog),
    google_product_category: metaPixelGoogleProductCategoryFromItem(catalog),
    value: unitPrice * quantity,
    currency: cartItem.itemData.currency || catalog?.currency || 'XAF',
    contents: [{ id: contentId, quantity, item_price: unitPrice }],
  };
}

const ExportsPage: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useSessionAuth();
  const { openLoginDialog, loginMethodDialog } = useLoginMethodDialog();
  const { profile } = useUserProfileContext();
  const { addToCart } = useCart();
  const { selectedMarket } = useMarket();
  const [currentPage, setCurrentPage] = useState(1);
  const browserGeo = usePublicBrowserGeo(true);
  const isClientUser = profile?.user_type_id === 'client';

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMarket?.id]);

  const { inventoryItems, loading, error, pagination } = useInventoryItems({
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    is_active: true,
    export_only: true,
    anonymousOrigin: browserGeo,
  });

  const renderableItems = useMemo(
    () => inventoryItems.filter(hasCatalogItem),
    [inventoryItems]
  );

  const { trackView } = useTrackItemView(null);
  const trackAddToCart = useMetaAddToCartTrack();

  const formatCurrency = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
      amount
    );

  const onCartBuilt = useCallback(
    (cartItem: CartItem, item: InventoryItem) => {
      trackAddToCart(buildExportAddToCartEvent(cartItem, item));
      addToCart(cartItem);
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

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <SEOHead
        title={t('exportCatalog.pageTitle', 'Available for export')}
        description={t(
          'exportCatalog.pageSubtitle',
          'Browse goods available for export into this market. Submit interest and the seller will contact you.'
        )}
      />
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ExportCatalogIllustration size={72} />
          <Box>
            <Typography variant="h5" fontWeight={800}>
              {t('exportCatalog.pageTitle', 'Available for export')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                'exportCatalog.pageSubtitle',
                'Browse goods available for export into this market. Submit interest and the seller will contact you.'
              )}
            </Typography>
          </Box>
        </Box>
        <MarketSelector />
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {!loading && renderableItems.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <ExportCatalogIllustration size={120} />
          <Typography sx={{ mt: 2 }} color="text.secondary">
            {t('exportCatalog.empty', 'No export items for this market yet.')}
          </Typography>
        </Paper>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(1, 1fr)',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
            gap: 3,
          }}
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <Box key={i} />)
            : renderableItems.map((inventoryItem) => (
                <Box key={inventoryItem.id}>
                  <DashboardItemCard
                    item={inventoryItem}
                    formatCurrency={formatCurrency}
                    onOrderClick={handleOrderClick}
                    onAddToCart={handleAddToCart}
                    isPublicView={!isAuthenticated}
                    canOrder={!isAuthenticated || isClientUser}
                    showCartButtons={isAuthenticated && isClientUser}
                    loginButtonText={t(
                      'public.items.login',
                      'Sign In to Order'
                    )}
                    orderButtonText={t('common.orderNow', 'Order Now')}
                    addToCartButtonText={t('cart.addToCart', 'Add to Cart')}
                    buyNowButtonText={t('cart.buyNow', 'Buy Now')}
                  />
                </Box>
              ))}
        </Box>
      )}

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
      {loginMethodDialog}
    </Container>
  );
};

export default ExportsPage;
