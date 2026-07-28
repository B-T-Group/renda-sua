import { Search as SearchIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MarketSelector } from '../market/MarketSelector';
import {
  RentalCardSkeleton,
  RentalLocationsStrip,
} from '../rentals/RentalLocationsStrip';
import { RentalItemCard } from '../rentals/RentalItemCard';
import { RENTAL_REQUEST_SECTION_ID } from '../rentals/RentalListingRequestSection';
import SEOHead from '../seo/SEOHead';
import { useMarket } from '../../hooks/useMarket';
import { usePublicBrowserGeo } from '../../hooks/usePublicBrowserGeo';
import { useRentalCategories } from '../../hooks/useRentalCategories';
import {
  useRentalListings,
  useRentalTopLocations,
  type RentalListingsSortMode,
} from '../../hooks/useRentalListings';

const SORT_MODES: RentalListingsSortMode[] = [
  'relevance',
  'newest',
  'fastest',
  'cheapest',
  'expensive',
];

const rentalFilterFormControlSx = {
  width: '100%',
  minWidth: { xs: 0, sm: 240, md: 220 },
  maxWidth: '100%',
} as const;

const RentalsPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedMarket, hydrated: marketHydrated } = useMarket();

  const [sort, setSort] = useState<RentalListingsSortMode>(
    () => (searchParams.get('sort') as RentalListingsSortMode) || 'relevance'
  );
  const [searchDraft, setSearchDraft] = useState(
    () => searchParams.get('q') ?? ''
  );
  const [debouncedSearch, setDebouncedSearch] = useState(searchDraft);
  const [categoryId, setCategoryId] = useState(
    () => searchParams.get('category') ?? ''
  );
  const [operationMode, setOperationMode] = useState<
    '' | 'business_operated' | 'take_home'
  >(
    () =>
      (searchParams.get('mode') as '' | 'business_operated' | 'take_home') ?? ''
  );
  const [locationFilterId, setLocationFilterId] = useState(
    () => searchParams.get('location') ?? ''
  );
  const prevMarketIdRef = useRef<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchDraft.trim()), 450);
    return () => window.clearTimeout(id);
  }, [searchDraft]);

  useEffect(() => {
    const marketId = selectedMarket?.id ?? null;
    if (prevMarketIdRef.current && prevMarketIdRef.current !== marketId) {
      setLocationFilterId('');
    }
    prevMarketIdRef.current = marketId;
  }, [selectedMarket?.id]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch) next.set('q', debouncedSearch);
    if (categoryId) next.set('category', categoryId);
    if (sort !== 'relevance') next.set('sort', sort);
    if (operationMode) next.set('mode', operationMode);
    if (locationFilterId) next.set('location', locationFilterId);
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, categoryId, sort, operationMode, locationFilterId, setSearchParams]);

  const wantsBrowserGeo =
    marketHydrated &&
    (sort === 'fastest' ||
      (!debouncedSearch && !categoryId && !operationMode));
  const browserGeo = usePublicBrowserGeo(wantsBrowserGeo);

  const { categories } = useRentalCategories();
  const {
    listings,
    loading,
    loadingMore,
    error,
    total,
    loadMore,
    refetch,
    catalogReady,
  } = useRentalListings({
    sort,
    q: debouncedSearch,
    category_id: categoryId || undefined,
    operation_mode: operationMode || undefined,
    origin_lat: browserGeo?.lat,
    origin_lng: browserGeo?.lng,
    business_location_id: locationFilterId || undefined,
    enabled: marketHydrated,
  });

  const showLocationsStrip =
    catalogReady &&
    !debouncedSearch &&
    !categoryId &&
    !operationMode;

  const { locations: topLocations, loading: topLocationsLoading } =
    useRentalTopLocations({
      enabled: showLocationsStrip,
      origin_lat: browserGeo?.lat,
      origin_lng: browserGeo?.lng,
    });

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const canLoadMore = !loading && !loadingMore && listings.length > 0 && listings.length < total;

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !canLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canLoadMore, loadMore]);

  const marketLabel = useMemo(() => {
    if (!selectedMarket) return '';
    const statePart = selectedMarket.stateCode
      ? selectedMarket.stateName ?? selectedMarket.stateCode
      : t('market.selector.allStates', 'All');
    return `${selectedMarket.name} · ${statePart}`;
  }, [selectedMarket, t]);

  const hasActiveFilters = Boolean(
    debouncedSearch || categoryId || operationMode || locationFilterId
  );

  const clearFilters = useCallback(() => {
    setSearchDraft('');
    setDebouncedSearch('');
    setCategoryId('');
    setOperationMode('');
    setLocationFilterId('');
  }, []);

  const sortLabel = (mode: RentalListingsSortMode) => {
    const map: Record<RentalListingsSortMode, string> = {
      relevance: t('rentals.catalog.sortRelevance', 'Relevance'),
      newest: t('rentals.catalog.sortNewest', 'Recently updated'),
      fastest: t('rentals.catalog.sortFastest', 'Closest to you'),
      cheapest: t('rentals.catalog.sortCheapest', 'Lowest price / day'),
      expensive: t('rentals.catalog.sortExpensive', 'Highest price / day'),
    };
    return map[mode];
  };

  return (
    <>
      <SEOHead
        title={t('rentals.title', 'Available rentals')}
        description={t(
          'rentals.metaDescription',
          'Browse business-operated rentals on Rendasua'
        )}
      />
      <Box
        sx={{
          minHeight: '100%',
          pb: { xs: 2, md: 4 },
          bgcolor: alpha(theme.palette.divider, 0.04),
        }}
      >
        <Box
          sx={{
            background: `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.primary.dark, 0.06)} 45%, ${alpha(theme.palette.background.default, 1)} 100%)`,
            borderBottom: 1,
            borderColor: 'divider',
            pt: { xs: 3, md: 5 },
            pb: { xs: 3, md: 4 },
          }}
        >
          <Container maxWidth="lg">
            <Typography
              variant="overline"
              color="primary"
              fontWeight={800}
              letterSpacing={0.12}
              sx={{ display: 'block', mb: 1 }}
            >
              {t('rentals.catalog.heroEyebrow', 'Rentals')}
            </Typography>
            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.02em',
                fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.75rem' },
                maxWidth: 720,
              }}
            >
              {t('rentals.title', 'Rentals')}
            </Typography>
            <Typography
              color="text.secondary"
              sx={{ mt: 1.5, maxWidth: 640, lineHeight: 1.65, fontSize: { xs: '0.95rem', sm: '1rem' } }}
            >
              {selectedMarket
                ? t('rentals.catalog.subtitleMarket', 'Showing rentals in {{market}}', {
                    market: marketLabel,
                  })
                : t(
                    'rentals.catalog.subtitle',
                    'Browse verified business-operated rentals. Filter by category and location, then request dates on the listing page.'
                  )}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
              <MarketSelector catalogContext="rentals" />
            </Stack>
            <CatalogNotice />
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 3 }, px: { xs: 2, sm: 3 } }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              mb: 3,
              borderRadius: 3,
              border: 1,
              borderColor: 'divider',
              position: 'sticky',
              top: { xs: 0, md: 8 },
              zIndex: 2,
              bgcolor: 'background.paper',
            }}
          >
            <Stack spacing={2}>
              <TextField
                fullWidth
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder={t(
                  'rentals.catalog.searchPlaceholder',
                  'Search by name, business, location, or tags…'
                )}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                inputProps={{ 'aria-label': t('rentals.catalog.searchAria', 'Search rentals') }}
              />
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {SORT_MODES.map((mode) => (
                  <Chip
                    key={mode}
                    label={sortLabel(mode)}
                    color={sort === mode ? 'primary' : 'default'}
                    variant={sort === mode ? 'filled' : 'outlined'}
                    onClick={() => setSort(mode)}
                  />
                ))}
              </Stack>
              {sort === 'fastest' && !browserGeo ? (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  {t(
                    'rentals.catalog.locationHint',
                    'Allow location access to sort rentals closest to you.'
                  )}
                </Alert>
              ) : null}
              <Grid container spacing={2} alignItems="flex-end">
                <Grid item xs={12} sm={6} md={4} sx={{ minWidth: { xs: 0, sm: 240, md: 220 }, maxWidth: '100%' }}>
                  <FormControl fullWidth size="small" sx={rentalFilterFormControlSx}>
                    <InputLabel id="rental-filter-category">
                      {t('rentals.catalog.filterCategory', 'Category')}
                    </InputLabel>
                    <Select
                      labelId="rental-filter-category"
                      label={t('rentals.catalog.filterCategory', 'Category')}
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      <MenuItem value="">
                        <em>{t('rentals.catalog.all', 'All')}</em>
                      </MenuItem>
                      {categories.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={4} sx={{ minWidth: { xs: 0, sm: 240, md: 220 }, maxWidth: '100%' }}>
                  <FormControl fullWidth size="small" sx={rentalFilterFormControlSx}>
                    <InputLabel id="rental-filter-mode">
                      {t('rentals.catalog.filterMode', 'Mode')}
                    </InputLabel>
                    <Select
                      labelId="rental-filter-mode"
                      label={t('rentals.catalog.filterMode', 'Mode')}
                      value={operationMode}
                      onChange={(e) =>
                        setOperationMode(
                          e.target.value as '' | 'business_operated' | 'take_home'
                        )
                      }
                    >
                      <MenuItem value="">{t('rentals.catalog.modeAll', 'All modes')}</MenuItem>
                      <MenuItem value="business_operated">
                        {t('rentals.catalog.modeOperated', 'Operated')}
                      </MenuItem>
                      <MenuItem value="take_home">
                        {t('rentals.catalog.modeTakeHome', 'Take-home')}
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={4} display="flex" alignItems="flex-end">
                  <Button
                    variant="text"
                    color="inherit"
                    disabled={!hasActiveFilters}
                    onClick={clearFilters}
                    sx={{ fontWeight: 600 }}
                  >
                    {t('rentals.catalog.clearFilters', 'Clear filters')}
                  </Button>
                </Grid>
              </Grid>
            </Stack>
          </Paper>

          {showLocationsStrip ? (
            <RentalLocationsStrip
              locations={topLocations}
              loading={topLocationsLoading}
              selectedLocationId={locationFilterId || undefined}
              onSelectLocation={(id) =>
                setLocationFilterId((prev) => (prev === id ? '' : id))
              }
            />
          ) : null}

          {error ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Typography color="error">{error}</Typography>
              <Button size="small" onClick={() => void refetch()}>
                {t('common.retry', 'Retry')}
              </Button>
            </Stack>
          ) : null}

          <Typography variant="subtitle1" fontWeight={700} color="text.secondary" sx={{ mb: 2 }}>
            {loading && listings.length === 0
              ? t('rentals.loading', 'Loading rentals')
              : t('rentals.catalog.resultsInMarket', '{{count}} rentals in {{market}}', {
                  count: total,
                  market: marketLabel || t('rentals.catalog.yourMarket', 'your market'),
                })}
          </Typography>

          {loading && listings.length === 0 ? (
            <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <RentalCardSkeleton />
                </Grid>
              ))}
            </Grid>
          ) : listings.length === 0 && !error ? (
            <Paper
              variant="outlined"
              sx={{
                py: 6,
                px: 3,
                textAlign: 'center',
                borderRadius: 3,
                borderStyle: 'dashed',
              }}
            >
              <Typography variant="h6" gutterBottom fontWeight={700}>
                {hasActiveFilters
                  ? t('rentals.catalog.noResults', 'No listings match your filters')
                  : t('rentals.catalog.emptyTitle', 'No rentals here yet')}
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {t(
                  'rentals.catalog.noResultsHint',
                  'Try different keywords, change your market, or clear filters.'
                )}
              </Typography>
              {hasActiveFilters ? (
                <Button variant="contained" onClick={clearFilters}>
                  {t('rentals.catalog.clearFilters', 'Clear filters')}
                </Button>
              ) : null}
            </Paper>
          ) : (
            <>
              <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
                {listings.map((row) => (
                  <Grid item xs={12} sm={6} md={4} key={row.id}>
                    <RentalItemCard
                      listing={row}
                      onViewDetails={() => navigate(`/rentals/${row.id}`)}
                      onRequestRental={() =>
                        navigate(`/rentals/${row.id}#${RENTAL_REQUEST_SECTION_ID}`)
                      }
                    />
                  </Grid>
                ))}
              </Grid>
              <Box ref={loadMoreRef} sx={{ height: 8, width: '100%' }} />
              {loadingMore ? (
                <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                  {t('common.loading', 'Loading…')}
                </Typography>
              ) : null}
            </>
          )}
        </Container>
      </Box>
    </>
  );
};

function CatalogNotice() {
  const { t } = useTranslation();
  return (
    <Paper
      elevation={0}
      sx={{
        mt: 3,
        p: 2,
        borderRadius: 2,
        bgcolor: (th) => alpha(th.palette.info.main, 0.08),
        border: 1,
        borderColor: (th) => alpha(th.palette.info.main, 0.25),
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
        {t(
          'rentals.businessOperatedNotice',
          'All rentals are operated by the business (you do not take equipment home unattended).'
        )}
      </Typography>
    </Paper>
  );
}

export default RentalsPage;
