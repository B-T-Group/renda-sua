import { FlightTakeoff, Public } from '@mui/icons-material';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Container,
  Link,
  Paper,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useExportOrigins } from '../../hooks/useExportOrigins';
import { useExportsFromOrigin } from '../../hooks/useExportsFromOrigin';
import type { InventoryItem } from '../../hooks/useInventoryItems';
import {
  exportCountryName,
  exportCountryOfPlace,
  exportCountryPlace,
  normalizeCountryCode,
} from '../../utils/exportCountries';
import { exportDestinationCodes } from '../../utils/exportItemRules';
import { exportsCanonicalUrl } from '../../utils/exportsPublicLink';
import DashboardItemCard from '../common/DashboardItemCard';
import ItemCardSkeleton from '../common/ItemCardSkeleton';
import { EXPORT_BRAND_BLUE } from '../exports/ExportOnlyBadge';
import ExportsDirectionBar from '../exports/ExportsDirectionBar';
import ExportCatalogIllustration from '../illustrations/ExportCatalogIllustration';
import SEOHead from '../seo/SEOHead';

const SECTION_PREVIEW = 4;

const GRID_SX = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(1, 1fr)',
    sm: 'repeat(2, 1fr)',
    md: 'repeat(3, 1fr)',
    lg: 'repeat(4, 1fr)',
  },
  gap: 2,
};

export interface ExportCategorySection {
  name: string;
  items: InventoryItem[];
}

/** Sections by catalog category, biggest first; uncategorised items go last. */
export function groupExportsByCategory(
  items: InventoryItem[],
  otherLabel: string
): ExportCategorySection[] {
  const byName = new Map<string, InventoryItem[]>();
  for (const row of items) {
    const name = row.item?.item_sub_category?.item_category?.name?.trim() || otherLabel;
    byName.set(name, [...(byName.get(name) ?? []), row]);
  }
  return [...byName.entries()]
    .map(([name, rows]) => ({ name, items: rows }))
    .sort((a, b) => {
      if (a.name === otherLabel) return 1;
      if (b.name === otherLabel) return -1;
      return b.items.length - a.items.length || a.name.localeCompare(b.name);
    });
}

const formatCurrency = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

/**
 * Public, indexed page: what one country exports (AC3, AC4). Signed-out access, no login
 * prompt. "I’m interested" here is a partner inquiry (source public_export_catalog), open
 * to every market.
 */
const ExportsFromCountryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { countryCode: rawCode } = useParams<{ countryCode: string }>();
  const code = normalizeCountryCode(rawCode);
  const { origins, loading: originsLoading } = useExportOrigins();
  const { items, loading, error } = useExportsFromOrigin(code);
  const [shipsTo, setShipsTo] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const summary = origins.find((o) => o.country_code === code) ?? null;
  const destinations = useMemo(() => {
    const set = new Set<string>(summary?.destination_codes ?? []);
    items.forEach((row) => exportDestinationCodes(row).forEach((c) => set.add(c)));
    return [...set].sort();
  }, [items, summary]);
  const businessCount = useMemo(
    () =>
      summary?.business_count ??
      new Set(items.map((row) => row.business_location?.business_id)).size,
    [items, summary]
  );
  const visible = useMemo(
    () =>
      shipsTo ? items.filter((row) => exportDestinationCodes(row).includes(shipsTo)) : items,
    [items, shipsTo]
  );
  const otherLabel = t('exportsOrigin.otherCategory', 'Other');
  const sections = useMemo(() => groupExportsByCategory(visible, otherLabel), [visible, otherLabel]);

  const place = code ? exportCountryPlace(code, lang) : '';
  const ofPlace = code ? exportCountryOfPlace(code, lang) : '';
  const isEmpty = !loading && !error && items.length === 0;
  const seoTitle = code
    ? t('exportsOrigin.seoTitle', 'Exports from {{place}} | Rendasua', { place, ofPlace })
    : t('exportsOrigin.seoTitleUnknown', 'Exports | Rendasua');
  const seoDescription = code
    ? t(
        'exportsOrigin.seoDescription',
        '{{count}} products exported from {{place}} by {{businesses}} businesses to {{destinations}} markets. Browse and send interest, no account needed.',
        {
          count: summary?.item_count ?? items.length,
          place,
          businesses: businessCount,
          destinations: destinations.length,
        }
      )
    : t('exportCatalog.pageSubtitle', 'Browse goods available for export.');

  const cardProps = {
    formatCurrency,
    onOrderClick: () => undefined,
    isPublicView: true,
    canOrder: false,
    showCartButtons: false,
    exportInterestSource: 'public_export_catalog' as const,
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonical={code ? exportsCanonicalUrl(code) : undefined}
        // An unknown or empty origin is a soft 404: keep it out of the index.
        noindex={!code || (isEmpty && !originsLoading)}
        structuredData={
          code
            ? {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: seoTitle,
                description: seoDescription,
                url: exportsCanonicalUrl(code),
              }
            : undefined
        }
      />

      <Breadcrumbs sx={{ mb: 1.5, fontSize: 13 }}>
        <Link component={RouterLink} to="/exports" underline="hover" color="inherit">
          {t('exportsOrigin.breadcrumbExports', 'Exports')}
        </Link>
        {code ? (
          <Typography color="text.secondary" fontSize={13}>
            {t('exportsOrigin.from', 'From {{place}}', { place })}
          </Typography>
        ) : null}
      </Breadcrumbs>

      <Paper
        variant="outlined"
        sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between' }}
      >
        <Box sx={{ minWidth: 0, flex: '1 1 380px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <FlightTakeoff sx={{ fontSize: 34, color: 'text.primary' }} aria-hidden />
            <Typography variant="h4" component="h1" fontWeight={800} sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>
              {code
                ? t('exportsOrigin.pageTitle', 'Exports from {{place}}', { place, ofPlace })
                : t('exportsOrigin.breadcrumbExports', 'Exports')}
            </Typography>
          </Box>
          {code ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {t(
                'exportsOrigin.pageSubtitle',
                'Products exported from {{place}} on Rendasua, and where each one ships. Open to anyone, no account needed.',
                { place }
              )}
            </Typography>
          ) : null}
          {code && !isEmpty ? (
            <Box sx={{ display: 'flex', gap: 4, mt: 1.5 }} data-testid="exports-origin-stats">
              {[
                [summary?.item_count ?? items.length, t('exportsOrigin.statProducts', 'products')],
                [businessCount, t('exportsOrigin.statBusinesses', 'businesses')],
                [destinations.length, t('exportsOrigin.statDestinations', 'destination markets')],
              ].map(([value, label]) => (
                <Box key={String(label)}>
                  <Typography variant="h6" fontWeight={800} lineHeight={1.1}>
                    {value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : null}
        </Box>
        <ExportsDirectionBar direction="from" originCode={code} origins={origins} />
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('exportsOrigin.loadError', 'We couldn’t load these exports. Try again in a moment.')}
        </Alert>
      ) : null}

      {code && destinations.length > 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }} data-testid="exports-ships-to">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 0.5 }}>
            <Public fontSize="small" sx={{ color: 'text.secondary' }} aria-hidden />
            <Typography variant="body2" fontWeight={600}>
              {t('exportsOrigin.shipsTo', 'Ships to')}
            </Typography>
          </Box>
          <Chip
            label={t('exportsOrigin.all', 'All')}
            size="small"
            onClick={() => setShipsTo(null)}
            sx={shipsTo === null ? { bgcolor: '#101828', color: '#fff', fontWeight: 700 } : { bgcolor: '#fff', border: '1px solid #D5DCE6' }}
          />
          {destinations.map((dest) => (
            <Chip
              key={dest}
              size="small"
              label={`${dest} ${exportCountryName(dest, lang)}`}
              onClick={() => setShipsTo(dest === shipsTo ? null : dest)}
              sx={
                dest === shipsTo
                  ? { bgcolor: EXPORT_BRAND_BLUE, color: '#fff', fontWeight: 700 }
                  : { bgcolor: '#fff', border: '1px solid #D5DCE6' }
              }
            />
          ))}
        </Box>
      ) : null}

      {loading ? (
        <Box sx={GRID_SX} aria-busy="true" aria-label={t('exportsOrigin.loading', 'Loading exports…')}>
          {Array.from({ length: 8 }).map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </Box>
      ) : !code || isEmpty ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3 }} data-testid="exports-origin-empty">
          <ExportCatalogIllustration size={120} />
          <Typography variant="h6" fontWeight={700} sx={{ mt: 2 }}>
            {code
              ? t('exportsOrigin.emptyTitle', 'No exports from {{place}} yet', { place })
              : t('exportsOrigin.emptyUnknown', 'We don’t know the country code “{{code}}”.', {
                  code: rawCode ?? '',
                })}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            {t('exportsOrigin.emptyBody', 'Browse what is exported into your market instead.')}
          </Typography>
          <Button
            component={RouterLink}
            to="/exports"
            variant="contained"
            startIcon={<FlightTakeoff />}
            sx={{ bgcolor: EXPORT_BRAND_BLUE, '&:hover': { bgcolor: '#083F91' } }}
          >
            {t('exportsOrigin.emptyCta', 'Go to Exports')}
          </Button>
        </Paper>
      ) : (
        sections.map((section) => {
          const open = expanded[section.name] === true;
          const shown = open ? section.items : section.items.slice(0, SECTION_PREVIEW);
          return (
            <Box key={section.name} component="section" sx={{ mb: 3 }} data-testid="exports-category-section">
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6" component="h2" fontWeight={800}>
                  {section.name}{' '}
                  <Typography component="span" variant="body2" color="text.secondary">
                    {t('exportsOrigin.itemsCount', { count: section.items.length, defaultValue: '{{count}} items' })}
                  </Typography>
                </Typography>
                {section.items.length > SECTION_PREVIEW ? (
                  <Button
                    size="small"
                    onClick={() => setExpanded((prev) => ({ ...prev, [section.name]: !open }))}
                    sx={{ fontWeight: 700, color: EXPORT_BRAND_BLUE, textTransform: 'none' }}
                  >
                    {open
                      ? t('exportsOrigin.showLess', 'Show less')
                      : t('exportsOrigin.seeAll', 'See all {{count}} ›', { count: section.items.length })}
                  </Button>
                ) : null}
              </Box>
              <Box sx={GRID_SX}>
                {shown.map((row) => (
                  <DashboardItemCard key={row.id} item={row} {...cardProps} />
                ))}
              </Box>
            </Box>
          );
        })
      )}
    </Container>
  );
};

export default ExportsFromCountryPage;
