import { Storefront } from '@mui/icons-material';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  ButtonBase,
  CircularProgress,
  InputAdornment,
  Link,
  Paper,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import Container from '@mui/material/Container';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useExportSellers } from '../../hooks/useExportSellers';
import { useExportSellerTracking } from '../../hooks/useExportSellerTracking';
import { exportCountryOfPlace, exportCountryPlace } from '../../utils/exportCountries';
import {
  exportSellerPath,
  exportSellersCanonicalUrl,
  type ExportSeller,
} from '../../utils/exportSellers';
import { exportsOriginPath } from '../../utils/exportsPublicLink';
import { EXPORT_BRAND_BLUE } from '../exports/ExportOnlyBadge';
import { ExportSellerAvatar, ExportSellerPlace } from '../exports/ExportSellerAvatar';
import { useExportSellersRouteContext } from '../exports/useExportSellersRouteContext';
import SEOHead from '../seo/SEOHead';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

/** "From Canada" / "Depuis le Canada" or "Into Cameroon" / "Vers le Cameroun". */
export function useExportContextLabel(direction: 'into' | 'from', code: string | null): string {
  const { t, i18n } = useTranslation();
  if (!code) return '';
  const place = exportCountryPlace(code, i18n.language);
  return direction === 'from'
    ? t('exportsOrigin.from', 'From {{place}}', { place })
    : t('exportsOrigin.into', 'Into {{place}}', { place });
}

const SellerRow: React.FC<{ seller: ExportSeller; href: string; onClick: () => void }> = ({ seller, href, onClick }) => {
  const { t } = useTranslation();
  return (
    <ButtonBase
      component={RouterLink}
      to={href}
      onClick={onClick}
      data-testid="export-seller-row"
      aria-label={t('exportSellers.openSeller', { name: seller.name, defaultValue: 'Open {{name}}' })}
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        textAlign: 'left',
        gap: 1.5,
        p: 1.5,
        borderBottom: '1px solid #EEF1F5',
        '&:hover': { bgcolor: '#F6F8FB' },
      }}
    >
      <ExportSellerAvatar name={seller.name} logoUrl={seller.logo_url} size={48} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, overflowWrap: 'anywhere' }}>{seller.name}</Typography>
        <ExportSellerPlace country={seller.country} city={seller.city} />
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
        {t('exportSellers.itemsCount', { count: seller.item_count, defaultValue: '{{count}} items' })}
      </Typography>
    </ButtonBase>
  );
};

/**
 * All exports sellers for the context, with search. Public and indexed under
 * /exports/{cc}/sellers (From); in-app /exports/sellers (Into) is not indexed.
 */
const ExportSellersPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { ctx, isPublic, invalidCode } = useExportSellersRouteContext();
  const code = ctx.direction === 'from' ? ctx.originCode : ctx.marketCode;
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setSearch(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query]);

  const { sellers, total, loading, loadingMore, error, loadMore, hasMore } = useExportSellers({
    ...ctx,
    limit: PAGE_SIZE,
    search,
  });
  const track = useExportSellerTracking(ctx);
  const viewed = useRef(false);
  useEffect(() => {
    if (loading || viewed.current || search) return;
    viewed.current = true;
    track('exports_sellers_list_viewed', { total });
  }, [loading, search, total, track]);
  const lastTracked = useRef('');
  useEffect(() => {
    if (!search || loading || lastTracked.current === search) return;
    lastTracked.current = search;
    track('exports_sellers_search_submitted', { query_len: search.length, results: total, surface: 'list' });
  }, [search, loading, total, track]);

  const contextLabel = useExportContextLabel(ctx.direction, code);
  const place = code ? exportCountryPlace(code, lang) : '';
  const ofPlace = code ? exportCountryOfPlace(code, lang) : '';
  const backHref = isPublic && ctx.originCode ? exportsOriginPath(ctx.originCode) : '/exports';
  const emptyContext = !loading && !error && !search && total === 0;
  const seoTitle = isPublic
    ? t('exportSellers.listSeoTitle', 'Sellers exporting from {{place}} | Rendasua', { place, ofPlace })
    : `${t('exportSellers.allTitle', 'All sellers')} | Rendasua`;
  const seoDescription = t('exportSellers.listSeoDescription', {
    count: total,
    place,
    defaultValue: '{{count}} sellers export from {{place}} on Rendasua.',
  });

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonical={isPublic && ctx.originCode ? exportSellersCanonicalUrl(ctx.originCode) : undefined}
        // Into lists depend on the viewer market; unknown or empty origins are soft 404s.
        noindex={!isPublic || invalidCode || emptyContext}
        structuredData={
          isPublic && ctx.originCode
            ? {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: seoTitle,
                description: seoDescription,
                url: exportSellersCanonicalUrl(ctx.originCode),
              }
            : undefined
        }
      />
      <Breadcrumbs sx={{ mb: 1.5, fontSize: 13 }}>
        <Link component={RouterLink} to={backHref} underline="hover" color="inherit">
          {isPublic && contextLabel ? contextLabel : t('exportsOrigin.breadcrumbExports', 'Exports')}
        </Link>
        <Typography color="text.secondary" fontSize={13}>
          {t('exportSellers.title', 'Sellers')}
        </Typography>
      </Breadcrumbs>

      <Box component="header" sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Storefront sx={{ fontSize: 26 }} aria-hidden />
          <Typography variant="h5" component="h1" fontWeight={800}>
            {t('exportSellers.allTitle', 'All sellers')}
          </Typography>
        </Box>
        {contextLabel ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} data-testid="export-sellers-context">
            {loading && !search
              ? contextLabel
              : `${contextLabel} · ${t('exportSellers.sellersCount', { count: total, defaultValue: '{{count}} sellers' })}`}
          </Typography>
        ) : null}
      </Box>

      {invalidCode ? (
        <Alert severity="info">{t('exportSellers.noSellers', 'No sellers in this view yet.')}</Alert>
      ) : (
        <>
          <TextField
            fullWidth
            size="small"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('exportSellers.searchPlaceholder', 'Search sellers')}
            inputProps={{ 'data-testid': 'export-sellers-search', 'aria-label': t('exportSellers.searchPlaceholder', 'Search sellers') }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#fff' } }}
          />
          {error ? (
            <Alert severity="error">{t('exportSellers.loadError', 'We couldn’t load sellers. Try again.')}</Alert>
          ) : loading ? (
            <Paper variant="outlined" sx={{ borderRadius: 2 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1.5, p: 1.5 }}>
                  <Skeleton variant="rounded" width={48} height={48} />
                  <Skeleton width="60%" />
                </Box>
              ))}
            </Paper>
          ) : sellers.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }} data-testid="export-sellers-empty">
              <Storefront sx={{ fontSize: 40, color: 'text.secondary' }} aria-hidden />
              <Typography fontWeight={700} sx={{ mt: 1 }}>
                {search
                  ? t('exportSellers.noMatchTitle', 'No sellers match your search')
                  : t('exportSellers.noSellers', 'No sellers in this view yet.')}
              </Typography>
              {search ? (
                <Typography color="text.secondary">{t('exportSellers.noMatchHint', 'Try another seller name.')}</Typography>
              ) : (
                <Button component={RouterLink} to={backHref} sx={{ mt: 1.5, color: EXPORT_BRAND_BLUE, fontWeight: 700 }}>
                  {t('exportSellers.backToExports', 'Back to exports')}
                </Button>
              )}
            </Paper>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }} data-testid="export-sellers-list">
              {sellers.map((seller, index) => (
                <SellerRow
                  key={seller.business_location_id}
                  seller={seller}
                  href={exportSellerPath(ctx, seller.business_location_id)}
                  onClick={() =>
                    track('exports_seller_card_tapped', {
                      location_id: seller.business_location_id,
                      position: index,
                      item_count: seller.item_count,
                      surface: 'list',
                    })
                  }
                />
              ))}
            </Paper>
          )}
          {hasMore && !loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                variant="outlined"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                startIcon={loadingMore ? <CircularProgress size={16} /> : undefined}
                sx={{ color: EXPORT_BRAND_BLUE, borderColor: EXPORT_BRAND_BLUE, fontWeight: 700 }}
              >
                {t('exportSellers.showMore', 'Show more sellers')}
              </Button>
            </Box>
          ) : null}
        </>
      )}
    </Container>
  );
};

export default ExportSellersPage;
