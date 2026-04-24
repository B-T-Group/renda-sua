import { Box, useTheme } from '@mui/material';
import type { ApexOptions } from 'apexcharts';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactApexChart from 'react-apexcharts';
import type { AdminSiteEventSummary } from '../../hooks/useAdminSiteEvents';

type SiteEventSummaryChartProps = {
  summary: AdminSiteEventSummary;
  eventTypeLabel: (raw: string) => string;
};

function buildLabelsAndValues(
  summary: AdminSiteEventSummary
): { displayLabels: string[]; values: number[] } {
  if (summary.byEventType.length > 0) {
    return {
      displayLabels: summary.byEventType.map((r) => r.eventType),
      values: summary.byEventType.map((r) => r.count),
    };
  }
  if (summary.total > 0) {
    return { displayLabels: ['__total__'], values: [summary.total] };
  }
  return { displayLabels: [], values: [] };
}

function toDisplayName(
  raw: string,
  eventTypeLabel: (r: string) => string,
  t: (k: string, d: string) => string
): string {
  if (raw === '__total__') {
    return t('admin.siteEvents.chart.total', 'All events (filtered)');
  }
  return eventTypeLabel(raw);
}

const SiteEventSummaryChart: React.FC<SiteEventSummaryChartProps> = ({
  summary,
  eventTypeLabel,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { displayLabels, values } = useMemo(
    () => buildLabelsAndValues(summary),
    [summary]
  );
  const resolvedLabels = useMemo(
    () =>
      displayLabels.map((raw) => toDisplayName(raw, eventTypeLabel, t)),
    [displayLabels, eventTypeLabel, t]
  );

  const donutOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'donut',
        fontFamily: theme.typography.fontFamily,
        toolbar: { show: true },
      },
      labels: resolvedLabels,
      colors: [
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.success.main,
        theme.palette.warning.main,
        theme.palette.info.main,
        theme.palette.error.light,
        theme.palette.grey[500],
      ],
      dataLabels: {
        enabled: true,
        style: { fontSize: '11px' },
        formatter: (val: number) => `${Math.round(val)}%`,
      },
      plotOptions: {
        pie: {
          donut: {
            labels: {
              show: true,
              name: { fontSize: '14px' },
              value: { fontSize: '20px', fontWeight: 600 },
              total: {
                show: true,
                showAlways: true,
                label: t('admin.siteEvents.chart.centerLabel', 'Total events'),
                fontSize: '12px',
                formatter: () => String(summary.total),
              },
            },
          },
        },
      },
      stroke: { width: 2, colors: [theme.palette.background.paper] },
      legend: {
        position: 'bottom',
        fontSize: '12px',
        labels: { colors: theme.palette.text.secondary },
        formatter: (name: string) => name,
      },
      theme: { mode: theme.palette.mode },
      tooltip: { theme: theme.palette.mode, y: { formatter: (n) => String(n) } },
    }),
    [theme, resolvedLabels, t, summary.total]
  );

  const barOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'bar',
        fontFamily: theme.typography.fontFamily,
        toolbar: { show: true },
        background: 'transparent',
      },
      plotOptions: {
        bar: { horizontal: true, borderRadius: 4, dataLabels: { position: 'top' } },
      },
      dataLabels: { enabled: true, offsetX: 24, style: { fontSize: '12px' } },
      xaxis: {
        categories: resolvedLabels,
        labels: { style: { colors: theme.palette.text.secondary, fontSize: '11px' } },
      },
      yaxis: { labels: { maxWidth: 200 } },
      colors: [theme.palette.primary.main],
      grid: { borderColor: theme.palette.divider },
      theme: { mode: theme.palette.mode },
      tooltip: { theme: theme.palette.mode },
    }),
    [theme, resolvedLabels]
  );

  if (values.length === 0) {
    return null;
  }

  return (
    <Box>
      <Box sx={{ maxWidth: 480, mx: 'auto', my: 1 }}>
        <ReactApexChart
          type="donut"
          options={donutOptions}
          series={values}
          height={300}
        />
      </Box>
      <Box sx={{ mt: 1 }}>
        <ReactApexChart
          type="bar"
          options={barOptions}
          series={[{ name: t('admin.siteEvents.chart.events', 'Events'), data: values }]}
          height={Math.max(180, 40 + values.length * 40)}
        />
      </Box>
    </Box>
  );
};

export default SiteEventSummaryChart;
