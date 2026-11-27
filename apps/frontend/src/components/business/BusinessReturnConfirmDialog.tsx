import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';

export function BusinessReturnConfirmDialog({
  itemName,
  open,
  onClose,
  onConfirm,
}: {
  itemName: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} data-testid="dashboard-return-dialog">
      <DialogTitle>{t('business.dashboard.rentalReturns.confirmTitle', 'Confirm this return?')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('business.dashboard.rentalReturns.confirmBody', 'Check the item first. Confirming completes the rental for {{item}}.', { item: itemName })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('business.dashboard.rentalReturns.cancel', 'Cancel')}</Button>
        <Button variant="contained" color="success" onClick={onConfirm} data-testid="dashboard-return-dialog-confirm">
          {t('business.dashboard.rentalReturns.confirm', 'Confirm return')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
