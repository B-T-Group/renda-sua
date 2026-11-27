import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React from 'react';

interface Props {
  /** Commission as a share of the rental subtotal, 0 to 1. */
  commissionShare: number;
  label: string;
}

const WIDTH = 240;
const BAR_X = 8;
const BAR_W = WIDTH - 16;

/** One bar split between what the business keeps and what Rendasua takes. */
export function CommissionSplitIllustration({ commissionShare, label }: Props) {
  const theme = useTheme();
  const share = Math.min(1, Math.max(0, commissionShare));
  const feeW = Math.max(share > 0 ? 6 : 0, BAR_W * share);
  const keepW = BAR_W - feeW;
  return (
    <Box
      component="svg"
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} 28`}
      sx={{ width: '100%', maxWidth: 280, height: 'auto', display: 'block' }}
    >
      <rect x={BAR_X} y={6} width={keepW} height={16} rx={8} fill={theme.palette.success.main} />
      {feeW > 0 ? (
        <rect x={BAR_X + keepW - 8} y={6} width={feeW + 8} height={16} rx={8} fill={theme.palette.primary.main} />
      ) : null}
      <rect x={BAR_X + keepW - 8} y={6} width={8} height={16} fill={theme.palette.success.main} />
    </Box>
  );
}
