import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import type { ButtonProps } from '@mui/material';
import React from 'react';
import { useAppChromeInsets } from '../../hooks/useAppChromeInsets';

/** Bottom padding (px) a page needs so the pinned card never covers the end of its content. */
export const STICKY_ACTION_CLEARANCE = 136;

export interface StickyActionCardProps {
  actionLabel: React.ReactNode;
  onAction: () => void;
  actionIcon?: React.ReactNode;
  actionColor?: ButtonProps['color'];
  loading?: boolean;
  disabled?: boolean;
  /** Small caption on the left of the summary row ("Due at pickup"). */
  summaryLabel?: string;
  summaryValue?: string;
  /** One line of context under the summary. */
  note?: string;
  maxWidth?: 'sm' | 'md' | 'lg';
  testId?: string;
  actionTestId?: string;
}

/**
 * The page's one primary action, pinned to the bottom of the viewport above the mobile bottom nav:
 * optional price/summary context above a full-width button. Pad the page with
 * `STICKY_ACTION_CLEARANCE` so it never covers content.
 */
export function StickyActionCard(props: StickyActionCardProps) {
  const { bottom: navHeight } = useAppChromeInsets();
  return (
    <Paper
      square
      elevation={8}
      data-testid={props.testId}
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: navHeight,
        zIndex: 1000,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        pt: 1.5,
        pb: navHeight ? 1.5 : 'calc(12px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <Container maxWidth={props.maxWidth ?? 'md'}>
        <Stack spacing={1}>
          <SummaryRow {...props} />
          <Button
            fullWidth
            size="large"
            variant="contained"
            color={props.actionColor}
            startIcon={props.actionIcon}
            disabled={props.disabled || props.loading}
            onClick={props.onAction}
            data-testid={props.actionTestId}
            sx={{ minHeight: 48, whiteSpace: 'nowrap', fontWeight: 700 }}
          >
            {props.actionLabel}
          </Button>
        </Stack>
      </Container>
    </Paper>
  );
}

function SummaryRow({ summaryLabel, summaryValue, note }: StickyActionCardProps) {
  if (!summaryLabel && !summaryValue && !note) return null;
  return (
    <Box>
      {summaryLabel || summaryValue ? (
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2}>
          <Typography variant="body2" color="text.secondary" fontWeight={700} noWrap>
            {summaryLabel}
          </Typography>
          <Typography variant="subtitle1" color="primary" fontWeight={800} noWrap>
            {summaryValue}
          </Typography>
        </Stack>
      ) : null}
      {note ? (
        <Typography variant="caption" color="text.secondary" display="block">
          {note}
        </Typography>
      ) : null}
    </Box>
  );
}
