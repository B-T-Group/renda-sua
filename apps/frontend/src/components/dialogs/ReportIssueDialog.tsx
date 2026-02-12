import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Box,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type TicketType = 'dispute' | 'complaint' | 'question';

interface ReportIssueDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber?: string;
  onSubmit: (payload: {
    orderId: string;
    type: TicketType;
    subject: string;
    description?: string;
  }) => Promise<void>;
}

const ReportIssueDialog: React.FC<ReportIssueDialogProps> = ({
  open,
  onClose,
  orderId,
  orderNumber,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [type, setType] = useState<TicketType>('complaint');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ orderId, type, subject: subject.trim(), description: description.trim() || undefined });
      setSubject('');
      setDescription('');
      setType('complaint');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSubject('');
      setDescription('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('support.reportIssue', 'Report an issue')}
        {orderNumber && ` – ${orderNumber}`}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>{t('support.type', 'Type')}</InputLabel>
            <Select
              value={type}
              label={t('support.type', 'Type')}
              onChange={(e) => setType(e.target.value as TicketType)}
            >
              <MenuItem value="dispute">{t('support.types.dispute', 'Dispute')}</MenuItem>
              <MenuItem value="complaint">{t('support.types.complaint', 'Complaint')}</MenuItem>
              <MenuItem value="question">{t('support.types.question', 'Question')}</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            required
            label={t('support.subject', 'Subject')}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('support.subjectPlaceholder', 'Brief summary of the issue')}
            size="small"
          />
          <TextField
            fullWidth
            multiline
            rows={4}
            label={t('support.description', 'Description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('support.descriptionPlaceholder', 'Describe what happened...')}
            size="small"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!subject.trim() || loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {loading ? t('common.submitting', 'Submitting...') : t('support.submit', 'Submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReportIssueDialog;
