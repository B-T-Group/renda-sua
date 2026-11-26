import { ErrorOutline, Restore } from '@mui/icons-material';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  /** cancelFeeResult(): what happens to a paid reservation fee if the renter cancels now. */
  fee: 'none' | 'refund' | 'keep';
  feeLabel?: string;
  flagged?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Renter cancel dialog with the fee refund / keep copy (README §4). */
export function CancelBookingDialog(props: Props) {
  const { t } = useTranslation();
  const body =
    props.fee === 'refund'
      ? props.flagged
        ? t('rentals.cancelSheet.refundFlag', 'Your flag on the item check is still open, so you get the {{fee}} reservation fee back.', { fee: props.feeLabel })
        : t('rentals.cancelSheet.refund', 'This booking hasn’t started, so cancellation is free. You get the {{fee}} reservation fee back.', { fee: props.feeLabel })
      : props.fee === 'keep'
        ? t('rentals.cancelSheet.keep', 'It’s the pickup day, so the business keeps the {{fee}} reservation fee. Nothing else is charged.', { fee: props.feeLabel })
        : t('rentals.bookingDetail.cancelBeforeStartMessage', 'This booking has not started, so cancellation is free. Any card hold or wallet hold is released.');
  return (
    <Dialog open={props.open} onClose={props.onClose} data-testid="cancel-booking-dialog">
      <DialogTitle>{t('rentals.cancelBooking', 'Cancel booking')}</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          {props.fee === 'keep' ? <ErrorOutline fontSize="small" color="warning" /> : <Restore fontSize="small" color="action" />}
          <Typography color={props.fee === 'keep' ? 'warning.dark' : 'text.primary'}>{body}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>{t('rentals.cancelSheet.keepBooking', 'Keep booking')}</Button>
        <Button color="error" onClick={props.onConfirm}>
          {t('rentals.cancelBooking', 'Cancel booking')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
