import { Celebration } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface OrderCompletionSuccessDialogProps {
  open: boolean;
  onClose: () => void;
}

const OrderCompletionSuccessDialog: React.FC<
  OrderCompletionSuccessDialogProps
> = ({ open, onClose }) => {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          textAlign: 'center',
        },
      }}
    >
      <DialogTitle>
        <Stack spacing={2} alignItems="center">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: 'success.light',
              color: 'success.main',
              mx: 'auto',
            }}
          >
            <Celebration sx={{ fontSize: 40 }} />
          </Box>
          <Typography variant="h5" fontWeight="bold" color="success.main">
            {t(
              'orders.orderCompletionSuccessTitle',
              '🎉 Order Successfully Completed!'
            )}
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} alignItems="center">
          <Typography variant="body1" color="text.secondary">
            {t(
              'orders.orderCompletionSuccessMessage',
              'Congratulations! Your order has been successfully completed. We hope you enjoyed your purchase and look forward to serving you again soon!'
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t(
              'orders.orderCompletionThankYou',
              'Thank you for choosing our service!'
            )}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
        <Button
          onClick={onClose}
          variant="contained"
          color="success"
          size="large"
          sx={{ minWidth: 150 }}
        >
          {t('common.close', 'Close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OrderCompletionSuccessDialog;
