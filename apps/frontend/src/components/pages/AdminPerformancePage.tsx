import { CheckCircle, Insights } from '@mui/icons-material';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  GOLDEN_ITEMS_PER_REFERRAL,
  PERFORMANCE_PERIODS,
  type PerformanceMarket,
  type PerformancePeriod,
  type PerformanceSummary,
  type TopAgentEntry,
  useAdminPerformance,
} from '../../hooks/useAdminPerformance';
import { usePermission } from '../../hooks/usePermissions';
import LoadingScreen from '../common/LoadingScreen';
import SEOHead from '../seo/SEOHead';

const PERIOD_LABELS: Record<PerformancePeriod, [string, string]> = {
  this_week: ['admin.performance.periods.thisWeek', 'This week'],
  last_week: ['admin.performance.periods.lastWeek', 'Last week'],
  this_month: ['admin.performance.periods.thisMonth', 'This month'],
  last_month: ['admin.performance.periods.lastMonth', 'Last month'],
  this_year: ['admin.performance.periods.thisYear', 'This year'],
  last_year: ['admin.performance.periods.lastYear', 'Last year'],
};

interface MetricCardProps {
  label: string;
  value: number | null;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value }) => (
  <Card variant="outlined" sx={{ height: '100%' }}>
    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Typography variant="h4" fontWeight={700}>
        {value ?? '—'}
      </Typography>
    </CardContent>
  </Card>
);

function agentDisplayName(agent: TopAgentEntry): string {
  return `${agent.firstName} ${agent.lastName}`.trim() || agent.agentId;
}

interface DeliveriesTableProps {
  agents: TopAgentEntry[];
  emptyLabel: string;
}

const DeliveriesTable: React.FC<DeliveriesTableProps> = ({
  agents,
  emptyLabel,
}) => {
  const { t } = useTranslation();
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
          {t(
            'admin.performance.topAgents.deliveriesTitle',
            'Top agents by deliveries'
          )}
        </Typography>
        {agents.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {emptyLabel}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>
                    {t('admin.performance.topAgents.agent', 'Agent')}
                  </TableCell>
                  <TableCell>
                    {t('admin.performance.topAgents.code', 'Code')}
                  </TableCell>
                  <TableCell align="right">
                    {t(
                      'admin.performance.topAgents.deliveriesCount',
                      'Deliveries'
                    )}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {agents.map((agent, index) => (
                  <TableRow key={agent.agentId} hover>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{agentDisplayName(agent)}</TableCell>
                    <TableCell>{agent.agentCode ?? '—'}</TableCell>
                    <TableCell align="right">{agent.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

interface ReferralsTableProps {
  agents: TopAgentEntry[];
  emptyLabel: string;
  goldenOnly: boolean;
}

const ReferralsTable: React.FC<ReferralsTableProps> = ({
  agents,
  emptyLabel,
  goldenOnly,
}) => {
  const { t } = useTranslation();
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
          spacing={1}
          sx={{ mb: 1 }}
        >
          <Typography variant="h6" fontWeight={600}>
            {t(
              'admin.performance.topAgents.referralsTitle',
              'Top agents by business referrals'
            )}
          </Typography>
          {goldenOnly ? (
            <Chip
              size="small"
              color="success"
              icon={<CheckCircle />}
              label={t(
                'admin.performance.topAgents.goldenFilterActive',
                '≥{{n}} items / referral',
                { n: GOLDEN_ITEMS_PER_REFERRAL }
              )}
            />
          ) : null}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t(
            'admin.performance.topAgents.referralsHelp',
            'Items / referral = sale catalog items across referred businesses ÷ referrals. Target: ≥{{n}}.',
            { n: GOLDEN_ITEMS_PER_REFERRAL }
          )}
        </Typography>
        {agents.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {emptyLabel}
          </Typography>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>
                    {t('admin.performance.topAgents.agent', 'Agent')}
                  </TableCell>
                  <TableCell>
                    {t('admin.performance.topAgents.code', 'Code')}
                  </TableCell>
                  <TableCell align="right">
                    {t(
                      'admin.performance.topAgents.referralsCount',
                      'Referrals'
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip
                      title={t(
                        'admin.performance.topAgents.itemsTooltip',
                        'Active sale items on businesses this agent referred'
                      )}
                    >
                      <span>
                        {t('admin.performance.topAgents.itemsCount', 'Items')}
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip
                      title={t(
                        'admin.performance.topAgents.itemsPerReferralTooltip',
                        'Average items per referred business (goal ≥{{n}})',
                        { n: GOLDEN_ITEMS_PER_REFERRAL }
                      )}
                    >
                      <span>
                        {t(
                          'admin.performance.topAgents.itemsPerReferral',
                          'Items / referral'
                        )}
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip
                      title={t(
                        'admin.performance.topAgents.stockedTooltip',
                        'Referred businesses with ≥{{n}} sale items',
                        { n: GOLDEN_ITEMS_PER_REFERRAL }
                      )}
                    >
                      <span>
                        {t(
                          'admin.performance.topAgents.stockedReferrals',
                          'Stocked'
                        )}
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {agents.map((agent, index) => (
                  <TableRow key={agent.agentId} hover>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{agentDisplayName(agent)}</TableCell>
                    <TableCell>{agent.agentCode ?? '—'}</TableCell>
                    <TableCell align="right">{agent.count}</TableCell>
                    <TableCell align="right">
                      {agent.inventoryItemsCount ?? 0}
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        color={agent.meetsGoldenRatio ? 'success' : 'default'}
                        variant={agent.meetsGoldenRatio ? 'filled' : 'outlined'}
                        label={agent.itemsPerReferral ?? 0}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {agent.stockedReferralCount ?? 0}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                      >
                        {` / ${agent.count}`}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

const AdminPerformancePage: React.FC = () => {
  const { t } = useTranslation();
  const { profile, loading: profileLoading } = useUserProfileContext();
  const canAccess = usePermission(PlatformPermissions.DASHBOARD_PLATFORM_STATS);
  const { fetchMarkets, fetchSummary, fetchTopAgents, error } =
    useAdminPerformance();

  const [markets, setMarkets] = useState<PerformanceMarket[]>([]);
  const [countryCode, setCountryCode] = useState('');
  const [period, setPeriod] = useState<PerformancePeriod>('this_week');
  const [goldenOnly, setGoldenOnly] = useState(false);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [topDeliveries, setTopDeliveries] = useState<TopAgentEntry[]>([]);
  const [topReferrals, setTopReferrals] = useState<TopAgentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const loadSeqRef = useRef(0);

  useEffect(() => {
    if (!canAccess) return;
    void fetchMarkets().then(setMarkets);
  }, [canAccess, fetchMarkets]);

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    const referralOpts = {
      limit: 20,
      minItemsPerReferral: goldenOnly
        ? GOLDEN_ITEMS_PER_REFERRAL
        : undefined,
    };
    const [summaryData, deliveries, referrals] = await Promise.all([
      fetchSummary(period, countryCode),
      fetchTopAgents(period, countryCode, 'deliveries'),
      fetchTopAgents(period, countryCode, 'business_referrals', referralOpts),
    ]);
    if (seq !== loadSeqRef.current) return;
    setSummary(summaryData);
    setTopDeliveries(deliveries);
    setTopReferrals(referrals);
    setLoading(false);
  }, [fetchSummary, fetchTopAgents, period, countryCode, goldenOnly]);

  useEffect(() => {
    if (!canAccess) return;
    void load();
  }, [canAccess, load]);

  if (profileLoading) {
    return <LoadingScreen open />;
  }

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

  const metricCards: Array<[string, string, number | null]> = [
    [
      'admin.performance.metrics.businessesEnrolled',
      'Businesses enrolled',
      summary?.businessesEnrolled ?? null,
    ],
    [
      'admin.performance.metrics.clientsAdded',
      'Clients added',
      summary?.clientsAdded ?? null,
    ],
    [
      'admin.performance.metrics.agentsAdded',
      'Agents added',
      summary?.agentsAdded ?? null,
    ],
    [
      'admin.performance.metrics.saleItemsAdded',
      'Sale items added',
      summary?.saleItemsAdded ?? null,
    ],
    [
      'admin.performance.metrics.rentalItemsAdded',
      'Rental items added',
      summary?.rentalItemsAdded ?? null,
    ],
  ];

  const emptyLabel = t(
    'admin.performance.topAgents.empty',
    'No data for this period'
  );
  const goldenEmpty = t(
    'admin.performance.topAgents.goldenEmpty',
    'No agents meet the ≥{{n}} items / referral target for this period',
    { n: GOLDEN_ITEMS_PER_REFERRAL }
  );

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <SEOHead
        title={t('admin.performance.pageTitle', 'Platform performance')}
        description={t(
          'admin.performance.pageDescription',
          'Enrollment and catalog growth by market and period.'
        )}
        keywords={t(
          'admin.performance.pageKeywords',
          'admin, performance, metrics, markets, agents'
        )}
      />

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Insights color="action" fontSize="small" />
        <Typography variant="h5" component="h1" fontWeight={700}>
          {t('admin.performance.pageTitle', 'Platform performance')}
        </Typography>
      </Stack>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 2, maxWidth: 720 }}
      >
        {t(
          'admin.performance.pageDescription',
          'Enrollment and catalog growth by market and period.'
        )}
      </Typography>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 2 }}
        useFlexGap
        flexWrap="wrap"
      >
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="performance-market-label">
            {t('admin.performance.marketFilter', 'Market')}
          </InputLabel>
          <Select
            labelId="performance-market-label"
            value={countryCode}
            label={t('admin.performance.marketFilter', 'Market')}
            onChange={(e) => setCountryCode(e.target.value)}
          >
            <MenuItem value="">
              {t('admin.performance.allMarkets', 'All markets')}
            </MenuItem>
            {markets.map((market) => (
              <MenuItem key={market.countryCode} value={market.countryCode}>
                {market.countryName} ({market.countryCode})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={period}
          onChange={(_, value: PerformancePeriod | null) => {
            if (value) setPeriod(value);
          }}
          sx={{ flexWrap: 'wrap' }}
        >
          {PERFORMANCE_PERIODS.map((p) => (
            <ToggleButton key={p} value={p}>
              {t(PERIOD_LABELS[p][0], PERIOD_LABELS[p][1])}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {loading && <CircularProgress size={20} />}
      </Stack>

      <Card
        variant="outlined"
        sx={{
          mb: 3,
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
              {t(
                'admin.performance.golden.title',
                'Referral quality target'
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                'admin.performance.golden.description',
                'Goal: each referred business should reach at least {{n}} sale catalog items on average (items / referral).',
                { n: GOLDEN_ITEMS_PER_REFERRAL }
              )}
            </Typography>
          </Box>
          <FormControlLabel
            sx={{ m: 0, flexShrink: 0 }}
            control={
              <Switch
                checked={goldenOnly}
                onChange={(_, checked) => setGoldenOnly(checked)}
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

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {metricCards.map(([key, fallback, value]) => (
          <Grid key={key} size={{ xs: 12, sm: 6, md: 2.4 }}>
            <MetricCard label={t(key, fallback)} value={value} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <DeliveriesTable agents={topDeliveries} emptyLabel={emptyLabel} />
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <ReferralsTable
            agents={topReferrals}
            emptyLabel={goldenOnly ? goldenEmpty : emptyLabel}
            goldenOnly={goldenOnly}
          />
        </Grid>
      </Grid>
      <Box sx={{ height: 24 }} />
    </Container>
  );
};

export default AdminPerformancePage;
