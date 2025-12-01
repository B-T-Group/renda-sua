import { Box, Card, CardContent, TextField, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ApplicationConfigurationRow } from '../../hooks/useApplicationSetup';

interface ApplicationConfigurationsSectionProps {
  config?: ApplicationConfigurationRow | null;
}

export const ApplicationConfigurationsSection: React.FC<
  ApplicationConfigurationsSectionProps
> = ({ config }) => {
  const { t } = useTranslation();

  if (!config) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t(
          'admin.applicationSetup.noCancellationConfig',
          'No cancellation fee configuration found for this country.'
        )}
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {t(
          'admin.applicationSetup.applicationConfigsTitle',
          'Application configurations'
        )}
      </Typography>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label={t(
                'admin.applicationSetup.cancellationFee',
                'Cancellation fee'
              )}
              type="number"
              value={config.number_value ?? ''}
              InputProps={{ inputProps: { min: 0 } }}
              sx={{ minWidth: 200 }}
              disabled
            />
            <TextField
              label={t('admin.applicationSetup.configKey', 'Configuration key')}
              value={config.config_name}
              placeholder={config.config_name}
              helperText={config.config_key}
              sx={{ minWidth: 260 }}
              disabled
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
