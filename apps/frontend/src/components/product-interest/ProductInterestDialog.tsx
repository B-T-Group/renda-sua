import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useProductInterestSubmit } from '../../hooks/useProductInterestSubmit';
import { ExportOrderSubmitted } from './ExportOrderSubmitted';

interface ProductInterestDialogProps {
  open: boolean;
  businessInventoryId: string;
  itemName: string;
  onClose: () => void;
}

export const ProductInterestDialog: React.FC<ProductInterestDialogProps> = ({
  open,
  businessInventoryId,
  itemName,
  onClose,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const { orderMode, placed, submitting, submit } = useProductInterestSubmit({
    open,
    businessInventoryId,
    onLeadSent: onClose,
  });

  useEffect(() => {
    if (open) setNote('');
  }, [open]);

  const helper = orderMode
    ? t(
        'productInterest.order.noteHelp',
        'Your request for {{name}} goes to our export team. We issue a purchase order and prepare a proforma for your approval.',
        { name: itemName }
      )
    : t(
        'productInterest.noteHelp',
        'Tell the seller about {{name}}. They will contact you outside the app.',
        { name: itemName }
      );
  const submitLabel = orderMode
    ? t('productInterest.order.submit', 'Send request')
    : t('productInterest.submit', 'Send interest');

  if (placed) {
    return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogContent>
          <ExportOrderSubmitted bcNumber={placed.bc_number} />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} data-testid="export-order-keep-browsing">
            {t('exportOrders.submitted.keepBrowsing', 'Keep browsing')}
          </Button>
          <Button
            variant="contained"
            data-testid="export-order-view"
            onClick={() => navigate(`/export-orders/${placed.id}`)}
          >
            {t('exportOrders.submitted.viewOrder', 'View my order')}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('productInterest.dialogTitle', 'I’m interested')}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          margin="dense"
          label={t('productInterest.noteLabel', 'Message (optional)')}
          helperText={helper}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button variant="contained" disabled={submitting} onClick={() => submit(note)}>
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
