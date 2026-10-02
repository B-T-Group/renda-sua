import { Button, Collapse, Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface SettingsSectionProps {
  id?: string;
  title: string;
  summary: React.ReactNode;
  editing?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  saveLabel: string;
  saving?: boolean;
  saveDisabled?: boolean;
  error?: string | null;
  children?: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  id,
  title,
  summary,
  editing = false,
  onEdit,
  onCancel,
  onSave,
  saveLabel,
  saving = false,
  saveDisabled = false,
  error,
  children,
}) => {
  const { t } = useTranslation();
  return (
    <Paper id={id} variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {!editing && onEdit ? (
            <Button variant="text" onClick={onEdit}>
              {t('common.edit', 'Edit')}
            </Button>
          ) : null}
        </Stack>
        {!editing ? summary : null}
        <Collapse in={editing} unmountOnExit>
          <Stack spacing={1.5}>
            {children}
            {error ? (
              <Typography variant="body2" color="error" role="alert">
                {error}
              </Typography>
            ) : null}
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button variant="text" onClick={onCancel} disabled={saving}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={onSave}
                disabled={saving || saveDisabled}
              >
                {saveLabel}
              </Button>
            </Stack>
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
};

export default SettingsSection;
