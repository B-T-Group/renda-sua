import { Box, useTheme } from '@mui/material';
import type { ApexOptions } from 'apexcharts';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactApexChart from 'react-apexcharts';
import type { AdminSiteEventSummary } from '../../hooks/useAdminSiteEvents';

type SiteEventSummaryChartProps = {
  summary: AdminSiteEventSummary;
  eventTypeLabel: (raw: string) => string;
  inventoryItemTitle: (row: {
    itemName: string | null;
    inventoryItemId: string;
  }) => string;
};

type BuiltSeries = { titles: string[]; values: number[] };

function trunc(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

function buildSeries(
  summary: AdminSiteEventSummary,
  eventTypeLabel: (raw: string) => string,
  inventoryItemTitle: SiteEventSummaryChartProps['inventoryItemTitle'],
  t: (k: string, d: string) => string
): BuiltSeries {
  if (summary.groupBy === 'eventType' && summary.byEventType.length > 0) {
    return {
      titles: summary.byEventType.map((r) => eventTypeLabel(r.eventType)),
      values: summary.byEventType.map((r) => r.count),
    };
  }
  if (summary.groupBy === 'inventoryItem' && summary.byInventoryItem.length > 0) {
    return {
      titles: summary.byInventoryItem.map((r) => inventoryItemTitle(r)),
      values: summary.byInventoryItem.map((r) => r.count),
    };
  }
  if (
    summary.groupBy === 'eventAndSubject' &&
    summary.byEventAndSubject.length > 0
  ) {
    return {
      titles: summary.byEventAndSubject.map((r) => {
        const name =
          r.subjectDisplayName ||
          (r.subjectId
            ? trunc(r.subjectId, 10)
            : r.subjectType || '—');
        return `${trunc(eventTypeLabel(r.eventType), 24)} · ${trunc(name, 20)}`;
      }),
      values: summary.byEventAndSubject.map((r) => r.count),
    };
  }
  if (summary.total > 0) {
    return {
      titles: [t('admin.siteEvents.chart.total', 'All events (filtered)')],
      values: [summary.total],
    };
  }
  return { titles: [], values: [] };
}

const SiteEventSummaryChart: React.FC<SiteEventSummaryChartProps> = ({
  summary,
  eventTypeLabel,
  inventoryItemTitle,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { titles, values } = useMemo(
    () => buildSeries(summary, eventTypeLabel, inventoryItemTitle, t),
    [summary, eventTypeLabel, inventoryItemTitle, t]
  );

  const donutOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'donut',
        fontFamily: theme.typography.fontFamily,
        toolbar: { show: true },
      },
      labels: titles,
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
              name: { fontSize: '12px' },
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
        fontSize: '10px',
        labels: { colors: theme.palette.text.secondary },
      },
      theme: { mode: theme.palette.mode },
      tooltip: { theme: theme.palette.mode, y: { formatter: (n) => String(n) } },
    }),
    [theme, titles, t, summary.total]
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
      dataLabels: { enabled: true, offsetX: 8, style: { fontSize: '11px' } },
      xaxis: {
        categories: titles,
        labels: { style: { colors: theme.palette.text.secondary, fontSize: '9px' } },
      },
      yaxis: { labels: { maxWidth: 240 } },
      colors: [theme.palette.primary.main],
      grid: { borderColor: theme.palette.divider },
      theme: { mode: theme.palette.mode },
      tooltip: { theme: theme.palette.mode },
    }),
    [theme, titles]
  );

  if (values.length === 0) {
    return null;
  }

  return (
    <Box>
      <Box sx={{ maxWidth: 520, mx: 'auto', my: 1 }}>
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
          height={Math.max(200, 48 + values.length * 32)}
        />
      </Box>
    </Box>
  );
};

export default SiteEventSummaryChart;
