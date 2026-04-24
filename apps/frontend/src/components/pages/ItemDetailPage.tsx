import {
  ArrowBack as ArrowBackIcon,
  Business as BusinessIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  Inventory2 as SpecsIcon,
  ShoppingCart,
  Verified,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  ButtonBase,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Container,
  Dialog,
  DialogContent,
  Divider,
  Grid,
  IconButton,
  Link,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useAuth0 } from '@auth0/auth0-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import NoImage from '../../assets/no-image.svg';
import { useCart } from '../../contexts/CartContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useInventoryItem } from '../../hooks/useInventoryItem';
import { useMetaPixel } from '../../hooks/useMetaPixel';
import {
  metaPixelContentCategoryFromItem,
  metaPixelGoogleProductCategoryFromItem,
} from '../../utils/metaPixelContentCategory';
import { useSwipeImageNavigation } from '../../hooks/useSwipeImageNavigation';
import type { InventoryItem } from '../../hooks/useInventoryItem';
import { useItemRatings } from '../../hooks/useItemRatings';
import { useSimilarItems } from '../../hooks/useSimilarItems';
import {
  SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK,
  SITE_EVENT_INVENTORY_CONTACT_BEFORE_BUY_CLICK,
  SITE_EVENT_INVENTORY_FAQ_TOGGLE,
  SITE_EVENT_INVENTORY_ORDER_NOW_CLICK,
  SITE_EVENT_INVENTORY_RATING_SUMMARY_CLICK,
  SITE_EVENT_SUBJECT_INVENTORY_ITEM,
  useTrackSiteEvent,
} from '../../hooks/useTrackSiteEvent';
import { useTrackItemView } from '../../hooks/useTrackItemView';
import { useItemOrderStats } from '../../hooks/useItemOrderStats';
import { CmAcceptedPaymentLogos } from '../common/CmAcceptedPaymentLogos';
import { ItemDetailDealCountdown } from '../common/ItemDetailDealCountdown';
import { ItemDetailFaqAccordion } from '../common/ItemDetailFaqAccordion';
import { ItemDetailHowItWorks } from '../common/ItemDetailHowItWorks';
import { ItemDetailRatingSummary } from '../common/ItemDetailRatingSummary';
import { ItemDetailScarcityBadge } from '../common/ItemDetailScarcityBadge';
import { ItemDetailSocialProof } from '../common/ItemDetailSocialProof';
import { ItemDetailTrustStrip } from '../common/ItemDetailTrustStrip';
import { ImageLightboxTapZones } from '../common/ImageLightboxTapZones';
import { MobileMoneyOrderIcon } from '../common/MobileMoneyOrderIcon';
import OrderRatingsDisplay from '../common/OrderRatingsDisplay';
import PageShareMenu from '../common/PageShareMenu';
import AnonymousBuyNowDialog from '../dialogs/AnonymousBuyNowDialog';
import SEOHead from '../seo/SEOHead';
import { buildInventoryItemSeoShareUrl } from '../../utils/buildInventoryItemSeoShareUrl';
import { orderedItemImages } from '../../utils/orderedItemImages';

const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

const SEO_DESC_MAX = 160;

function clientOrigin(): string {
  if (typeof window === 'undefined') return 'https://rendasua.com';
  return window.location.origin;
}

function toAbsoluteUrl(origin: string, url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `${origin}${u.startsWith('/') ? '' : '/'}${u}`;
}

function plainDescription(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncateSeoText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function salePriceForInventory(inv: InventoryItem): number {
  const hasDeal =
    inv.hasActiveDeal &&
    typeof inv.original_price === 'number' &&
    typeof inv.discounted_price === 'number' &&
    inv.original_price > 0;
  return hasDeal ? inv.discounted_price! : inv.selling_price;
}

function availabilitySchemaUrl(inv: InventoryItem): string {
  const inStock = inv.computed_available_quantity > 0 && inv.is_active;
  return inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
}

function collectProductImageUrls(origin: string, inv: InventoryItem): string[] | undefined {
  const urls = orderedItemImages(inv.item.item_images ?? [])
    .map((img) => toAbsoluteUrl(origin, img.image_url))
    .filter((u): u is string => Boolean(u));
  return urls.length > 0 ? urls : undefined;
}

function buildOfferLd(inv: InventoryItem, pageUrl: string): object {
  const sellerName = inv.business_location?.business?.name;
  return {
    '@type': 'Offer',
    url: pageUrl,
    priceCurrency: inv.item.currency,
    price: String(salePriceForInventory(inv)),
    availability: availabilitySchemaUrl(inv),
    ...(sellerName
      ? { seller: { '@type': 'Organization', name: sellerName } }
      : {}),
  };
}

function buildProductLdNode(
  origin: string,
  id: string,
  inv: InventoryItem,
  descriptionFallback: string
): Record<string, unknown> {
  const item = inv.item;
  const pageUrl = `${origin}/items/${id}`;
  const shortDesc = truncateSeoText(
    plainDescription(item.description) || descriptionFallback,
    SEO_DESC_MAX
  );
  const product: Record<string, unknown> = {
    '@type': 'Product',
    name: item.name,
    description: shortDesc,
    url: pageUrl,
    sku: item.sku?.trim() || undefined,
    image: collectProductImageUrls(origin, inv),
  };
  if (item.brand?.name) {
    product.brand = { '@type': 'Brand', name: item.brand.name };
  }
  product.offers = buildOfferLd(inv, pageUrl);
  return product;
}

function buildBreadcrumbLdNode(
  origin: string,
  id: string,
  itemName: string,
  catalogLabel: string
): object {
  const pageUrl = `${origin}/items/${id}`;
  const catalogUrl = `${origin}/items`;
  const elements = [
    { '@type': 'ListItem', position: 1, name: catalogLabel, item: catalogUrl },
    { '@type': 'ListItem', position: 2, name: itemName, item: pageUrl },
  ];
  return { '@type': 'BreadcrumbList', itemListElement: elements };
}

function buildItemJsonLd(
  origin: string,
  id: string,
  inv: InventoryItem,
  catalogLabel: string,
  descriptionFallback: string
): object {
  const product = buildProductLdNode(origin, id, inv, descriptionFallback);
  const breadcrumb = buildBreadcrumbLdNode(
    origin,
    id,
    inv.item.name,
    catalogLabel
  );
  return { '@context': 'https://schema.org', '@graph': [product, breadcrumb] };
}

type ItemDetailMobileOrderBarProps = {
  visible: boolean;
  priceText: string;
  orderLabel: string;
  deliveryHint: string;
  topRow?: React.ReactNode;
  questionSlot?: React.ReactNode;
  onOrder: () => void;
};

function ItemDetailMobileOrderBar({
  visible,
  priceText,
  orderLabel,
  deliveryHint,
  topRow,
  questionSlot,
  onOrder,
}: ItemDetailMobileOrderBarProps) {
  const navRef = React.useRef<HTMLDivElement | null>(null);
  const [shouldPulse, setShouldPulse] = React.useState(false);

  React.useEffect(() => {
    if (!visible) return;
    const el = navRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let didPulse = false;
    const obs = new IntersectionObserver(
      (entries) => {
        if (didPulse) return;
        if (entries.some((e) => e.isIntersecting)) {
          didPulse = true;
          setShouldPulse(true);
          window.setTimeout(() => setShouldPulse(false), 750);
          obs.disconnect();
        }
      },
      { threshold: 0.6 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);
  if (!visible) return null;
  return (
    <Paper
      component="nav"
      aria-label={`${orderLabel}. ${deliveryHint}`}
      elevation={12}
      ref={navRef}
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        px: 2,
        py: 1,
        pt: 0.75,
        borderRadius: 0,
        borderTop: 1,
        borderColor: 'divider',
        backgroundImage: (theme) =>
          `linear-gradient(180deg, ${alpha(
            theme.palette.background.paper,
            0.98
          )} 0%, ${theme.palette.background.paper} 100%)`,
        backdropFilter: 'saturate(1.1)',
        boxShadow: (theme) =>
          `0 -8px 32px ${alpha(theme.palette.common.black, 0.12)}`,
        pb: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        '@keyframes rendaCtaPulse': {
          '0%': { transform: 'scale(1)', filter: 'brightness(1)' },
          '40%': { transform: 'scale(1.03)', filter: 'brightness(1.06)' },
          '100%': { transform: 'scale(1)', filter: 'brightness(1)' },
        },
      }}
    >
      <Stack direction="column" spacing={0.5} sx={{ width: '100%' }}>
        {topRow ? (
          <Box
            sx={{
              width: '100%',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              pb: 0.25,
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {topRow}
          </Box>
        ) : null}
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
        >
          <Box sx={{ flex: 1, minWidth: 0, pr: 0.5 }}>
            <Typography
              variant="h6"
              component="p"
              fontWeight={800}
              color="primary"
              noWrap
              sx={{ lineHeight: 1.15, fontSize: { xs: '1.05rem', sm: '1.1rem' } }}
            >
              {priceText}
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="medium"
            startIcon={<MobileMoneyOrderIcon />}
            onClick={onOrder}
            sx={(theme) => ({
              minWidth: { xs: 160, sm: 172 },
              minHeight: 48,
              flexShrink: 0,
              px: 2.25,
              py: 0.75,
              fontSize: '0.95rem',
              fontWeight: 800,
              textTransform: 'none',
              letterSpacing: 0.02,
              borderRadius: 2.5,
              boxShadow: `0 4px 18px ${alpha(theme.palette.primary.main, 0.45)}`,
              background: `linear-gradient(160deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 45%, ${theme.palette.primary.dark} 100%)`,
              transition: theme.transitions.create(
                ['box-shadow', 'transform', 'background-color'],
                { duration: 200 }
              ),
              '&:hover': {
                boxShadow: `0 6px 24px ${alpha(theme.palette.primary.main, 0.55)}`,
                background: `linear-gradient(160deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                transform: 'translateY(-2px)',
              },
              '&:active': {
                transform: 'translateY(0)',
                boxShadow: `0 2px 12px ${alpha(theme.palette.primary.main, 0.4)}`,
              },
              ...(shouldPulse
                ? { animation: 'rendaCtaPulse 700ms cubic-bezier(0.2, 0.8, 0.2, 1) 1' }
                : {}),
            })}
          >
            {orderLabel}
          </Button>
        </Stack>
        <Typography
          variant="body2"
          component="p"
          sx={(theme) => ({
            m: 0,
            width: '100%',
            textAlign: 'center',
            lineHeight: 1.45,
            fontWeight: 600,
            letterSpacing: 0.01,
            fontSize: { xs: '0.8rem', sm: '0.825rem' },
            color: alpha(theme.palette.text.primary, 0.8),
            fontStyle: 'italic',
          })}
        >
          {deliveryHint}
        </Typography>
        {questionSlot ? (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>{questionSlot}</Box>
        ) : null}
      </Stack>
    </Paper>
  );
}

function ProductSpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  const content =
    typeof value === 'string' || typeof value === 'number' ? (
      <Typography variant="body2" component="span" sx={{ lineHeight: 1.35 }}>
        {value}
      </Typography>
    ) : (
      value
    );
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(88px, 36%) 1fr', sm: 'minmax(100px, 30%) 1fr' },
        columnGap: 1.5,
        alignItems: 'start',
        py: 0.15,
        gap: 0.25,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        component="div"
        sx={{ fontWeight: 600, lineHeight: 1.3 }}
      >
        {label}
      </Typography>
      <Box sx={{ minWidth: 0 }}>{content}</Box>
    </Box>
  );
}

export default function ItemDetailPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();
  const { profile } = useUserProfileContext();
  const { addToCart } = useCart();
  const { trackViewContent, trackAddToCart } = useMetaPixel();
  const [anonBuyNowOpen, setAnonBuyNowOpen] = React.useState(false);
  const [imageLightboxOpen, setImageLightboxOpen] = React.useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);

  const { inventoryItem, loading, error } = useInventoryItem(id || null);
  const { stats: orderStats, loading: orderStatsLoading } = useItemOrderStats(
    inventoryItem?.id ?? null
  );
  const galleryImages = React.useMemo(
    () => orderedItemImages(inventoryItem?.item?.item_images ?? []),
    [inventoryItem?.item?.item_images]
  );
  const galleryImageCount = galleryImages.length;
  const { items: similarItems, loading: similarLoading } = useSimilarItems(
    id || null
  );
  const { ratings, loading: ratingsLoading } = useItemRatings(
    inventoryItem?.item?.id ?? null
  );

  const { trackOnMount, trackView } = useTrackItemView(id || null);
  const { trackSiteEvent } = useTrackSiteEvent();

  React.useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  React.useEffect(() => {
    if (id) {
      trackOnMount();
    }
  }, [id, trackOnMount]);

  React.useEffect(() => {
    if (!inventoryItem?.id) return;
    setSelectedImageIndex(0);
    setImageLightboxOpen(false);
  }, [inventoryItem?.id]);

  const lastPixelViewContentIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!inventoryItem?.id) return;
    if (lastPixelViewContentIdRef.current === inventoryItem.id) return;
    lastPixelViewContentIdRef.current = inventoryItem.id;

    const hasDeal =
      inventoryItem.hasActiveDeal &&
      typeof inventoryItem.original_price === 'number' &&
      typeof inventoryItem.discounted_price === 'number' &&
      inventoryItem.original_price > 0;
    const unitPrice = hasDeal
      ? inventoryItem.discounted_price!
      : inventoryItem.selling_price;

    const contentCategory = metaPixelContentCategoryFromItem(
      inventoryItem.item
    );
    const googleCategory = metaPixelGoogleProductCategoryFromItem(
      inventoryItem.item
    );
    trackViewContent({
      content_type: 'product',
      content_ids: [inventoryItem.id],
      contents: [{ id: inventoryItem.id, quantity: 1, item_price: unitPrice }],
      value: unitPrice,
      currency: inventoryItem.item.currency || 'USD',
      content_name: inventoryItem.item.name,
      ...(contentCategory && { content_category: contentCategory }),
      ...(googleCategory && { google_product_category: googleCategory }),
    });
  }, [inventoryItem, trackViewContent]);

  const goPrevGalleryImage = React.useCallback(() => {
    if (galleryImageCount <= 1) return;
    setSelectedImageIndex((i) => (i === 0 ? galleryImageCount - 1 : i - 1));
  }, [galleryImageCount]);

  const goNextGalleryImage = React.useCallback(() => {
    if (galleryImageCount <= 1) return;
    setSelectedImageIndex((i) =>
      i === galleryImageCount - 1 ? 0 : i + 1
    );
  }, [galleryImageCount]);

  const itemDetailLightboxSwipe = useSwipeImageNavigation(
    goNextGalleryImage,
    goPrevGalleryImage,
    imageLightboxOpen && galleryImageCount > 1
  );

  const mainGallerySwipe = useSwipeImageNavigation(
    goNextGalleryImage,
    goPrevGalleryImage,
    isMobile && galleryImageCount > 1 && !imageLightboxOpen
  );

  React.useEffect(() => {
    if (!imageLightboxOpen || galleryImageCount <= 1) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrevGalleryImage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNextGalleryImage();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    imageLightboxOpen,
    galleryImageCount,
    goPrevGalleryImage,
    goNextGalleryImage,
  ]);

  const handleOrderClick = () => {
    if (id) {
      void trackSiteEvent({
        eventType: SITE_EVENT_INVENTORY_ORDER_NOW_CLICK,
        subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
        subjectId: id,
      });
      trackView(id);
      if (!isAuthenticated) {
        setAnonBuyNowOpen(true);
        return;
      }
      navigate(`/items/${id}/place_order`);
    }
  };

  const handleAddToCart = (item: InventoryItem) => {
    trackView(item.id);
    const hasDeal =
      item.hasActiveDeal &&
      typeof item.original_price === 'number' &&
      typeof item.discounted_price === 'number' &&
      item.original_price > 0;

    const unitPrice = hasDeal ? item.discounted_price! : item.selling_price;
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
        imageUrl: orderedItemImages(item.item.item_images)[0]?.image_url,
        weight: item.item.weight,
        maxOrderQuantity: item.item.max_order_quantity || undefined,
        minOrderQuantity: item.item.min_order_quantity || undefined,
        originalPrice: hasDeal ? item.original_price! : undefined,
        discountedPrice: hasDeal ? item.discounted_price! : undefined,
        hasActiveDeal: hasDeal,
        dealEndAt: hasDeal ? item.deal_end_at : undefined,
      },
    });
  };

  const isClientUser = profile?.user_type_id === 'client';

  const itemDetailSeo = React.useMemo(() => {
    if (!id) return null;
    const origin = clientOrigin();
    const canonical = `${origin}/items/${id}`;
    const defaultOg = 'https://rendasua.com/og-image.jpg';

    if (loading) {
      return {
        title: t('items.seo.loadingTitle', 'Product | Rendasua'),
        description: t('items.seo.loadingDescription', 'Loading product details.'),
        keywords: t('items.seo.loadingKeywords', 'Rendasua, marketplace, product'),
        image: defaultOg,
        canonical,
        url: origin,
        type: 'website' as const,
        structuredData: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: t('items.seo.loadingWebPageName', 'Product'),
          url: canonical,
        },
        noindex: false,
      };
    }

    if (error || !inventoryItem) {
      return {
        title: t('items.seo.errorTitle', 'Product not found | Rendasua'),
        description: t(
          'items.seo.errorDescription',
          'This product is unavailable or the link may be incorrect.'
        ),
        keywords: 'Rendasua, marketplace',
        image: defaultOg,
        canonical,
        url: origin,
        type: 'website' as const,
        structuredData: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: t('items.seo.errorWebPageName', 'Product not found'),
          url: canonical,
        },
        noindex: true,
      };
    }

    const item = inventoryItem.item;
    const catalogLabel = t('items.seo.breadcrumbCatalog', 'Items');
    const fallbackDesc = t(
      'items.seo.fallbackDescription',
      '{{name}} — Browse and order on Rendasua.',
      { name: item.name }
    );
    const metaDesc = truncateSeoText(
      plainDescription(item.description) || fallbackDesc,
      SEO_DESC_MAX
    );
    const title = t('items.seo.detailTitle', '{{name}} | Rendasua', { name: item.name });
    const imgs = orderedItemImages(item.item_images);
    const ogImage = toAbsoluteUrl(origin, imgs[0]?.image_url) || defaultOg;
    const kwParts = [
      item.name,
      item.brand?.name,
      item.item_sub_category?.item_category?.name,
      item.item_sub_category?.name,
      inventoryItem.business_location?.business?.name,
    ];
    const keywords = [...new Set(kwParts.flatMap((p) => (p?.trim() ? [p.trim()] : [])))].join(
      ', '
    );

    return {
      title,
      description: metaDesc,
      keywords,
      image: ogImage,
      canonical,
      url: origin,
      type: 'product' as const,
      structuredData: buildItemJsonLd(
        origin,
        id,
        inventoryItem,
        catalogLabel,
        fallbackDesc
      ),
      noindex: false,
    };
  }, [id, loading, error, inventoryItem, t]);

  if (loading) {
    return (
      <>
        {itemDetailSeo && <SEOHead {...itemDetailSeo} />}
        <Container maxWidth="lg" component="main" sx={{ py: { xs: 2, md: 4 } }}>
          <Skeleton variant="text" width={120} height={40} sx={{ mb: 2 }} />
          <Grid container spacing={3} sx={{ width: '100%' }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Skeleton
                variant="rectangular"
                height={isMobile ? 280 : 400}
                sx={{ borderRadius: 2, mb: 2 }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Skeleton variant="text" width="80%" height={40} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="40%" height={28} sx={{ mb: 2 }} />
              <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
            </Grid>
          </Grid>
        </Container>
      </>
    );
  }

  if (error || !inventoryItem) {
    return (
      <>
        {itemDetailSeo && <SEOHead {...itemDetailSeo} />}
        <Container maxWidth="lg" component="main" sx={{ py: { xs: 2, md: 4 } }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error || t('items.notFound', 'Item not found')}
          </Alert>
          <Button
            component={RouterLink}
            to="/items"
            startIcon={<ArrowBackIcon />}
            variant="outlined"
          >
            {t('common.back', 'Back')}
          </Button>
        </Container>
      </>
    );
  }

  const item = inventoryItem.item;
  const images = galleryImages;
  const primaryImage = images.length > 0 ? images[0].image_url : null;
  const selectedImageUrl =
    images[selectedImageIndex]?.image_url ?? primaryImage ?? null;
  const business = inventoryItem.business_location?.business;
  const location = inventoryItem.business_location;
  const businessCountry = inventoryItem.business_location?.address?.country;
  const isCameroonBusiness = businessCountry?.trim().toUpperCase() === 'CM';
  const canOrder =
    inventoryItem.computed_available_quantity > 0 && inventoryItem.is_active;
  const hasDeal =
    inventoryItem.hasActiveDeal &&
    typeof inventoryItem.original_price === 'number' &&
    typeof inventoryItem.discounted_price === 'number' &&
    inventoryItem.original_price > 0;
  const checkoutUnitPrice = hasDeal
    ? inventoryItem.discounted_price!
    : inventoryItem.selling_price;
  const checkoutPriceText = formatCurrency(checkoutUnitPrice, item.currency);
  const showMobileStickyOrderBar = isMobile && canOrder;
  const showInlineOrderNow = !showMobileStickyOrderBar;
  const showOrderCtaStack =
    !canOrder || isClientUser || !isMobile;

  const ratingCount = ratings.length;
  const ratingAvg =
    ratingCount > 0
      ? ratings.reduce((sum, r) => sum + (typeof r.rating === 'number' ? r.rating : 0), 0) /
        ratingCount
      : null;
  const stickyRatingLabel =
    ratingAvg != null
      ? `★ ${ratingAvg.toFixed(1)} · ${ratingCount}`
      : null;

  const hourNow = new Date().getHours();
  const cutoff = t('items.detail.stickyBar.cutoffTime', '2:00 PM');
  const stickyDeliveryHint =
    hourNow < 14
      ? t(
          'items.detail.stickyBar.orderBeforeCutoff',
          'Order before {{cutoff}} for the same-day delivery window.',
          { cutoff }
        )
      : t(
          'items.detail.stickyBarDeliveryHint',
          'Get your item delivered in less than 24 hours.'
        );

  const dealDiscountPct =
    hasDeal && inventoryItem.original_price > 0
      ? Math.round((1 - checkoutUnitPrice / inventoryItem.original_price) * 100)
      : null;

  const scrollToReviews = () => {
    document
      .getElementById('item-detail-reviews')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleFaqToggle = (questionId: string, isExpanded: boolean) => {
    if (!id) return;
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_FAQ_TOGGLE,
      subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
      subjectId: id,
      metadata: { questionId, expanded: isExpanded },
    });
  };

  const handleRatingSummaryTrack = () => {
    if (!id) return;
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_RATING_SUMMARY_CLICK,
      subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
      subjectId: id,
    });
  };

  const handleContactBeforeBuyTrack = () => {
    if (!id) return;
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_CONTACT_BEFORE_BUY_CLICK,
      subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
      subjectId: id,
    });
  };

  return (
    <>
      {itemDetailSeo && <SEOHead {...itemDetailSeo} />}
      <Container
        maxWidth="lg"
        component="main"
        sx={{
          pt: { xs: 1, md: 4 },
          pb: { xs: isMobile && canOrder ? 18 : 2, md: 4 },
        }}
      >
        <Stack spacing={isMobile ? 0 : 1.5} sx={{ mb: isMobile ? 1 : 2 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
          >
            {isMobile ? (
              <IconButton
                component={RouterLink}
                to="/items"
                aria-label={t('common.back', 'Back')}
                size="medium"
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
              >
                <ArrowBackIcon />
              </IconButton>
            ) : (
              <Button
                component={RouterLink}
                to="/items"
                startIcon={<ArrowBackIcon />}
                variant="outlined"
                size="medium"
              >
                {t('common.back', 'Back')}
              </Button>
            )}
            {id ? (
              <PageShareMenu
                shareUrl={buildInventoryItemSeoShareUrl(id)}
                shareTitle={item.name}
                shareDescription={checkoutPriceText}
              />
            ) : null}
          </Stack>
          {!isMobile ? (
            <Button
              component={RouterLink}
              to="/items"
              variant="outlined"
              size="medium"
              onClick={() => {
                if (!id) return;
                void trackSiteEvent({
                  eventType: SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK,
                  subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
                  subjectId: id,
                });
              }}
            >
              {t('items.detail.browseMoreItems', 'Browse more items')}
            </Button>
          ) : null}
        </Stack>

        <Box component="article" aria-labelledby="item-detail-heading">
          {/* Main content: image + details */}
          <Grid container spacing={3} sx={{ width: '100%' }}>
        {/* Image */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card
            sx={{
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            {selectedImageUrl ? (
              <ButtonBase
                onClick={() => setImageLightboxOpen(true)}
                onTouchStart={mainGallerySwipe.onTouchStart}
                onTouchEnd={mainGallerySwipe.onTouchEnd}
                sx={{ width: '100%', display: 'block' }}
                aria-label={t('items.viewImage', 'View image')}
              >
                <CardMedia
                  component="img"
                  height={isMobile ? 280 : 400}
                  image={selectedImageUrl}
                  alt={item.name}
                  sx={{ objectFit: 'cover', width: '100%' }}
                />
              </ButtonBase>
            ) : (
              <Box
                sx={{
                  height: isMobile ? 280 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'grey.200',
                }}
              >
                <img
                  src={NoImage}
                  alt=""
                  style={{ width: 120, height: 120, opacity: 0.6 }}
                />
              </Box>
            )}
          </Card>

          {isMobile && images.length > 1 ? (
            <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.5} sx={{ mt: 1 }}>
              {images.map((_, idx) => {
                const selected = idx === selectedImageIndex;
                return (
                  <ButtonBase
                    key={`dot-${idx}`}
                    onClick={() => setSelectedImageIndex(idx)}
                    aria-label={t('items.imageThumbnail', 'View image {{index}}', {
                      index: idx + 1,
                    })}
                    sx={{
                      minWidth: 44,
                      minHeight: 44,
                      borderRadius: 1,
                      p: 0.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: selected ? 'primary.main' : 'action.disabled',
                      }}
                    />
                  </ButtonBase>
                );
              })}
            </Stack>
          ) : null}

          {!isMobile && images.length > 1 ? (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                mt: 1.5,
                flexWrap: 'wrap',
                justifyContent: 'flex-start',
                rowGap: 1,
              }}
            >
              {images.map((img, idx) => {
                const isSelected = idx === selectedImageIndex;
                return (
                  <ButtonBase
                    key={img.id ?? `${img.image_url}-${idx}`}
                    onClick={() => setSelectedImageIndex(idx)}
                    sx={{
                      borderRadius: 1,
                      overflow: 'hidden',
                      border: '2px solid',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      width: 64,
                      height: 64,
                      flexShrink: 0,
                    }}
                    aria-label={t(
                      'items.imageThumbnail',
                      'View image {{index}}',
                      { index: idx + 1 }
                    )}
                  >
                    <Box
                      component="img"
                      src={img.image_url}
                      alt={img.alt_text || item.name}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </ButtonBase>
                );
              })}
            </Stack>
          ) : null}
        </Grid>

        {/* Details */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={isMobile ? 1.25 : 2}>
            <Typography
              id="item-detail-heading"
              variant="h4"
              component="h1"
              sx={{
                fontSize: { xs: '1.5rem', md: '1.75rem' },
                ...(isMobile
                  ? {
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                    }
                  : {}),
              }}
            >
              {item.name}
            </Typography>

            <ItemDetailRatingSummary
              ratings={ratings}
              loading={ratingsLoading}
              onOpenReviews={scrollToReviews}
              onTrackOpen={handleRatingSummaryTrack}
            />

            {item.brand && (
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap={isMobile}
                sx={
                  isMobile
                    ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                    : undefined
                }
              >
                {item.brand.name}
                {item.item_sub_category?.item_category?.name && (
                  <> · {item.item_sub_category.item_category.name}</>
                )}
                {item.item_sub_category?.name && <> · {item.item_sub_category.name}</>}
              </Typography>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {hasDeal && (
                <Typography
                  component="span"
                  variant="body1"
                  sx={{ textDecoration: 'line-through' }}
                  color="text.secondary"
                >
                  {formatCurrency(inventoryItem.original_price!, item.currency)}
                </Typography>
              )}
              <Typography variant="h5" color="primary.main" fontWeight={600}>
                {formatCurrency(checkoutUnitPrice, item.currency)}
              </Typography>
              {dealDiscountPct != null && dealDiscountPct > 0 ? (
                <Chip
                  size="small"
                  color="success"
                  label={t('items.detail.savePct', '-{{pct}}%', { pct: dealDiscountPct })}
                />
              ) : null}
            </Box>

            {hasDeal && inventoryItem.deal_end_at ? (
              <ItemDetailDealCountdown
                dealEndAt={inventoryItem.deal_end_at}
                discountPercent={dealDiscountPct}
              />
            ) : null}

            <ItemDetailScarcityBadge quantity={inventoryItem.computed_available_quantity} />

            <ItemDetailTrustStrip isVerifiedSeller={Boolean(business?.is_verified)} />

            {location && business && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  {t('items.detail.fulfilledBy', 'Fulfilled by')}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <BusinessIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.primary" fontWeight={500}>
                    {business.name}
                    {business.is_verified ? (
                      <Tooltip title={t('items.detail.verifiedSellerTooltip', 'Verified seller')}>
                        <Verified
                          fontSize="medium"
                          color="primary"
                          sx={{ ml: 0.5, verticalAlign: 'middle' }}
                        />
                      </Tooltip>
                    ) : null}
                    {location.name && ` · ${location.name}`}
                  </Typography>
                </Box>
              </Box>
            )}

            <ItemDetailSocialProof
              viewsCount={inventoryItem.viewsCount}
              recentOrders30d={orderStats?.recentOrders30d ?? null}
              statsLoading={orderStatsLoading}
            />

            <ItemDetailHowItWorks />

            {isCameroonBusiness ? <CmAcceptedPaymentLogos compact={isMobile} /> : null}

            {/* Quick specs chips */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {item.is_fragile && (
                <Chip label={t('items.fragile', 'Fragile')} size="small" color="warning" />
              )}
              {item.is_perishable && (
                <Chip label={t('items.perishable', 'Perishable')} size="small" color="error" />
              )}
              {item.requires_special_handling && (
                <Chip label={t('items.specialHandling', 'Special')} size="small" color="info" />
              )}
              {item.tags && item.tags.length > 0 && item.tags.map((tag) => (
                <Chip key={tag.id} label={tag.name} size="small" variant="outlined" />
              ))}
            </Box>

            {/* CTAs: on mobile, Order Now is only in the sticky bar when in stock; Add to Cart stays here for clients */}
            {showOrderCtaStack ? (
              <Stack direction="column" spacing={1} sx={{ pt: 1 }}>
                {!canOrder ? (
                  <Button variant="outlined" disabled size="medium">
                    {inventoryItem.computed_available_quantity === 0
                      ? t('items.outOfStock', 'Out of Stock')
                      : t('items.notAvailable', 'Not Available')}
                  </Button>
                ) : (
                  <>
                    {isClientUser && (
                      <Button
                        variant="outlined"
                        startIcon={<ShoppingCart />}
                        onClick={() => handleAddToCart(inventoryItem)}
                        size="medium"
                        fullWidth
                      >
                        {t('cart.addToCart', 'Add to Cart')}
                      </Button>
                    )}
                    {showInlineOrderNow && (
                      <Button
                        variant="contained"
                        startIcon={<MobileMoneyOrderIcon />}
                        onClick={handleOrderClick}
                        size="medium"
                        fullWidth
                        sx={(btnTheme) => ({
                          minHeight: 48,
                          fontWeight: 800,
                          textTransform: 'none',
                          borderRadius: 2.5,
                          boxShadow: `0 4px 18px ${alpha(btnTheme.palette.primary.main, 0.45)}`,
                          background: `linear-gradient(160deg, ${btnTheme.palette.primary.light} 0%, ${btnTheme.palette.primary.main} 45%, ${btnTheme.palette.primary.dark} 100%)`,
                          '&:hover': {
                            boxShadow: `0 6px 24px ${alpha(btnTheme.palette.primary.main, 0.55)}`,
                            background: `linear-gradient(160deg, ${btnTheme.palette.primary.main} 0%, ${btnTheme.palette.primary.dark} 100%)`,
                          },
                        })}
                      >
                        {t('common.orderNow', 'Order Now')}
                      </Button>
                    )}
                  </>
                )}
              </Stack>
            ) : null}
          </Stack>
        </Grid>
      </Grid>

      {/* Product information - full width, dense layout */}
      <Card variant="outlined" sx={{ mt: 3, borderColor: 'divider' }}>
        <CardContent
          sx={{
            p: 1.5,
            pt: 1.5,
            '&:last-child': { pb: 1.5 },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              mb: item.description ? 1.25 : 1,
            }}
          >
            <SpecsIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={600} component="h2" sx={{ lineHeight: 1.3 }}>
              {t('items.productInformation', 'Product Information')}
            </Typography>
          </Box>

          {item.description && (
            <Box sx={{ mb: 1.25 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                fontWeight={600}
                sx={{ mb: 0.25 }}
              >
                {t('items.description', 'Description')}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                {item.description}
              </Typography>
            </Box>
          )}

          <Stack
            spacing={0}
            divider={
              <Divider flexItem variant="fullWidth" sx={{ borderColor: 'divider' }} />
            }
          >
            {item.item_sub_category?.item_category?.name && (
              <ProductSpecRow
                label={t('items.category', 'Category')}
                value={item.item_sub_category.item_category.name}
              />
            )}
            {item.item_sub_category?.name && (
              <ProductSpecRow
                label={t('items.subcategory', 'Subcategory')}
                value={item.item_sub_category.name}
              />
            )}
            {item.brand?.name && (
              <ProductSpecRow label={t('items.brand', 'Brand')} value={item.brand.name} />
            )}
            {item.model?.trim() && (
              <ProductSpecRow label={t('items.model', 'Model')} value={item.model} />
            )}
            {item.color?.trim() && (
              <ProductSpecRow label={t('items.color', 'Color')} value={item.color} />
            )}
            {item.sku?.trim() && (
              <ProductSpecRow
                label={t('items.sku', 'SKU')}
                value={
                  <Typography variant="body2" component="span" fontFamily="monospace">
                    {item.sku}
                  </Typography>
                }
              />
            )}
            {item.weight != null && item.weight > 0 && (
              <ProductSpecRow
                label={t('items.weight', 'Weight')}
                value={`${item.weight} ${item.weight_unit || 'g'}`}
              />
            )}
            {item.dimensions?.trim() && (
              <ProductSpecRow
                label={t('items.dimensions', 'Dimensions')}
                value={item.dimensions}
              />
            )}
            {item.min_order_quantity != null && item.min_order_quantity > 0 && (
              <ProductSpecRow
                label={t('items.minOrderQuantity', 'Min. order quantity')}
                value={item.min_order_quantity}
              />
            )}
            {item.max_order_quantity != null && item.max_order_quantity > 0 && (
              <ProductSpecRow
                label={t('items.maxOrderQuantity', 'Max. order quantity')}
                value={item.max_order_quantity}
              />
            )}
            {item.max_delivery_distance != null && item.max_delivery_distance > 0 && (
              <ProductSpecRow
                label={t('items.maxDeliveryDistance', 'Max. delivery distance')}
                value={`${item.max_delivery_distance} km`}
              />
            )}
            {item.estimated_delivery_time != null && item.estimated_delivery_time > 0 && (
              <ProductSpecRow
                label={t('items.estimatedDeliveryTime', 'Est. delivery time')}
                value={`~${item.estimated_delivery_time} min`}
              />
            )}
          </Stack>

          {(item.is_fragile || item.is_perishable || item.requires_special_handling) && (
            <>
              <Divider sx={{ my: 1.25 }} />
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                fontWeight={600}
                sx={{ mb: 0.5 }}
              >
                {t('items.specialProperties', 'Special properties')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {item.is_fragile && (
                  <Chip label={t('items.fragile', 'Fragile')} size="small" color="warning" />
                )}
                {item.is_perishable && (
                  <Chip label={t('items.perishable', 'Perishable')} size="small" color="error" />
                )}
                {item.requires_special_handling && (
                  <Chip
                    label={t('items.specialHandling', 'Special handling')}
                    size="small"
                    color="info"
                  />
                )}
              </Box>
            </>
          )}
        </CardContent>
      </Card>

        <ItemDetailFaqAccordion onToggle={handleFaqToggle} />

        {(ratingsLoading || ratings.length > 0) && (
          <Box id="item-detail-reviews" sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('items.reviews', 'Reviews')}
            </Typography>
            {ratingsLoading ? (
              <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
            ) : (
              <OrderRatingsDisplay
                ratings={ratings}
                userType="client"
                title={t('items.reviews', 'Reviews')}
              />
            )}
          </Box>
        )}

        {/* Similar items */}
        {similarItems.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              {t('items.similarItems', 'Similar Items')}
            </Typography>
            {similarLoading ? (
              <Grid container spacing={2}>
                {[1, 2, 3].map((i) => (
                  <Grid size={{ xs: 6, sm: 4 }} key={i}>
                    <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 1 }} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Grid container spacing={2}>
                {similarItems.slice(0, 6).map((sim) => (
                  <Grid size={{ xs: 6, sm: 4 }} key={sim.id}>
                    <Card
                      component={RouterLink}
                      to={`/items/${sim.id}`}
                      sx={{
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'block',
                        height: '100%',
                        '&:hover': { boxShadow: theme.shadows[4] },
                      }}
                    >
                      <CardMedia
                        component="img"
                        height="120"
                        image={
                          orderedItemImages(sim.item?.item_images)[0]?.image_url ||
                          NoImage
                        }
                        alt={sim.item?.name}
                        sx={{ objectFit: 'cover' }}
                      />
                      <CardContent sx={{ py: 1 }}>
                        <Typography variant="subtitle2" noWrap>
                          {sim.item?.name}
                        </Typography>
                        <Typography variant="body2" color="primary" fontWeight={600}>
                          {formatCurrency(
                            sim.hasActiveDeal && typeof sim.discounted_price === 'number'
                              ? sim.discounted_price
                              : sim.selling_price,
                            sim.item?.currency
                          )}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}

        <Box sx={{ mt: 3, mb: 1, textAlign: 'center' }}>
          <Link
            component={RouterLink}
            to="/items"
            underline="hover"
            variant="body2"
            color="text.secondary"
            onClick={() => {
              if (!id) return;
              void trackSiteEvent({
                eventType: SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK,
                subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
                subjectId: id,
              });
            }}
          >
            {t('items.detail.browseMoreItems', 'Browse more items')} →
          </Link>
        </Box>
        </Box>
      </Container>
      <ItemDetailMobileOrderBar
        visible={showMobileStickyOrderBar}
        priceText={checkoutPriceText}
        orderLabel={t('common.orderNow', 'Order Now')}
        deliveryHint={stickyDeliveryHint}
        topRow={
          <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 'max-content', pr: 1 }}>
            {stickyRatingLabel ? (
              <Chip
                label={stickyRatingLabel}
                sx={{ minHeight: 32, fontWeight: 700 }}
                variant="outlined"
              />
            ) : null}
            <Chip
              label={t('items.detail.trust.mobileMoneySecure', 'MoMo secure')}
              sx={{ minHeight: 32, fontWeight: 700 }}
              variant="outlined"
            />
            <Chip
              label={t('items.detail.trust.fastDelivery', 'Fast delivery')}
              sx={{ minHeight: 32, fontWeight: 700 }}
              variant="outlined"
            />
            {business?.is_verified ? (
              <Chip
                label={t('items.detail.trust.verifiedSeller', 'Verified seller')}
                sx={{ minHeight: 32, fontWeight: 700 }}
                variant="outlined"
              />
            ) : null}
          </Stack>
        }
        questionSlot={
          id ? (
            <PageShareMenu
              shareUrl={buildInventoryItemSeoShareUrl(id)}
              shareTitle={item.name}
              shareDescription={checkoutPriceText}
              renderTrigger={({ onOpen }) => (
                <ButtonBase
                  onClick={(e) => {
                    handleContactBeforeBuyTrack();
                    onOpen(e);
                  }}
                  sx={(theme) => ({
                    minHeight: 44,
                    px: 1,
                    borderRadius: 2,
                    color: alpha(theme.palette.text.primary, 0.75),
                    '&:hover': { color: theme.palette.text.primary },
                  })}
                >
                  <Typography
                    variant="caption"
                    component="span"
                    sx={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}
                  >
                    {t('items.detail.stickyBar.question', 'A question before you buy?')}
                  </Typography>
                </ButtonBase>
              )}
            />
          ) : null
        }
        onOrder={handleOrderClick}
      />
      <AnonymousBuyNowDialog
        open={anonBuyNowOpen}
        inventoryItemId={inventoryItem.id}
        item={{
          title: item.name,
          imageUrl: primaryImage,
          priceText: checkoutPriceText,
          quantity: 1,
        }}
        onClose={() => setAnonBuyNowOpen(false)}
      />
      <Dialog
        open={imageLightboxOpen}
        onClose={() => setImageLightboxOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'common.black' } }}
      >
        <IconButton
          aria-label={t('common.close', 'Close')}
          onClick={() => setImageLightboxOpen(false)}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            zIndex: 1,
            color: 'common.white',
          }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent sx={{ p: 0, pt: 5, bgcolor: 'common.black' }}>
          {selectedImageUrl ? (
            <>
              <ImageLightboxTapZones
                showTapZones={images.length > 1}
                onPrevious={goPrevGalleryImage}
                onNext={goNextGalleryImage}
                previousLabel={t('common.previous', 'Previous')}
                nextLabel={t('common.next', 'Next')}
                onTouchStart={itemDetailLightboxSwipe.onTouchStart}
                onTouchEnd={itemDetailLightboxSwipe.onTouchEnd}
              >
                <Box
                  component="img"
                  src={selectedImageUrl}
                  alt={item.name}
                  sx={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '70vh',
                    objectFit: 'contain',
                    display: 'block',
                    bgcolor: 'common.black',
                    touchAction: 'pan-y',
                  }}
                />
              </ImageLightboxTapZones>
              {images.length > 1 ? (
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="center"
                  spacing={2}
                  sx={{ py: 2, px: 2 }}
                >
                  <IconButton
                    onClick={goPrevGalleryImage}
                    sx={{ color: 'common.white' }}
                    aria-label={t('common.previous', 'Previous')}
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                  <Typography variant="body2" sx={{ color: 'grey.300' }}>
                    {t(
                      'business.items.imageLightboxCounter',
                      '{{current}} of {{total}}',
                      {
                        current: selectedImageIndex + 1,
                        total: images.length,
                      }
                    )}
                  </Typography>
                  <IconButton
                    onClick={goNextGalleryImage}
                    sx={{ color: 'common.white' }}
                    aria-label={t('common.next', 'Next')}
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </Stack>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
