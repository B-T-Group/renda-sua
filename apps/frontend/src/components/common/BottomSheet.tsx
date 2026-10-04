import { Drawer, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function BottomSheet({ open, onClose, title, children }: Props) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            px: 2,
            pt: 1,
            pb: 3,
            maxHeight: '85vh',
          },
        },
      }}
    >
      {title ? (
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
          {title}
        </Typography>
      ) : null}
      {children}
    </Drawer>
  );
}
