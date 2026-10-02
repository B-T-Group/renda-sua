import {
  Box,
  Checkbox,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface ServiceHourConfig {
  start: string;
  end: string;
  enabled: boolean;
}

export type ServiceHoursValue = Record<string, ServiceHourConfig>;

interface ServiceHoursEditorProps {
  value: ServiceHoursValue;
  onChange: (value: ServiceHoursValue) => void;
  title?: string;
  description?: string;
  disabled?: boolean;
  /** Label when a day is off. Location hours leave times visible. */
  offDayLabel?: string;
  /** Drop the admin header and tighten rows for a settings card. */
  embedded?: boolean;
}

const DAYS: Array<{ key: string; labelKey: string; fallback: string }> = [
  { key: 'monday', labelKey: 'common.days.monday', fallback: 'Monday' },
  { key: 'tuesday', labelKey: 'common.days.tuesday', fallback: 'Tuesday' },
  { key: 'wednesday', labelKey: 'common.days.wednesday', fallback: 'Wednesday' },
  { key: 'thursday', labelKey: 'common.days.thursday', fallback: 'Thursday' },
  { key: 'friday', labelKey: 'common.days.friday', fallback: 'Friday' },
  { key: 'saturday', labelKey: 'common.days.saturday', fallback: 'Saturday' },
  { key: 'sunday', labelKey: 'common.days.sunday', fallback: 'Sunday' },
];

const DAY_LABEL_WIDTH = 120;

function EmbeddedHoursRow({
  label,
  config,
  disabled,
  offDayLabel,
  startLabel,
  endLabel,
  onChange,
}: {
  label: string;
  config: ServiceHourConfig;
  disabled: boolean;
  offDayLabel?: string;
  startLabel: string;
  endLabel: string;
  onChange: (field: keyof ServiceHourConfig, value: string | boolean) => void;
}) {
  const closed = !config.enabled && !!offDayLabel;
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
      sx={{
        py: 0.75,
        px: 0.5,
        borderRadius: 1,
        bgcolor: config.enabled ? 'transparent' : 'action.hover',
      }}
    >
      <Checkbox
        checked={config.enabled}
        disabled={disabled}
        sx={{ p: 0.5 }}
        onChange={(event) => onChange('enabled', event.target.checked)}
      />
      <Typography variant="body1" sx={{ width: 108, flexShrink: 0 }}>
        {label}
      </Typography>
      {closed ? (
        <Typography variant="body2" color="text.secondary">
          {offDayLabel}
        </Typography>
      ) : (
        <>
          <TextField
            type="time"
            size="small"
            label={startLabel}
            value={config.start}
            disabled={disabled || !config.enabled}
            onChange={(event) => onChange('start', event.target.value)}
            inputProps={{ step: 900 }}
            sx={{ width: { xs: '100%', sm: 148 } }}
          />
          <TextField
            type="time"
            size="small"
            label={endLabel}
            value={config.end}
            disabled={disabled || !config.enabled}
            onChange={(event) => onChange('end', event.target.value)}
            inputProps={{ step: 900 }}
            sx={{ width: { xs: '100%', sm: 148 } }}
          />
        </>
      )}
    </Stack>
  );
}

export const ServiceHoursEditor: React.FC<ServiceHoursEditorProps> = ({
  value,
  onChange,
  title,
  description,
  disabled = false,
  offDayLabel,
  embedded = false,
}) => {
  const { t } = useTranslation();

  const handleDayChange = (
    dayKey: string,
    field: keyof ServiceHourConfig,
    fieldValue: string | boolean
  ) => {
    if (disabled) return;
    const current: ServiceHourConfig = value[dayKey] || {
      start: '',
      end: '',
      enabled: false,
    };

    const next: ServiceHourConfig = {
      ...current,
      [field]: fieldValue,
    };

    onChange({
      ...value,
      [dayKey]: next,
    });
  };

  const renderDayRow = (dayKey: string, label: string) => {
    const config = value[dayKey] || {
      start: '',
      end: '',
      enabled: false,
    };
    const isEnabled = config.enabled;
    if (embedded) {
      return (
        <EmbeddedHoursRow
          key={dayKey}
          label={label}
          config={config}
          disabled={disabled}
          offDayLabel={offDayLabel}
          startLabel={t('admin.applicationSetup.startTime', 'Start time')}
          endLabel={t('admin.applicationSetup.endTime', 'End time')}
          onChange={(field, fieldValue) => handleDayChange(dayKey, field, fieldValue)}
        />
      );
    }

    return (
      <Grid
        key={dayKey}
        container
        spacing={2}
        alignItems="center"
        sx={{
          mb: 1,
          px: embedded ? 0 : { xs: 1, sm: 1.5 },
          py: embedded ? 0.5 : 1,
          borderRadius: 2,
          bgcolor: isEnabled ? 'background.paper' : 'action.hover',
          opacity: isEnabled ? 1 : 0.7,
        }}
      >
        <Grid size={{ xs: 2, sm: 1 }}>
          <Checkbox
            checked={isEnabled}
            disabled={disabled}
            onChange={(event) =>
              handleDayChange(dayKey, 'enabled', event.target.checked)
            }
          />
        </Grid>
        <Grid size={{ xs: 10, sm: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Typography
              variant="body1"
              sx={{
                width: embedded ? 'auto' : DAY_LABEL_WIDTH,
                flexShrink: embedded ? 1 : 0,
                minWidth: 0,
              }}
            >
              {label}
            </Typography>
          </Box>
        </Grid>
        {!isEnabled && offDayLabel ? (
          <Grid size={{ xs: 12, sm: 8 }}>
            <Typography variant="body2" color="text.secondary" align="right">
              {offDayLabel}
            </Typography>
          </Grid>
        ) : (
          <>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField
                fullWidth
                type="time"
                size="small"
                label={t('admin.applicationSetup.startTime', 'Start time')}
                value={config.start}
                onChange={(event) =>
                  handleDayChange(dayKey, 'start', event.target.value)
                }
                disabled={disabled || !config.enabled}
                inputProps={{ step: 900 }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField
                fullWidth
                type="time"
                size="small"
                label={t('admin.applicationSetup.endTime', 'End time')}
                value={config.end}
                onChange={(event) =>
                  handleDayChange(dayKey, 'end', event.target.value)
                }
                disabled={disabled || !config.enabled}
                inputProps={{ step: 900 }}
              />
            </Grid>
          </>
        )}
      </Grid>
    );
  };

  return (
    <Box>
      {embedded ? null : (
        <>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {title ??
              t(
                'admin.applicationSetup.fastDeliveryHours',
                'Fast delivery service hours by day'
              )}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description ??
              t(
                'admin.applicationSetup.fastDeliveryHoursHelp',
                'Uncheck a day to disable fast delivery. Times are in local time.'
              )}
          </Typography>
        </>
      )}

      {embedded ? null : (
      <Box
        sx={{
          display: { xs: 'none', sm: 'block' },
          mb: 1,
          px: 1.5,
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 1 }} />
          <Grid size={{ xs: 12, sm: 3 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ width: DAY_LABEL_WIDTH, flexShrink: 0 }}
              >
                {t('admin.applicationSetup.day', 'Day')}
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">
              {t('admin.applicationSetup.startTime', 'Start time')}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">
              {t('admin.applicationSetup.endTime', 'End time')}
            </Typography>
          </Grid>
        </Grid>
      </Box>
      )}

      {DAYS.map((day) =>
        renderDayRow(
          day.key,
          t(day.labelKey, day.fallback)
        )
      )}
    </Box>
  );
};


