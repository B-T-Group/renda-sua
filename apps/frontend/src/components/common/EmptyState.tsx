import { Box, Button, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: ReactNode;
};

export function EmptyState({ title, body, actionLabel, onAction, illustration }: Props) {
  return (
    <Box sx={{ py: 6, px: 2, textAlign: 'center', maxWidth: 420, mx: 'auto' }}>
      {illustration}
      <Typography variant="h5" component="h2" sx={{ mt: 2 }}>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
        {body}
      </Typography>
      {actionLabel && onAction ? (
        <Button variant="contained" onClick={onAction} sx={{ mt: 3 }}>
          {actionLabel}
        </Button>
      ) : null}
    </Box>
  );
}
