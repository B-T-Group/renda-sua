import {
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApplicationConfigurationRow,
  CountryDeliveryConfigRow,
  DeliveryConfigRow,
} from '../../hooks/useApplicationSetup';
import {
  ServiceHourConfig,
  ServiceHoursEditor,
  ServiceHoursValue,
} from './ServiceHoursEditor';

interface CountryDeliveryConfigsSectionProps {
  countryCode: string;
  countryConfigs: CountryDeliveryConfigRow[];
  deliveryConfigs: DeliveryConfigRow[];
  cancellationConfig?: ApplicationConfigurationRow | null;
}

export const CountryDeliveryConfigsSection: React.FC<
  CountryDeliveryConfigsSectionProps
> = ({
  countryCode,
  countryConfigs,
  deliveryConfigs,
  cancellationConfig,
}) => {
  const { t } = useTranslation();

  const fastHoursConfig = React.useMemo<ServiceHoursValue>(() => {
    const target = countryConfigs.find(
      (config) => config.config_key === 'fast_delivery_service_hours'
    );

    if (!target || target.data_type !== 'json') {
      return {};
    }

    try {
      const parsed = JSON.parse(target.config_value) as Record<
        string,
        ServiceHourConfig
      >;
      return parsed || {};
    } catch {
      return {};
    }
  }, [countryConfigs]);

  const handleFastHoursChange = (value: ServiceHoursValue) => {
    console.log('Updated fast_delivery_service_hours for', countryCode, value);
  };

  const currencyConfig = countryConfigs.find(
    (config) => config.config_key === 'currency'
  );

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {t(
          'admin.applicationSetup.countryConfigsTitle',
          'Country delivery configuration'
        )}
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {t(
              'admin.applicationSetup.basicSettings',
              'Basic country settings'
            )}
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 160 }}>
              <InputLabel>
                {t('admin.applicationSetup.currency', 'Currency')}
              </InputLabel>
              <Select
                label={t('admin.applicationSetup.currency', 'Currency')}
                value={currencyConfig?.config_value || ''}
                disabled
              >
                <MenuItem value="">
                  {t('admin.applicationSetup.notConfigured', 'Not configured')}
                </MenuItem>
                <MenuItem value="XAF">XAF</MenuItem>
                <MenuItem value="XOF">XOF</MenuItem>
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="EUR">EUR</MenuItem>
                <MenuItem value="CAD">CAD</MenuItem>
              </Select>
            </FormControl>

            {cancellationConfig && (
              <TextField
                label={t(
                  'admin.applicationSetup.cancellationFee',
                  'Cancellation fee'
                )}
                type="number"
                value={cancellationConfig.number_value ?? ''}
                InputProps={{ inputProps: { min: 0 } }}
                sx={{ minWidth: 200 }}
                disabled
              />
            )}

            <FormControl>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Switch
                  checked={
                    countryConfigs.find(
                      (config) => config.config_key === 'fast_delivery_enabled'
                    )?.config_value === 'true'
                  }
                  disabled
                />
                <Typography variant="body2">
                  {t(
                    'admin.applicationSetup.fastDeliveryEnabled',
                    'Fast delivery enabled'
                  )}
                </Typography>
              </Box>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <ServiceHoursEditor
            value={fastHoursConfig}
            onChange={handleFastHoursChange}
          />
        </CardContent>
      </Card>
    </Box>
  );
};


