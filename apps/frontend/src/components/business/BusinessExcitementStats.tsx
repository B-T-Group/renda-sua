import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Box, Skeleton, Typography, type Theme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface BusinessExcitementStatsProps {
  clientCount: number | null;
  productViews: number | null;
  productViewsLast7d: number | null;
  loading: boolean;
  onClientsClick?: () => void;
}

/**
 * Compact dual-metric strip: clients (clickable) + product views.
 */
export function BusinessExcitementStats({
  clientCount,
  productViews,
  productViewsLast7d,
  loading,
  onClientsClick,
}: BusinessExcitementStatsProps) {
  const { t } = useTranslation();
  const clientsLoading = loading && clientCount == null;
  const viewsLoading = loading && productViews == null;

  return (
    <Box
      sx={{
        mb: 3,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        overflow: 'hidden',
      }}
    >
      <MetricCell
        icon={<PeopleOutlineRoundedIcon fontSize="small" />}
        iconBg="primary.main"
        iconColor="primary.contrastText"
        softBg={(theme) => `${theme.palette.primary.main}12`}
        label={t('business.dashboard.clientsSoFar.label', 'Clients')}
        value={clientCount}
        loading={clientsLoading}
        hint={clientHint(t, clientCount, clientsLoading, !!onClientsClick)}
        onClick={onClientsClick}
        a11yLabel={t(
          'business.dashboard.clientsSoFar.a11y',
          'Clients. Open city word cloud.'
        )}
        showChevron={!!onClientsClick}
      />
      <Box
        sx={{
          width: { xs: '100%', sm: '1px' },
          height: { xs: '1px', sm: 'auto' },
          bgcolor: 'divider',
          flexShrink: 0,
        }}
      />
      <MetricCell
        icon={<VisibilityOutlinedIcon fontSize="small" />}
        iconBg="secondary.main"
        iconColor="secondary.contrastText"
        softBg={(theme) => `${theme.palette.secondary.main}12`}
        label={t('business.dashboard.productViews.label', 'Views')}
        value={productViews}
        loading={viewsLoading}
        hint={viewsHint(t, productViews, productViewsLast7d, viewsLoading)}
      />
    </Box>
  );
}

function clientHint(
  t: (key: string, fallback: string) => string,
  count: number | null,
  loading: boolean,
  clickable: boolean
): string {
  if (loading) return '';
  if (count == null) {
    return t(
      'business.dashboard.clientsSoFar.unavailableHint',
      'Client count unavailable right now'
    );
  }
  if (count === 0) {
    return t(
      'business.dashboard.clientsSoFar.emptyHint',
      'Customers who order or rent will show up here.'
    );
  }
  return clickable
    ? t('business.dashboard.clientsSoFar.hintClickShort', 'Tap for cities')
    : t(
        'business.dashboard.clientsSoFar.hint',
        'Unique people who have ordered or rented from you.'
      );
}

function viewsHint(
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string,
  count: number | null,
  last7d: number | null,
  loading: boolean
): string {
  if (loading) return '';
  if (count == null) {
    return t(
      'business.dashboard.productViews.unavailableHint',
      'Views unavailable right now'
    );
  }
  if (count === 0) {
    return t(
      'business.dashboard.productViews.emptyHintShort',
      'Share to get views'
    );
  }
  if (typeof last7d === 'number' && last7d > 0) {
    return t('business.dashboard.productViews.weekDelta', '+{{count}} this week', {
      count: last7d,
    });
  }
  return t('business.dashboard.productViews.hintShort', 'Unique product viewers');
}

interface MetricCellProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  softBg: (theme: Theme) => string;
  label: string;
  value: number | null;
  loading: boolean;
  hint: string;
  onClick?: () => void;
  a11yLabel?: string;
  showChevron?: boolean;
}

function MetricCell({
  icon,
  iconBg,
  iconColor,
  softBg,
  label,
  value,
  loading,
  hint,
  onClick,
  a11yLabel,
  showChevron,
}: MetricCellProps) {
  const isUnknown = !loading && value == null;

  return (
    <Box
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={a11yLabel}
      sx={{
        flex: 1,
        minWidth: 0,
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        cursor: onClick ? 'pointer' : 'default',
        backgroundImage: (theme) =>
          `linear-gradient(135deg, ${softBg(theme)} 0%, transparent 60%)`,
        transition: 'background-color 0.15s ease',
        '&:hover': onClick ? { bgcolor: 'action.hover' } : undefined,
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: iconBg,
          color: iconColor,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.5 }}>
          {label}
        </Typography>
        {loading ? (
          <Skeleton variant="text" width={56} height={36} />
        ) : (
          <Typography
            variant="h4"
            component="p"
            sx={{ fontWeight: 700, lineHeight: 1.15, my: 0.25 }}
          >
            {isUnknown ? '—' : (value as number).toLocaleString()}
          </Typography>
        )}
        {hint ? (
          <Typography variant="body2" color="text.secondary" noWrap={false}>
            {hint}
          </Typography>
        ) : null}
      </Box>
      {showChevron ? <ChevronRightRoundedIcon color="action" sx={{ flexShrink: 0 }} /> : null}
    </Box>
  );
}

export default BusinessExcitementStats;
