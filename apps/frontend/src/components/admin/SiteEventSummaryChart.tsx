import { Box, CircularProgress } from '@mui/material';
import React, { Suspense, lazy } from 'react';
import type { SiteEventSummaryChartProps } from './SiteEventSummaryChartInner';

const SiteEventSummaryChartInner = lazy(() =>
  import(
    /* webpackChunkName: "vendor-charts-inner" */
    './SiteEventSummaryChartInner'
  )
);

const SiteEventSummaryChart: React.FC<SiteEventSummaryChartProps> = (props) => (
  <Suspense
    fallback={
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={32} />
      </Box>
    }
  >
    <SiteEventSummaryChartInner {...props} />
  </Suspense>
);

export default SiteEventSummaryChart;
