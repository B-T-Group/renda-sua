import { Search as SearchIcon } from '@mui/icons-material';
import {
  Box,
  Button,
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
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  useRentalListings,
  type RentalListingsSortMode,
} from '../../hooks/useRentalListings';
import LoadingPage from '../common/LoadingPage';
import { RentalItemCard } from '../rentals/RentalItemCard';
import { RENTAL_REQUEST_SECTION_ID } from '../rentals/RentalListingRequestSection';
import SEOHead from '../seo/SEOHead';

/** Prevents MUI Select labels from collapsing to a single character in flex/grid layouts. */
const rentalFilterFormControlSx = {
  width: '100%',
  minWidth: { xs: 0, sm: 240, md: 220 },
  maxWidth: '100%',
} as const;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

const RentalsPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const [sort, setSort] = useState<RentalListingsSortMode>('relevance');
  const { listings, loading, error } = useRentalListings({ sort });

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    listings.forEach((r) => {
      const c = r.rental_item.rental_category;
      map.set(c.id, c.name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [listings]);

  const filtered = useMemo(() => {
    const q = norm(search);
    return listings.filter((r) => {
      if (categoryId && r.rental_item.rental_category.id !== categoryId) {
        return false;
      }
      if (!q) return true;
      const a = r.business_location.address ?? {};
      const blob = [
        r.rental_item.name,
        r.rental_item.description,
        r.rental_item.business.name,
        r.business_location.name,
        a.city,
        a.state,
        a.country,
        r.rental_item.rental_category.name,
        ...(r.rental_item.tags ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [listings, search, categoryId]);

  const hasActiveFilters = Boolean(search.trim() || categoryId);

  const clearFilters = () => {
    setSearch('');
    setCategoryId('');
  };

  if (loading) {
    return (
      <LoadingPage
        message={t('rentals.loading', 'Loading rentals')}
        subtitle={t('rentals.loadingSubtitle', 'Please wait')}
        showProgress
      />
    );
  }

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
              {t(
                'rentals.catalog.subtitle',
                'Browse verified business-operated rentals. Filter by category and location, then request dates on the listing page.'
              )}
            </Typography>
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
            }}
          >
            <Stack spacing={2}>
              <TextField
                fullWidth
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
              <Grid container spacing={2} alignItems="flex-end">
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={4}
                  sx={{ minWidth: { xs: 0, sm: 240, md: 220 }, maxWidth: '100%' }}
                >
                  <FormControl fullWidth size="small" sx={rentalFilterFormControlSx}>
                    <InputLabel id="rental-filter-category">
                      {t('rentals.catalog.filterCategory', 'Category')}
                    </InputLabel>
                    <Select
                      labelId="rental-filter-category"
                      label={t('rentals.catalog.filterCategory', 'Category')}
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value as string)}
                    >
                      <MenuItem value="">
                        <em>{t('rentals.catalog.all', 'All')}</em>
                      </MenuItem>
                      {categoryOptions.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={4}
                  sx={{ minWidth: { xs: 0, sm: 240, md: 220 }, maxWidth: '100%' }}
                >
                  <FormControl fullWidth size="small" sx={rentalFilterFormControlSx}>
                    <InputLabel id="rental-filter-sort">
                      {t('rentals.catalog.filterSort', 'Sort by')}
                    </InputLabel>
                    <Select
                      labelId="rental-filter-sort"
                      label={t('rentals.catalog.filterSort', 'Sort by')}
                      value={sort}
                      onChange={(e) =>
                        setSort(e.target.value as RentalListingsSortMode)
                      }
                    >
                      <MenuItem value="relevance">
                        {t('rentals.catalog.sortRelevance', 'Relevance')}
                      </MenuItem>
                      <MenuItem value="newest">
                        {t('rentals.catalog.sortNewest', 'Recently updated')}
                      </MenuItem>
                      <MenuItem value="fastest">
                        {t('rentals.catalog.sortFastest', 'Nearest first')}
                      </MenuItem>
                      <MenuItem value="cheapest">
                        {t('rentals.catalog.sortCheapest', 'Lowest price / day')}
                      </MenuItem>
                      <MenuItem value="expensive">
                        {t('rentals.catalog.sortExpensive', 'Highest price / day')}
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

          {error && (
            <Typography color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={1}
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle1" fontWeight={700} color="text.secondary">
              {t('rentals.catalog.results', {
                defaultValue: '{{count}} listings',
                count: filtered.length,
              })}
            </Typography>
          </Stack>

          {!listings.length && !error ? (
            <Typography sx={{ py: 4 }} color="text.secondary">
              {t('rentals.empty', 'No rentals available yet.')}
            </Typography>
          ) : filtered.length === 0 ? (
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
                {t('rentals.catalog.noResults', 'No listings match your filters')}
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {t(
                  'rentals.catalog.noResultsHint',
                  'Try different keywords or clear filters to see all rentals.'
                )}
              </Typography>
              {hasActiveFilters && (
                <Button variant="contained" onClick={clearFilters}>
                  {t('rentals.catalog.clearFilters', 'Clear filters')}
                </Button>
              )}
            </Paper>
          ) : (
            <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
              {filtered.map((row) => (
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
