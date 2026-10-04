import { Box, Button, Typography } from '@mui/material';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, actionLabel, onAction }: Props) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
      <Typography variant="h5" component="h2">
        {title}
      </Typography>
      {actionLabel && onAction ? (
        <Button variant="text" onClick={onAction} sx={{ minHeight: 44 }}>
          {actionLabel}
        </Button>
      ) : null}
    </Box>
  );
}
