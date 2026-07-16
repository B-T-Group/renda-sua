import { Insights } from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  PERFORMANCE_PERIODS,
  type PerformanceMarket,
  type PerformancePeriod,
  type PerformanceSummary,
  type TopAgentEntry,
  type TopAgentMetric,
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
    <CardContent>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Typography variant="h4" fontWeight={700}>
        {value ?? '—'}
      </Typography>
    </CardContent>
  </Card>
);

interface TopAgentsTableProps {
  title: string;
  countLabel: string;
  agents: TopAgentEntry[];
  emptyLabel: string;
}

const TopAgentsTable: React.FC<TopAgentsTableProps> = ({
  title,
  countLabel,
  agents,
  emptyLabel,
}) => {
  const { t } = useTranslation();
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
          {title}
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
                  <TableCell align="right">{countLabel}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {agents.map((agent, index) => (
                  <TableRow key={agent.agentId} hover>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      {`${agent.firstName} ${agent.lastName}`.trim() ||
                        agent.agentId}
                    </TableCell>
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

const AdminPerformancePage: React.FC = () => {
  const { t } = useTranslation();
  const { profile, loading: profileLoading } = useUserProfileContext();
  const canAccess = usePermission(PlatformPermissions.DASHBOARD_PLATFORM_STATS);
  const { fetchMarkets, fetchSummary, fetchTopAgents, error } =
    useAdminPerformance();

  const [markets, setMarkets] = useState<PerformanceMarket[]>([]);
  const [countryCode, setCountryCode] = useState('');
  const [period, setPeriod] = useState<PerformancePeriod>('this_week');
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
    const metrics: TopAgentMetric[] = ['deliveries', 'business_referrals'];
    const [summaryData, deliveries, referrals] = await Promise.all([
      fetchSummary(period, countryCode),
      fetchTopAgents(period, countryCode, metrics[0]),
      fetchTopAgents(period, countryCode, metrics[1]),
    ]);
    if (seq !== loadSeqRef.current) return;
    setSummary(summaryData);
    setTopDeliveries(deliveries);
    setTopReferrals(referrals);
    setLoading(false);
  }, [fetchSummary, fetchTopAgents, period, countryCode]);

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
        sx={{ mb: 3 }}
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
        <Grid size={{ xs: 12, md: 6 }}>
          <TopAgentsTable
            title={t(
              'admin.performance.topAgents.deliveriesTitle',
              'Top agents by deliveries'
            )}
            countLabel={t(
              'admin.performance.topAgents.deliveriesCount',
              'Deliveries'
            )}
            agents={topDeliveries}
            emptyLabel={t(
              'admin.performance.topAgents.empty',
              'No data for this period'
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TopAgentsTable
            title={t(
              'admin.performance.topAgents.referralsTitle',
              'Top agents by business referrals'
            )}
            countLabel={t(
              'admin.performance.topAgents.referralsCount',
              'Referrals'
            )}
            agents={topReferrals}
            emptyLabel={t(
              'admin.performance.topAgents.empty',
              'No data for this period'
            )}
          />
        </Grid>
      </Grid>
      <Box sx={{ height: 24 }} />
    </Container>
  );
};

export default AdminPerformancePage;
