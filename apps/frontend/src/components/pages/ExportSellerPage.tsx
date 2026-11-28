import { Storefront } from '@mui/icons-material';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Container,
  InputAdornment,
  Link,
  Pagination,
  Paper,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useExportSellers } from '../../hooks/useExportSellers';
import { useExportSellerTracking } from '../../hooks/useExportSellerTracking';
import { useInventoryItems, type InventoryItem } from '../../hooks/useInventoryItems';
import { exportCountryName, exportCountryOfPlace, exportCountryPlace } from '../../utils/exportCountries';
import {
  exportSellerCanonicalUrl,
  exportSellersListPath,
} from '../../utils/exportSellers';
import { exportsOriginPath } from '../../utils/exportsPublicLink';
import DashboardItemCard from '../common/DashboardItemCard';
import ItemCardSkeleton from '../common/ItemCardSkeleton';
import { EXPORT_BRAND_BLUE } from '../exports/ExportOnlyBadge';
import { ExportSellerAvatar, ExportSellerPlace } from '../exports/ExportSellerAvatar';
import { useExportSellersRouteContext } from '../exports/useExportSellersRouteContext';
import SEOHead from '../seo/SEOHead';
import { useExportContextLabel } from './ExportSellersPage';

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;

const GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
  gap: 2,
};

const formatCurrency = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

/**
 * Export-only seller page (not /store/:id): header, "Search this seller", export items
 * only (Export only badge, Price on request, no Buy). Public and indexed under
 * /exports/{cc}/sellers/{locationId}; the in-app Into page canonicalises there.
 */
const ExportSellerPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { locationId = '' } = useParams<{ locationId: string }>();
  const { ctx, isPublic, invalidCode } = useExportSellersRouteContext();
  const { isAuthenticated } = useSessionAuth();
  const { profile } = useUserProfileContext();
  const isClientUser = profile?.user_type_id === 'client';
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query]);

  const header = useExportSellers({ ...ctx, limit: 1, businessLocationId: locationId, enabled: Boolean(locationId) && !invalidCode });
  const seller = header.sellers[0] ?? null;
  const { inventoryItems, loading, error, pagination } = useInventoryItems({
    page,
    limit: PAGE_SIZE,
    is_active: true,
    export_only: true,
    business_location_id: locationId,
    ...(ctx.direction === 'from' && ctx.originCode ? { origin_country: ctx.originCode } : {}),
    ...(search ? { search } : {}),
    pageMode: 'replace',
    enabled: Boolean(locationId) && !invalidCode,
  });
  const items = useMemo(() => inventoryItems.filter((row: InventoryItem) => Boolean(row?.item)), [inventoryItems]);

  const track = useExportSellerTracking(ctx);
  const viewed = useRef(false);
  useEffect(() => {
    if (!seller || viewed.current) return;
    viewed.current = true;
    track('exports_seller_page_viewed', { location_id: seller.business_location_id, item_count: seller.item_count });
  }, [seller, track]);
  const lastSearch = useRef('');
  useEffect(() => {
    if (!search || loading || lastSearch.current === search) return;
    lastSearch.current = search;
    track('exports_seller_page_search_submitted', {
      location_id: locationId,
      query_len: search.length,
      results: pagination?.total ?? items.length,
    });
  }, [search, loading, locationId, pagination, items.length, track]);

  const code = ctx.direction === 'from' ? ctx.originCode : ctx.marketCode;
  const contextLabel = useExportContextLabel(ctx.direction, code);
  const sellerCountry = seller?.country ?? ctx.originCode ?? null;
  const place = sellerCountry ? exportCountryPlace(sellerCountry, lang) : '';
  const ofPlace = sellerCountry ? exportCountryOfPlace(sellerCountry, lang) : '';
  const listHref = exportSellersListPath(ctx);
  const notFound = !header.loading && !header.error && !seller;
  const canonical = seller?.country ? exportSellerCanonicalUrl(seller.country, seller.business_location_id) : undefined;
  const name = seller?.name ?? '';
  const seoTitle = seller
    ? t('exportSellers.sellerSeoTitle', '{{name}}: exports from {{place}} | Rendasua', { name, place, ofPlace })
    : `${t('exportSellers.title', 'Sellers')} | Rendasua`;
  const seoDescription = seller
    ? t('exportSellers.sellerSeoDescription', {
        count: seller.item_count,
        name,
        place,
        defaultValue: '{{count}} export items from {{name}} ({{place}}) on Rendasua.',
      })
    : t('exportSellers.sellerNotFound', 'We couldn’t find this seller.');

  const cardProps = isPublic
    ? {
        formatCurrency,
        onOrderClick: () => undefined,
        isPublicView: true,
        canOrder: false,
        showCartButtons: false,
        exportInterestSource: 'public_export_catalog' as const,
      }
    : {
        formatCurrency,
        onOrderClick: () => undefined,
        isPublicView: !isAuthenticated,
        canOrder: !isAuthenticated || isClientUser,
        showCartButtons: false,
      };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonical={canonical}
        // Only the public From URL is indexed; missing sellers are soft 404s.
        noindex={!isPublic || invalidCode || notFound || (seller?.item_count ?? 0) === 0}
        structuredData={
          seller && canonical
            ? {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: seoTitle,
                description: seoDescription,
                url: canonical,
                about: {
                  '@type': 'Organization',
                  name: seller.name,
                  ...(seller.logo_url ? { logo: seller.logo_url } : {}),
                  ...(seller.city || seller.country
                    ? {
                        address: {
                          '@type': 'PostalAddress',
                          ...(seller.city ? { addressLocality: seller.city } : {}),
                          ...(seller.country ? { addressCountry: seller.country } : {}),
                        },
                      }
                    : {}),
                },
              }
            : undefined
        }
      />
      <Breadcrumbs sx={{ mb: 1.5, fontSize: 13 }}>
        <Link
          component={RouterLink}
          to={isPublic && ctx.originCode ? exportsOriginPath(ctx.originCode) : '/exports'}
          underline="hover"
          color="inherit"
        >
          {isPublic && contextLabel ? contextLabel : t('exportsOrigin.breadcrumbExports', 'Exports')}
        </Link>
        <Link component={RouterLink} to={listHref} underline="hover" color="inherit">
          {t('exportSellers.title', 'Sellers')}
        </Link>
      </Breadcrumbs>

      {header.loading ? (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <Skeleton variant="rounded" width={64} height={64} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="40%" height={32} />
            <Skeleton width="25%" />
          </Box>
        </Box>
      ) : notFound || invalidCode ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }} data-testid="export-seller-not-found">
          <Storefront sx={{ fontSize: 40, color: 'text.secondary' }} aria-hidden />
          <Typography fontWeight={700} sx={{ mt: 1 }}>
            {t('exportSellers.sellerNotFound', 'We couldn’t find this seller.')}
          </Typography>
          <Button component={RouterLink} to={listHref} sx={{ mt: 1.5, color: EXPORT_BRAND_BLUE, fontWeight: 700 }}>
            {t('exportSellers.allTitle', 'All sellers')}
          </Button>
        </Paper>
      ) : seller ? (
        <Box component="header" sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }} data-testid="export-seller-header">
          <ExportSellerAvatar name={seller.name} logoUrl={seller.logo_url} size={64} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="h1" fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>
              {seller.name}
            </Typography>
            <ExportSellerPlace
              country={seller.country}
              city={seller.city}
              trailing={seller.country ? exportCountryName(seller.country, lang) : null}
            />
            <Typography variant="body2" fontWeight={700} sx={{ mt: 0.25 }}>
              {t('exportSellers.exportItemsCount', { count: seller.item_count, defaultValue: '{{count}} export items' })}
              {contextLabel ? (
                <Typography component="span" variant="body2" color="text.secondary">
                  {` · ${contextLabel}`}
                </Typography>
              ) : null}
            </Typography>
          </Box>
        </Box>
      ) : null}

      {seller ? (
        <>
          <TextField
            fullWidth
            size="small"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('exportSellers.sellerSearchPlaceholder', 'Search this seller')}
            inputProps={{
              'data-testid': 'export-seller-search',
              'aria-label': t('exportSellers.sellerSearchPlaceholder', 'Search this seller'),
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2, maxWidth: 520, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#fff' } }}
          />
          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
          {loading ? (
            <Box sx={GRID_SX} aria-busy="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <ItemCardSkeleton key={i} />
              ))}
            </Box>
          ) : items.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }} data-testid="export-seller-items-empty">
              <Typography fontWeight={700}>
                {search
                  ? t('exportSellers.itemsNoMatchTitle', 'No items match your search')
                  : t('exportSellers.sellerEmpty', 'No export items at this seller in this view.')}
              </Typography>
              {search ? (
                <Typography color="text.secondary">{t('exportSellers.itemsNoMatchHint', 'Try another word.')}</Typography>
              ) : null}
            </Paper>
          ) : (
            <Box sx={GRID_SX} data-testid="export-seller-items">
              {items.map((row) => (
                <DashboardItemCard key={row.id} item={row} {...cardProps} />
              ))}
            </Box>
          )}
          {!loading && pagination && pagination.totalPages > 1 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination count={pagination.totalPages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
            </Box>
          ) : null}
        </>
      ) : null}
    </Container>
  );
};

export default ExportSellerPage;
