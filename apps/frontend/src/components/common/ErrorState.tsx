import { Box, Button, Typography } from '@mui/material';

type Props = {
  title: string;
  body?: string;
  actionLabel: string;
  onRetry: () => void;
};

export function ErrorState({ title, body, actionLabel, onRetry }: Props) {
  return (
    <Box sx={{ py: 6, px: 2, textAlign: 'center' }}>
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      {body ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {body}
        </Typography>
      ) : null}
      <Button variant="outlined" onClick={onRetry} sx={{ mt: 3 }}>
        {actionLabel}
      </Button>
    </Box>
  );
}
