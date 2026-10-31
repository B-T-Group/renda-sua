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

type Props = {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (description: string) => void;
};

const ReportDeliveryProblemDialog: React.FC<Props> = ({
  open,
  submitting,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [description, setDescription] = useState('');

  const close = () => {
    setDescription('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('orders.clientConfirm.cta.problem', 'Report a problem')}
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          multiline
          minRows={3}
          sx={{ mt: 1 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          label={t('orders.clientConfirm.problemDescription', 'What happened? (optional)')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={submitting}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={submitting}
          onClick={() => onSubmit(description)}
        >
          {t('common.submit', 'Submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReportDeliveryProblemDialog;
