import { CheckCircle, Insights, ShoppingCart } from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { endOfDay, startOfDay, startOfMonth, type Locale } from 'date-fns';
import { enUS, fr as frLocale } from 'date-fns/locale';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminCompensationEventsDialog } from '../admin/AdminCompensationEventsDialog';
import { AdminPayoutPreviewDialog } from '../admin/AdminPayoutPreviewDialog';
import { PerformanceMetricCard } from '../admin/performance/PerformanceMetricCard';
import { PlatformOrdersOverview } from '../admin/performance/PlatformOrdersOverview';
import { PlatformPayoutsCard } from '../admin/performance/PlatformPayoutsCard';
import { PlatformSalesCard } from '../admin/performance/PlatformSalesCard';
import { TopAgentsDeliveriesTable } from '../admin/performance/TopAgentsDeliveriesTable';
import { TopAgentsReferralsTable } from '../admin/performance/TopAgentsReferralsTable';
import { TopStoresTable } from '../admin/performance/TopStoresTable';
import SEOHead from '../seo/SEOHead';
import LoadingScreen from '../common/LoadingScreen';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  GOLDEN_ITEMS_PER_REFERRAL,
  PERFORMANCE_PERIODS,
  type PerformanceCustomRange,
  type PerformanceMarket,
  type PerformancePeriod,
  type PerformanceSummary,
  type PlatformMetrics,
  type TopAgentEntry,
  useAdminPerformance,
} from '../../hooks/useAdminPerformance';
import { usePermission } from '../../hooks/usePermissions';

const PERIOD_LABELS: Record<PerformancePeriod, [string, string]> = {
  this_week: ['admin.performance.periods.thisWeek', 'This week'],
  last_week: ['admin.performance.periods.lastWeek', 'Last week'],
  this_month: ['admin.performance.periods.thisMonth', 'This month'],
  last_month: ['admin.performance.periods.lastMonth', 'Last month'],
  this_year: ['admin.performance.periods.thisYear', 'This year'],
  last_year: ['admin.performance.periods.lastYear', 'Last year'],
  custom: ['admin.performance.periods.custom', 'Custom'],
};

const AdminPerformancePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { profile, loading: profileLoading } = useUserProfileContext();
  const canAccess = usePermission(PlatformPermissions.DASHBOARD_PLATFORM_STATS);
  const {
    fetchMarkets,
    fetchSummary,
    fetchPlatformMetrics,
    fetchTopAgents,
    fetchPayoutPreview,
    fetchCompensationEvents,
    error,
  } = useAdminPerformance();
  const api = useMemo(
    () => ({
      fetchMarkets,
      fetchSummary,
      fetchPlatformMetrics,
      fetchTopAgents,
      fetchPayoutPreview,
      fetchCompensationEvents,
    }),
    [
      fetchMarkets,
      fetchSummary,
      fetchPlatformMetrics,
      fetchTopAgents,
      fetchPayoutPreview,
      fetchCompensationEvents,
    ]
  );
  const filters = usePerformanceFilters(canAccess, api);

  if (profileLoading) return <LoadingScreen open />;
  if (!profile?.business || !canAccess) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography color="error">
          {t(
            'admin.performance.unauthorized',
            'You are not authorized to access this page'
          )}
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <SEOHead
        title={t('admin.performance.pageTitle', 'Platform performance')}
        description={t(
          'admin.performance.pageDescription',
          'Orders, sales, payouts, and agent performance by market and period.'
        )}
        keywords={t(
          'admin.performance.pageKeywords',
          'admin, performance, metrics, markets, agents'
        )}
      />
      <PageHeader />
      <FilterBar
        filters={filters}
        api={api}
        dateLocale={i18n.language === 'fr' ? frLocale : enUS}
      />
      {filters.rangeInvalid && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t(
            'admin.performance.platform.invalidRange',
            'The start date must be on or before the end date.'
          )}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <PlatformSection filters={filters} />
      <GrowthSection summary={filters.summary} />
      <AgentsSection filters={filters} />
    </Container>
  );
};

interface PerformanceApi {
  fetchMarkets: () => Promise<PerformanceMarket[]>;
  fetchSummary: (
    period: PerformancePeriod,
    countryCode: string,
    custom?: PerformanceCustomRange
  ) => Promise<PerformanceSummary | null>;
  fetchPlatformMetrics: (
    period: PerformancePeriod,
    countryCode: string,
    custom?: PerformanceCustomRange
  ) => Promise<PlatformMetrics | null>;
  fetchTopAgents: (
    period: PerformancePeriod,
    countryCode: string,
    metric: 'deliveries' | 'business_referrals',
    options?: {
      minItemsPerReferral?: number;
      limit?: number;
      custom?: PerformanceCustomRange;
    }
  ) => Promise<TopAgentEntry[]>;
  fetchPayoutPreview: ReturnType<typeof useAdminPerformance>['fetchPayoutPreview'];
  fetchCompensationEvents: ReturnType<
    typeof useAdminPerformance
  >['fetchCompensationEvents'];
}

interface PerformanceFilters {
  markets: PerformanceMarket[];
  countryCode: string;
  setCountryCode: (value: string) => void;
  period: PerformancePeriod;
  setPeriod: (value: PerformancePeriod) => void;
  customFrom: Date;
  customTo: Date;
  setCustomFrom: (value: Date) => void;
  setCustomTo: (value: Date) => void;
  rangeInvalid: boolean;
  goldenOnly: boolean;
  setGoldenOnly: (value: boolean) => void;
  summary: PerformanceSummary | null;
  platform: PlatformMetrics | null;
  topDeliveries: TopAgentEntry[];
  topReferrals: TopAgentEntry[];
  loading: boolean;
}

function usePerformanceFilters(
  canAccess: boolean,
  api: PerformanceApi
): PerformanceFilters {
  const [markets, setMarkets] = useState<PerformanceMarket[]>([]);
  const [countryCode, setCountryCode] = useState('');
  const [period, setPeriod] = useState<PerformancePeriod>('this_week');
  const [customFrom, setCustomFrom] = useState(() => startOfMonth(new Date()));
  const [customTo, setCustomTo] = useState(() => new Date());
  const [goldenOnly, setGoldenOnly] = useState(false);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [platform, setPlatform] = useState<PlatformMetrics | null>(null);
  const [topDeliveries, setTopDeliveries] = useState<TopAgentEntry[]>([]);
  const [topReferrals, setTopReferrals] = useState<TopAgentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const loadSeqRef = useRef(0);
  const rangeInvalid = period === 'custom' && customFrom > customTo;
  const customRange = useMemo(
    () => customWindow(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  useEffect(() => {
    if (!canAccess) return;
    void api.fetchMarkets().then(setMarkets);
  }, [canAccess, api]);

  const load = useCallback(async () => {
    if (rangeInvalid) return;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    const loaded = await loadPerformance(api, {
      period,
      countryCode,
      customRange,
      goldenOnly,
    });
    if (seq !== loadSeqRef.current) return;
    setSummary(loaded.summary);
    setPlatform(loaded.platform);
    setTopDeliveries(loaded.deliveries);
    setTopReferrals(loaded.referrals);
    setLoading(false);
  }, [api, period, countryCode, customRange, goldenOnly, rangeInvalid]);

  useEffect(() => {
    if (!canAccess) return;
    void load();
  }, [canAccess, load]);

  return {
    markets,
    countryCode,
    setCountryCode,
    period,
    setPeriod,
    customFrom,
    customTo,
    setCustomFrom,
    setCustomTo,
    rangeInvalid,
    goldenOnly,
    setGoldenOnly,
    summary,
    platform,
    topDeliveries,
    topReferrals,
    loading,
  };
}

function customWindow(
  period: PerformancePeriod,
  from: Date,
  to: Date
): PerformanceCustomRange | undefined {
  if (period !== 'custom') return undefined;
  return { from: startOfDay(from).toISOString(), to: endOfDay(to).toISOString() };
}

async function loadPerformance(
  api: PerformanceApi,
  input: {
    period: PerformancePeriod;
    countryCode: string;
    customRange?: PerformanceCustomRange;
    goldenOnly: boolean;
  }
) {
  const referralOpts = {
    limit: 20,
    custom: input.customRange,
    minItemsPerReferral: input.goldenOnly ? GOLDEN_ITEMS_PER_REFERRAL : undefined,
  };
  const [summary, platform, deliveries, referrals] = await Promise.all([
    api.fetchSummary(input.period, input.countryCode, input.customRange),
    api.fetchPlatformMetrics(input.period, input.countryCode, input.customRange),
    api.fetchTopAgents(input.period, input.countryCode, 'deliveries', {
      custom: input.customRange,
    }),
    api.fetchTopAgents(
      input.period,
      input.countryCode,
      'business_referrals',
      referralOpts
    ),
  ]);
  return { summary, platform, deliveries, referrals };
}

function PageHeader() {
  const { t } = useTranslation();
  return (
    <>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Insights color="action" fontSize="small" />
        <Typography variant="h5" component="h1" fontWeight={700}>
          {t('admin.performance.pageTitle', 'Platform performance')}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        {t(
          'admin.performance.pageDescription',
          'Orders, sales, payouts, and agent performance by market and period.'
        )}
      </Typography>
    </>
  );
}

function FilterBar({
  filters,
  api,
  dateLocale,
}: {
  filters: PerformanceFilters;
  api: PerformanceApi;
  dateLocale: Locale;
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      alignItems={{ xs: 'stretch', md: 'center' }}
      sx={{ mb: 3 }}
      useFlexGap
      flexWrap="wrap"
    >
      <MarketSelect filters={filters} />
      <PeriodToggle filters={filters} />
      {filters.period === 'custom' && (
        <CustomRangePickers filters={filters} dateLocale={dateLocale} />
      )}
      {filters.loading && <CircularProgress size={20} />}
      <AdminPayoutPreviewDialog
        countryCode={filters.countryCode}
        fetchPreview={api.fetchPayoutPreview}
      />
      <AdminCompensationEventsDialog
        countryCode={filters.countryCode}
        fetchEvents={api.fetchCompensationEvents}
      />
    </Stack>
  );
}

function MarketSelect({ filters }: { filters: PerformanceFilters }) {
  const { t } = useTranslation();
  return (
    <FormControl size="small" sx={{ minWidth: 220 }}>
      <InputLabel id="performance-market-label">
        {t('admin.performance.marketFilter', 'Market')}
      </InputLabel>
      <Select
        labelId="performance-market-label"
        value={filters.countryCode}
        label={t('admin.performance.marketFilter', 'Market')}
        onChange={(e) => filters.setCountryCode(e.target.value)}
      >
        <MenuItem value="">{t('admin.performance.allMarkets', 'All markets')}</MenuItem>
        {filters.markets.map((market) => (
          <MenuItem key={market.countryCode} value={market.countryCode}>
            {market.countryName} ({market.countryCode})
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function PeriodToggle({ filters }: { filters: PerformanceFilters }) {
  const { t } = useTranslation();
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={filters.period}
      onChange={(_, value: PerformancePeriod | null) => {
        if (value) filters.setPeriod(value);
      }}
      sx={{ flexWrap: 'wrap' }}
    >
      {PERFORMANCE_PERIODS.map((p) => (
        <ToggleButton key={p} value={p}>
          {t(PERIOD_LABELS[p][0], PERIOD_LABELS[p][1])}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

function CustomRangePickers({
  filters,
  dateLocale,
}: {
  filters: PerformanceFilters;
  dateLocale: Locale;
}) {
  const { t } = useTranslation();
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={dateLocale}>
      <DatePicker
        label={t('admin.performance.platform.fromDate', 'From')}
        value={filters.customFrom}
        onChange={(value) => value && filters.setCustomFrom(value)}
        slotProps={{ textField: { size: 'small' } }}
      />
      <DatePicker
        label={t('admin.performance.platform.toDate', 'To')}
        value={filters.customTo}
        onChange={(value) => value && filters.setCustomTo(value)}
        slotProps={{ textField: { size: 'small' } }}
      />
    </LocalizationProvider>
  );
}

function PlatformSection({ filters }: { filters: PerformanceFilters }) {
  const { t } = useTranslation();
  const empty = t('admin.performance.topAgents.empty', 'No data for this period');
  return (
    <Box sx={{ mb: 4 }}>
      <SectionHeading
        title={t('admin.performance.platform.sectionTitle', 'Platform')}
        description={t(
          'admin.performance.platform.sectionDescription',
          'Orders placed, money collected, and payouts in the selected period.'
        )}
      />
      <PlatformOrdersOverview orders={filters.platform?.orders ?? null} />
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <PlatformSalesCard sales={filters.platform?.sales ?? []} emptyLabel={empty} />
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <PlatformPayoutsCard
            payouts={filters.platform?.payouts ?? []}
            emptyLabel={empty}
          />
        </Grid>
      </Grid>
      <Box sx={{ mt: 2 }}>
        <TopStoresTable stores={filters.platform?.topStores ?? []} emptyLabel={empty} />
      </Box>
    </Box>
  );
}

function GrowthSection({ summary }: { summary: PerformanceSummary | null }) {
  const { t } = useTranslation();
  const cards: Array<[string, string, number | null]> = [
    ['admin.performance.metrics.businessesEnrolled', 'Businesses enrolled', summary?.businessesEnrolled ?? null],
    ['admin.performance.metrics.clientsAdded', 'Clients added', summary?.clientsAdded ?? null],
    ['admin.performance.metrics.agentsAdded', 'Agents added', summary?.agentsAdded ?? null],
    ['admin.performance.metrics.saleItemsAdded', 'Sale items added', summary?.saleItemsAdded ?? null],
    ['admin.performance.metrics.rentalItemsAdded', 'Rental items added', summary?.rentalItemsAdded ?? null],
  ];
  return (
    <Box sx={{ mb: 4 }}>
      <SectionHeading
        title={t('admin.performance.platform.growthTitle', 'Growth')}
        description={t(
          'admin.performance.platform.growthDescription',
          'New businesses, customers, agents, and catalog items.'
        )}
      />
      <Grid container spacing={2}>
        {cards.map(([key, fallback, value]) => (
          <Grid key={key} size={{ xs: 12, sm: 6, md: 2.4 }}>
            <PerformanceMetricCard label={t(key, fallback)} value={value} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function AgentsSection({ filters }: { filters: PerformanceFilters }) {
  const { t } = useTranslation();
  const empty = t('admin.performance.topAgents.empty', 'No data for this period');
  const goldenEmpty = t(
    'admin.performance.topAgents.goldenEmpty',
    'No agents meet the ≥{{n}} items / referral target for this period',
    { n: GOLDEN_ITEMS_PER_REFERRAL }
  );
  return (
    <Box sx={{ mb: 3 }}>
      <SectionHeading
        title={t('admin.performance.platform.agentsTitle', 'Agents')}
        description={t(
          'admin.performance.platform.agentsDescription',
          'Who delivered orders and who brought businesses onto the platform.'
        )}
      />
      <GoldenTargetCard
        goldenOnly={filters.goldenOnly}
        onChange={filters.setGoldenOnly}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <TopAgentsDeliveriesTable agents={filters.topDeliveries} emptyLabel={empty} />
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <TopAgentsReferralsTable
            agents={filters.topReferrals}
            emptyLabel={filters.goldenOnly ? goldenEmpty : empty}
            goldenOnly={filters.goldenOnly}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

function GoldenTargetCard({
  goldenOnly,
  onChange,
}: {
  goldenOnly: boolean;
  onChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? 'rgba(46, 125, 50, 0.12)'
            : 'rgba(46, 125, 50, 0.06)',
        borderColor: 'success.light',
      }}
    >
      <CardContent
        sx={{
          py: 1.5,
          '&:last-child': { pb: 1.5 },
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { sm: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {t('admin.performance.golden.title', 'Referral quality target')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'admin.performance.golden.description',
              'Goal: each referred business should reach at least {{n}} approved sale items on average (items / referral).',
              { n: GOLDEN_ITEMS_PER_REFERRAL }
            )}
          </Typography>
          <GoldenRuleChips />
        </Box>
        <FormControlLabel
          sx={{ m: 0, flexShrink: 0 }}
          control={
            <Switch
              checked={goldenOnly}
              onChange={(_, checked) => onChange(checked)}
              color="success"
            />
          }
          label={t(
            'admin.performance.golden.filterLabel',
            'Only agents ≥{{n}} items / referral',
            { n: GOLDEN_ITEMS_PER_REFERRAL }
          )}
        />
      </CardContent>
    </Card>
  );
}

function GoldenRuleChips() {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={1} sx={{ mt: 0.75 }} flexWrap="wrap">
      <Chip
        size="small"
        icon={<CheckCircle fontSize="small" />}
        label={t('admin.performance.golden.rule1', '{{n}}+ approved products', {
          n: GOLDEN_ITEMS_PER_REFERRAL,
        })}
        color="success"
        variant="outlined"
      />
      <Chip
        size="small"
        icon={<ShoppingCart fontSize="small" />}
        label={t(
          'admin.performance.golden.rule2',
          'Sale ≥ configured market minimum'
        )}
        color="info"
        variant="outlined"
      />
    </Stack>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="h6" fontWeight={700}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Box>
  );
}

export default AdminPerformancePage;
