import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ProductInterestDialogProps {
  open: boolean;
  itemName: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
}

export const ProductInterestDialog: React.FC<ProductInterestDialogProps> = ({
  open,
  itemName,
  submitting,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [note, setNote] = useState('');

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('productInterest.dialogTitle', 'I’m interested')}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          margin="dense"
          label={t('productInterest.noteLabel', 'Message (optional)')}
          helperText={t(
            'productInterest.noteHelp',
            'Tell the seller about {{name}}. They will contact you outside the app.',
            { name: itemName }
          )}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={!!submitting}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={!!submitting}
          onClick={() => onSubmit(note)}
        >
          {t('productInterest.submit', 'Send interest')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
