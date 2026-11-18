import {
  CalendarMonthOutlined,
  Close,
  DirectionsCarOutlined,
  HandymanOutlined,
  HomeOutlined,
  PhotoCameraOutlined,
  Search as SearchIcon,
  VolumeUpOutlined,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RentalCardSkeleton } from '../rentals/RentalLocationsStrip';
import { RentalItemCard } from '../rentals/RentalItemCard';
import SEOHead from '../seo/SEOHead';
import { useMarket } from '../../hooks/useMarket';
import { formatExclusiveStay, formatExclusiveStayRange } from '../../utils/rentalRequestFormat';
import {
  useRentalSearchCatalog,
  useTopRentalCategories,
  type RentalCatalogSort,
} from '../../hooks/useRentalSearchCatalog';

const SORTS: RentalCatalogSort[] = ['recommended', 'relevance', 'newest', 'cheapest', 'expensive'];

const RentalsDefaultCatalog: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedMarket } = useMarket();
  const [draft, setDraft] = useState(() => searchParams.get('q') ?? '');
  const [query, setQuery] = useState(draft);
  const [categoryId, setCategoryId] = useState(() => searchParams.get('category') ?? '');
  const [sort, setSort] = useState<RentalCatalogSort>(readSort(searchParams.get('sort')));
  const [start, setStart] = useState(() => searchParams.get('start') ?? '');
  const [end, setEnd] = useState(() => searchParams.get('end') ?? '');
  const [dateOpen, setDateOpen] = useState(false);
  const stay = useMemo(() => catalogStay(start, end), [start, end]);
  const { categories, loading: categoriesLoading } = useTopRentalCategories();
  const catalog = useRentalSearchCatalog({
    sort,
    q: query,
    categoryId,
    startDate: stay?.startDate,
    endDate: stay?.endDate,
  });

  useEffect(() => {
    const timer = setTimeout(() => setQuery(draft.trim()), 250);
    return () => clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (categoryId) next.set('category', categoryId);
    if (sort !== 'recommended') next.set('sort', sort);
    if (stay) {
      next.set('start', stay.startDate);
      next.set('end', stay.endDate);
    }
    setSearchParams(next, { replace: true });
  }, [categoryId, query, setSearchParams, sort, stay]);

  const market = marketLabel(selectedMarket, t('market.selector.allStates', 'All'));
  const filtered = Boolean(query || categoryId || stay);
  const emptyMarket = !catalog.loading && catalog.hits.length === 0 && !filtered;
  return (
    <Box sx={{ bgcolor: 'background.default', pb: 6 }} data-testid="rentals-default-catalog">
      <SEOHead title={t('rentals.catalog.heroEyebrow', 'Rentals')} description={market} />
      <CatalogHero market={market} />
      <Container maxWidth="lg" sx={{ mt: -2 }}>
        <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3 }}>
          <SearchField
            value={draft}
            onChange={setDraft}
            onClear={() => setDraft('')}
            placeholder={t('rentals.catalog.listPlaceholder', 'Search cameras, tools, sound...')}
          />
          <DatesRow stay={stay} locale={i18n.language} onOpen={() => setDateOpen(true)} />
        </Paper>
        <CategoryStrip
          categories={categories}
          loading={categoriesLoading && categories.length === 0}
          activeId={categoryId}
          sort={sort}
          onSort={setSort}
          onPick={(id) => setCategoryId(categoryId === id ? '' : id)}
        />
        {catalog.loading && catalog.hits.length === 0 || emptyMarket ? null : (
          <ResultHeading count={catalog.total} dated={Boolean(stay)} />
        )}
        <CatalogResults
          loading={catalog.loading}
          emptyMarket={emptyMarket}
          city={selectedMarket?.name ?? ''}
          hits={catalog.hits}
          stayLabel={stay ? formatStay(stay, i18n.language) : null}
          onOpen={(id) => navigate(`/rentals/${id}`)}
        />
        {catalog.hits.length > 0 && (catalog.hasMore ?? catalog.hits.length < catalog.total) ? (
          <Button fullWidth variant="outlined" sx={{ mt: 2 }} onClick={catalog.loadMore} disabled={catalog.loadingMore}>
            {catalog.loadingMore
              ? t('rentals.catalog.loadingMore', 'Loading more…')
              : t('rentals.catalog.loadMore', 'Load more')}
          </Button>
        ) : null}
      </Container>
      <DateDialog
        open={dateOpen}
        start={start}
        end={end}
        onClose={() => setDateOpen(false)}
        onApply={(nextStart, nextEnd) => {
          setStart(nextStart);
          setEnd(nextEnd);
          setDateOpen(false);
        }}
        onClear={() => {
          setStart('');
          setEnd('');
          setDateOpen(false);
        }}
      />
    </Box>
  );
};

function CatalogHero({ market }: { market: string }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ bgcolor: 'grey.100', pt: 4, pb: 5, px: 2 }}>
      <Container maxWidth="lg">
        <Typography variant="overline" color="primary" fontWeight={700}>
          {t('rentals.catalog.heroEyebrow', 'Rentals')}
        </Typography>
        <Typography variant="h3" fontWeight={800}>{t('rentals.catalog.heroTitle', 'Rentals')}</Typography>
        <Typography color="text.secondary">
          {t('rentals.catalog.subtitleAt', 'Showing rentals in {{market}}', { market: market || t('rentals.catalog.yourMarket', 'your market') })}
        </Typography>
      </Container>
    </Box>
  );
}

function SearchField({ value, onChange, onClear, placeholder }: { value: string; onChange: (value: string) => void; onClear: () => void; placeholder: string }) {
  return (
    <TextField
      fullWidth
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      inputProps={{ 'aria-label': placeholder }}
      InputProps={{
        startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
        endAdornment: value ? <Close sx={{ cursor: 'pointer' }} onClick={onClear} aria-label="clear" /> : null,
      }}
    />
  );
}

function DatesRow({ stay, locale, onOpen }: { stay: CatalogStay | null; locale: string; onOpen: () => void }) {
  const { t } = useTranslation();
  const label = stay
    ? formatExclusiveStay(stay.startDate, stay.endDate, locale, (count) =>
        t('rentals.catalog.dayCount', '{{count}} days', { count })
      )
    : null;
  return (
    <Paper variant="outlined" onClick={onOpen} sx={{ mt: 1.5, p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center', cursor: 'pointer', borderColor: 'primary.main', bgcolor: 'rgba(10, 79, 181, 0.06)' }}>
      <CalendarMonthOutlined color="primary" />
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">
          {stay ? t('rentals.catalog.yourDates', 'YOUR DATES') : t('rentals.catalog.datesOptional', 'DATES (OPTIONAL)')}
        </Typography>
        <Typography fontWeight={700}>
          {label ?? t('rentals.catalog.addToSee', "Add to see what's free")}
        </Typography>
      </Box>
      <Button
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        {stay ? t('rentals.catalog.edit', 'Edit') : t('rentals.catalog.add', 'Add')}
      </Button>
    </Paper>
  );
}

function CategoryStrip(props: {
  categories: Array<{ id: string; name: string }>;
  loading: boolean;
  activeId: string;
  sort: RentalCatalogSort;
  onSort: (sort: RentalCatalogSort) => void;
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2, overflowX: 'auto' }}>
      {props.loading
        ? [0, 1, 2, 3, 4].map((id) => <Chip key={id} label=" " sx={{ width: 96 }} />)
        : props.categories.map((category) => (
            <Chip
              key={category.id}
              icon={categoryIcon(category.name)}
              label={categoryLabel(category.name, t)}
              clickable
              color={props.activeId === category.id ? 'primary' : 'default'}
              variant={props.activeId === category.id ? 'filled' : 'outlined'}
              onClick={() => props.onPick(category.id)}
            />
          ))}
      <Box sx={{ flex: 1 }} />
      <TextField select size="small" value={props.sort} onChange={(event) => props.onSort(event.target.value as RentalCatalogSort)} sx={{ minWidth: 160 }}>
        {SORTS.map((mode) => (
          <MenuItem key={mode} value={mode}>{t(`rentals.catalog.sort.${mode}`, sortFallback(mode))}</MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}

function ResultHeading({ count, dated }: { count: number; dated: boolean }) {
  const { t } = useTranslation();
  return (
    <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1.5 }}>
      {dated
        ? t('rentals.catalog.matches', '{{count}} matches · available for your dates first', { count })
        : t('rentals.catalog.countOnly', '{{count}} rentals · add dates to sort by availability', { count })}
    </Typography>
  );
}

function CatalogResults({ loading, emptyMarket, city, hits, stayLabel, onOpen }: {
  loading: boolean;
  emptyMarket: boolean;
  city: string;
  hits: ReturnType<typeof useRentalSearchCatalog>['hits'];
  stayLabel: string | null;
  onOpen: (id: string) => void;
}) {
  if (loading && hits.length === 0) {
    return (
      <Box data-testid="rentals-catalog-skeletons" sx={{ display: 'grid', gap: 2, alignItems: 'stretch', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
        {[0, 1, 2, 3, 4, 5].map((id) => <RentalCardSkeleton key={id} />)}
      </Box>
    );
  }
  if (emptyMarket) return <EmptyMarket city={city} />;
  return (
    <Box sx={{ display: 'grid', gap: 2, alignItems: 'stretch', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
      {hits.map((hit) => (
        <Box key={hit.listing.id} sx={{ minWidth: 0, display: 'flex' }}>
          <RentalItemCard
            variant="daily"
            listing={{ ...hit.listing, inspection_enabled: hit.inspection_enabled === true }}
            availability={{
              available: hit.available,
              nextAvailableDate: hit.nextAvailableDate,
              totalForDates: hit.totalForDates,
              dayCount: hit.dayCount,
              rangeLabel: stayLabel,
            }}
            onViewDetails={() => onOpen(hit.listing.id)}
            onRequestRental={() => onOpen(hit.listing.id)}
          />
        </Box>
      ))}
    </Box>
  );
}

function EmptyMarket({ city }: { city: string }) {
  const { t } = useTranslation();
  return (
    <Paper variant="outlined" data-testid="rentals-empty-market" sx={{ py: 8, px: 3, textAlign: 'center', borderStyle: 'dashed', borderRadius: 3 }}>
      <EmptySearchMark />
      <Typography variant="h6" fontWeight={800} sx={{ mt: 2 }}>
        {t('rentals.catalog.emptyMarketTitle', 'No rentals here yet')}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 460, mx: 'auto', mt: 1 }}>
        {t(
          'rentals.catalog.emptyMarketBody',
          'Nothing is listed in {{city}} yet. Try another city, or search by name.',
          { city }
        )}
      </Typography>
    </Paper>
  );
}

function EmptySearchMark() {
  return (
    <Box component="svg" viewBox="0 0 72 72" sx={{ width: 72, height: 72, color: 'primary.main' }} aria-hidden>
      <rect width="72" height="72" rx="20" fill="currentColor" opacity="0.12" />
      <circle cx="32" cy="32" r="12" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M41 41 L52 52" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </Box>
  );
}

function DateDialog({ open, start, end, onClose, onApply, onClear }: { open: boolean; start: string; end: string; onClose: () => void; onApply: (start: string, end: string) => void; onClear: () => void }) {
  const { t } = useTranslation();
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end);
  useEffect(() => {
    if (!open) return;
    setDraftStart(start);
    setDraftEnd(end);
  }, [end, open, start]);
  const valid = catalogStay(draftStart, draftEnd) != null;
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField type="date" label={t('rentals.catalog.start', 'Start')} value={draftStart} onChange={(event) => setDraftStart(event.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField type="date" label={t('rentals.catalog.end', 'End')} value={draftEnd} onChange={(event) => setDraftEnd(event.target.value)} InputLabelProps={{ shrink: true }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClear}>{t('rentals.catalog.clearDates', 'Clear dates')}</Button>
        <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
        <Button variant="contained" disabled={!valid} onClick={() => onApply(draftStart, draftEnd)}>
          {t('rentals.catalog.add', 'Add')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type CatalogStay = { startDate: string; endDate: string };

function catalogStay(start: string, end: string): CatalogStay | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  const dayCount = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
  if (dayCount < 1 || dayCount > 30) return null;
  return { startDate: start, endDate: end };
}

function formatStay(stay: CatalogStay, locale: string): string {
  return formatExclusiveStayRange(stay.startDate, stay.endDate, locale);
}

function marketLabel(market: { name?: string; stateCode?: string | null; stateName?: string | null } | null, all: string): string {
  if (!market?.name) return '';
  const state = market.stateCode ? market.stateName ?? market.stateCode : all;
  return `${market.name} · ${state}`;
}

function readSort(value: string | null): RentalCatalogSort {
  return SORTS.includes(value as RentalCatalogSort) ? (value as RentalCatalogSort) : 'recommended';
}

function sortFallback(mode: RentalCatalogSort): string {
  if (mode === 'recommended') return 'Recommended';
  if (mode === 'relevance') return 'Relevance';
  if (mode === 'newest') return 'Recently updated';
  if (mode === 'cheapest') return 'Lowest price / day';
  return 'Highest price / day';
}

function categoryLabel(name: string, t: (key: string, fallback: string) => string): string {
  const key = name.trim().toLowerCase();
  const keys: Record<string, [string, string]> = {
    cameras: ['rentals.catalog.categoryCameras', 'Cameras'],
    tools: ['rentals.catalog.categoryTools', 'Tools'],
    sound: ['rentals.catalog.categorySound', 'Sound'],
    events: ['rentals.catalog.categoryEvents', 'Events'],
    vehicles: ['rentals.catalog.categoryVehicles', 'Vehicles'],
  };
  const match = keys[key];
  return match ? t(match[0], match[1]) : name;
}

function categoryIcon(name: string): React.ReactElement {
  const key = name.toLowerCase();
  if (/camera|photo|appareil/.test(key)) return <PhotoCameraOutlined />;
  if (/tool|outil/.test(key)) return <HandymanOutlined />;
  if (/sound|audio|sono|\bson\b/.test(key)) return <VolumeUpOutlined />;
  if (/event|événement|evenement/.test(key)) return <HomeOutlined />;
  if (/vehicle|véhicule|vehicule/.test(key)) return <DirectionsCarOutlined />;
  return <PhotoCameraOutlined />;
}

export default RentalsDefaultCatalog;
