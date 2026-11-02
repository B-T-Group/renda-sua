import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APPEAL_EVIDENCE_MAX } from '../../../types/itemRejectionRecovery';
import {
  validateAppealEvidence,
  validateAppealReason,
} from '../../../utils/itemRejectionRecovery';

type Props = {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (reason: string, files: File[]) => Promise<void>;
};

export function AppealDecisionDialog({
  open,
  submitting,
  onClose,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const reasonCheck = validateAppealReason(reason);
  const evidenceCheck = validateAppealEvidence(files);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles(Array.from(list).slice(0, APPEAL_EVIDENCE_MAX));
  };

  const canSubmit = reasonCheck.valid && evidenceCheck.valid && !submitting;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('business.items.recovery.action.appeal', 'Appeal decision')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('business.items.recovery.appeal.limit', '1 appeal per decision')}
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={4}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          label={t(
            'business.items.recovery.appeal.reason',
            'Why should we reconsider?'
          )}
          error={reason.length > 0 && !reasonCheck.valid}
          helperText={
            reason.length > 0 && !reasonCheck.valid
              ? t(reasonCheck.errorKey ?? '', reasonCheck.defaultMessage ?? '')
              : null
          }
        />
        <Stack spacing={1} sx={{ mt: 2 }}>
          <Typography variant="body2">
            {t(
              'business.items.recovery.appeal.evidence',
              'Add evidence (optional)'
            )}
          </Typography>
          <Button component="label" variant="outlined">
            {t('business.items.recovery.appeal.addFiles', 'Choose files')}
            <input
              hidden
              type="file"
              accept="image/*,.pdf,application/pdf"
              multiple
              onChange={(event) => handleFiles(event.target.files)}
            />
          </Button>
          {files.map((file) => (
            <Typography key={file.name} variant="caption">
              {file.name}
            </Typography>
          ))}
          {!evidenceCheck.valid ? (
            <Typography color="error" variant="caption">
              {t(
                evidenceCheck.errorKey ?? '',
                evidenceCheck.defaultMessage ?? ''
              )}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
        <Button
          variant="contained"
          disabled={!canSubmit}
          onClick={() => void onSubmit(reason.trim(), files)}
        >
          {t('business.items.recovery.appeal.submit', 'Submit appeal')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
