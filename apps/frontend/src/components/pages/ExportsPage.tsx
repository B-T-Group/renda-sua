import { FlightTakeoff } from '@mui/icons-material';
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
import ItemCardSkeleton from '../common/ItemCardSkeleton';
import { RecentlyViewedRail } from '../catalog-experience/RecentlyViewedRail';
import { CatalogShortcutButton } from '../catalog/CatalogShortcutButton';
import ExportCatalogIllustration from '../illustrations/ExportCatalogIllustration';
import ExportSellersCarousel from '../exports/ExportSellersCarousel';
import { useExportSellers } from '../../hooks/useExportSellers';
import { useExportSellerTracking } from '../../hooks/useExportSellerTracking';
import {
  EXPORT_SELLERS_CAROUSEL_MAX,
  exportSellerPath,
  exportSellersListPath,
  exportsSummaryLine,
  type ExportSellersContext,
} from '../../utils/exportSellers';
import SEOHead from '../seo/SEOHead';
import ExportsDirectionBar from '../exports/ExportsDirectionBar';
import { useExportOrigins } from '../../hooks/useExportOrigins';

const ITEMS_PER_PAGE = 24;
const EXPORT_SKELETON_COUNT = 8;

const EXPORT_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(1, 1fr)',
    sm: 'repeat(2, 1fr)',
    md: 'repeat(3, 1fr)',
    lg: 'repeat(4, 1fr)',
  },
  gap: 3,
};

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
  const { origins } = useExportOrigins();

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMarket?.id]);

  const { inventoryItems, loading, error, pagination } = useInventoryItems({
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    is_active: true,
    export_only: true,
    pageMode: 'replace',
    anonymousOrigin: browserGeo,
  });

  const marketCode = selectedMarket?.countryCode ?? null;
  const sellerCtx = useMemo<ExportSellersContext>(
    () => ({ direction: 'into', marketCode, originCode: null }),
    [marketCode]
  );
  const sellerRows = useExportSellers({ ...sellerCtx, limit: EXPORT_SELLERS_CAROUSEL_MAX });
  const track = useExportSellerTracking(sellerCtx);
  const productTotal = pagination?.total ?? 0;

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
        component="header"
        data-testid="exports-into-header"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          mb: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FlightTakeoff sx={{ fontSize: 26 }} aria-hidden />
            <Typography variant="h5" component="h1" fontWeight={800} sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' } }}>
              {t('exportCatalog.pageTitle', 'Available for export')}
            </Typography>
          </Box>
          {!loading && productTotal > 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} data-testid="exports-into-summary">
              {exportsSummaryLine(t, productTotal, sellerRows.loading ? 0 : sellerRows.total)}
            </Typography>
          ) : null}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <CatalogShortcutButton
            label={t('catalogShortcut.myExports', 'My exports')}
            to="/export-orders"
            icon={<FlightTakeoff sx={{ fontSize: 22, color: 'primary.main' }} />}
            testId="catalog-my-exports"
          />
          <ExportsDirectionBar direction="into" origins={origins} />
        </Box>
      </Box>

      <ExportSellersCarousel
        sellers={sellerRows.sellers}
        total={sellerRows.total}
        loading={sellerRows.loading}
        sellerHref={(seller) => exportSellerPath(sellerCtx, seller.business_location_id)}
        listHref={exportSellersListPath(sellerCtx)}
        onViewed={(shown, total) => track('exports_sellers_carousel_viewed', { shown, total })}
        onSellerClick={(seller, position) =>
          track('exports_seller_card_tapped', {
            location_id: seller.business_location_id,
            position,
            item_count: seller.item_count,
          })
        }
        onMoreClick={(source) => track('exports_sellers_more_tapped', { source, total: sellerRows.total })}
      />

      <RecentlyViewedRail
        surface="export"
        actions={{
          formatCurrency,
          onOrderClick: handleOrderClick,
          onAddToCart: handleAddToCart,
          isPublicView: !isAuthenticated,
          canOrder: !isAuthenticated || isClientUser,
          showCartButtons: isAuthenticated && isClientUser,
          loginButtonText: t('public.items.login', 'Sign In to Order'),
          orderButtonText: t('common.orderNow', 'Order Now'),
          addToCartButtonText: t('cart.addToCart', 'Add to Cart'),
          buyNowButtonText: t('cart.buyNow', 'Buy Now'),
        }}
      />

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Box
          sx={EXPORT_GRID_SX}
          aria-busy="true"
          aria-label={t('public.items.results.loading', 'Loading items…')}
        >
          {Array.from({ length: EXPORT_SKELETON_COUNT }).map((_, i) => (
            <Box key={i} sx={{ minWidth: 0 }}>
              <ItemCardSkeleton />
            </Box>
          ))}
        </Box>
      ) : renderableItems.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <ExportCatalogIllustration size={120} />
          <Typography sx={{ mt: 2 }} color="text.secondary">
            {t('exportCatalog.empty', 'No export items for this market yet.')}
          </Typography>
        </Paper>
      ) : (
        <Box sx={EXPORT_GRID_SX}>
          {renderableItems.map((inventoryItem) => (
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

      {!loading && pagination && pagination.totalPages > 1 ? (
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
