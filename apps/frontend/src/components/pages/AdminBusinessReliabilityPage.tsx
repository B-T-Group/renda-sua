import { Refresh as RefreshIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { PlatformPermissions } from '../../constants/platformPermissions';
import {
  type ReliabilityTier,
  useAdminBusinessReliability,
} from '../../hooks/useAdminBusinessReliability';
import { usePermission } from '../../hooks/usePermissions';
import SEOHead from '../seo/SEOHead';

const TIERS: Array<ReliabilityTier | ''> = [
  '',
  'suspend',
  'restrict',
  'demote',
  'warn',
  'ok',
];

function tierColor(
  tier?: string | null
): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (tier) {
    case 'ok':
      return 'success';
    case 'warn':
      return 'info';
    case 'demote':
      return 'warning';
    case 'restrict':
    case 'suspend':
      return 'error';
    default:
      return 'default';
  }
}

const AdminBusinessReliabilityPage: React.FC = () => {
  const { t } = useTranslation();
  const canView = usePermission(PlatformPermissions.ORDERS_CROSS_BUSINESS);
  const {
    businesses,
    loading,
    error,
    tier,
    setTier,
    limit,
    setLimit,
    refresh,
  } = useAdminBusinessReliability();

  if (!canView) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          {t('common.unauthorized', 'You do not have permission to view this page')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <SEOHead
        title={t(
          'admin.businessReliability.title',
          'Business reliability'
        )}
      />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {t(
              'admin.businessReliability.title',
              'Business reliability'
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t(
              'admin.businessReliability.subtitle',
              'Least reliable merchants by acceptance score — use this to follow up instead of per-order alerts.'
            )}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void refresh()}
          disabled={loading}
        >
          {t('common.refresh', 'Refresh')}
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>
            {t('admin.businessReliability.tier', 'Tier')}
          </InputLabel>
          <Select
            label={t('admin.businessReliability.tier', 'Tier')}
            value={tier}
            onChange={(e) => setTier(e.target.value as ReliabilityTier | '')}
          >
            {TIERS.map((value) => (
              <MenuItem key={value || 'all'} value={value}>
                {value
                  ? t(`admin.businessReliability.tiers.${value}`, value)
                  : t('admin.businessReliability.allTiers', 'All tiers')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>
            {t('admin.businessReliability.limit', 'Limit')}
          </InputLabel>
          <Select
            label={t('admin.businessReliability.limit', 'Limit')}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[10, 25, 50, 100].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {loading && businesses.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  {t('admin.businessReliability.columns.business', 'Business')}
                </TableCell>
                <TableCell align="right">
                  {t('admin.businessReliability.columns.score', 'Score')}
                </TableCell>
                <TableCell>
                  {t('admin.businessReliability.columns.tier', 'Tier')}
                </TableCell>
                <TableCell align="right">
                  {t(
                    'admin.businessReliability.columns.autoDeclines30d',
                    'Auto-declines (30d)'
                  )}
                </TableCell>
                <TableCell align="right">
                  {t(
                    'admin.businessReliability.columns.acceptanceRate',
                    'Acceptance %'
                  )}
                </TableCell>
                <TableCell align="right">
                  {t(
                    'admin.businessReliability.columns.avgAccept',
                    'Avg accept (s)'
                  )}
                </TableCell>
                <TableCell>
                  {t('admin.businessReliability.columns.lifecycle', 'Lifecycle')}
                </TableCell>
                <TableCell>
                  {t('admin.businessReliability.columns.contact', 'Contact')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {businesses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        'admin.businessReliability.empty',
                        'No businesses match these filters.'
                      )}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                businesses.map((b) => {
                  const contact =
                    b.user?.email ||
                    b.user?.phone_number ||
                    [b.user?.first_name, b.user?.last_name]
                      .filter(Boolean)
                      .join(' ') ||
                    '—';
                  return (
                    <TableRow key={b.id} hover>
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to="/admin/businesses"
                          underline="hover"
                          fontWeight={600}
                        >
                          {b.name || b.id}
                        </Link>
                        {!b.accepting_orders ? (
                          <Chip
                            size="small"
                            label={t(
                              'admin.businessReliability.paused',
                              'Paused'
                            )}
                            sx={{ ml: 1 }}
                          />
                        ) : null}
                      </TableCell>
                      <TableCell align="right">
                        {b.reliability_score ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={tierColor(b.reliability_tier)}
                          label={
                            b.reliability_tier
                              ? t(
                                  `admin.businessReliability.tiers.${b.reliability_tier}`,
                                  String(b.reliability_tier)
                                )
                              : '—'
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        {b.auto_decline_rolling_30d ?? 0}
                      </TableCell>
                      <TableCell align="right">
                        {b.acceptanceRatePct != null
                          ? `${b.acceptanceRatePct}%`
                          : '—'}
                      </TableCell>
                      <TableCell align="right">
                        {b.averageAcceptanceSeconds ?? '—'}
                      </TableCell>
                      <TableCell>{b.lifecycle_status || '—'}</TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
                          {contact}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
};

export default AdminBusinessReliabilityPage;
