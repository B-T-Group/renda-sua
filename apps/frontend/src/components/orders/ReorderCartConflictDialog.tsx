import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  open: boolean;
  allowAdd: boolean;
  otherStoreBlocked: boolean;
  onReplace: () => void;
  onAdd: () => void;
  onCancel: () => void;
};

export const ReorderCartConflictDialog: React.FC<Props> = ({
  open,
  allowAdd,
  otherStoreBlocked,
  onReplace,
  onAdd,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>
        {t('orders.reorder.conflictTitle', 'Your cart already has items')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {otherStoreBlocked
            ? t(
                'orders.reorder.otherStoreMessage',
                'Your cart has items from another store. Replace your cart to reorder from this store.'
              )
            : t(
                'orders.reorder.conflictMessage',
                'Replace your cart with this order, or add these items to your cart.'
              )}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onCancel}>
          {t('common.cancel', 'Cancel')}
        </Button>
        {allowAdd ? (
          <Button onClick={onAdd} variant="outlined">
            {t('orders.reorder.addToCart', 'Add to cart')}
          </Button>
        ) : null}
        <Button onClick={onReplace} variant="contained" color="primary">
          {t('orders.reorder.replaceCart', 'Replace cart')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
