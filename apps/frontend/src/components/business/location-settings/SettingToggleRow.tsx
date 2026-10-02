import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmCopy {
  title: string;
  body: string;
  confirmLabel: string;
}

interface SettingToggleRowProps {
  label: string;
  consequence: string;
  checked: boolean;
  disabled?: boolean;
  onCommit: (next: boolean) => void;
  confirmFor?: (next: boolean) => ConfirmCopy | null;
}

const SettingToggleRow: React.FC<SettingToggleRowProps> = ({
  label,
  consequence,
  checked,
  disabled = false,
  onCommit,
  confirmFor,
}) => {
  const { t } = useTranslation();
  const [pending, setPending] = useState<boolean | null>(null);
  const confirm = pending == null ? null : confirmFor?.(pending) ?? null;

  const request = (next: boolean) => {
    const copy = confirmFor?.(next);
    if (copy) {
      setPending(next);
      return;
    }
    onCommit(next);
  };

  return (
    <Stack spacing={0.5}>
      <FormControlLabel
        sx={{ alignItems: 'flex-start', mx: 0 }}
        control={
          <Switch
            checked={checked}
            disabled={disabled}
            onChange={(_, next) => request(next)}
            inputProps={{ 'aria-label': label }}
          />
        }
        label={
          <Stack spacing={0.25} sx={{ pt: 0.75 }}>
            <Typography variant="body1">{label}</Typography>
            <Typography variant="body2" color="text.secondary">
              {consequence}
            </Typography>
          </Stack>
        }
      />
      <Dialog open={!!confirm} onClose={() => setPending(null)}>
        <DialogTitle>{confirm?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirm?.body}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (pending != null) onCommit(pending);
              setPending(null);
            }}
          >
            {confirm?.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default SettingToggleRow;
