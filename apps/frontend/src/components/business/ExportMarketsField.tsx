import {
  Box,
  Chip,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSupportedCountries } from '../../hooks/useSupportedCountries';

export interface ExportMarketsFieldProps {
  exportAvailable: boolean;
  selectedCountryCodes: string[];
  /** ISO-2 codes to hide (home listing countries). */
  excludeCountryCodes?: string[];
  disabled?: boolean;
  onExportAvailableChange: (enabled: boolean) => void;
  onMarketsChange: (codes: string[]) => void;
}

/**
 * Merchant toggle + destination market chips for export catalog items.
 */
export const ExportMarketsField: React.FC<ExportMarketsFieldProps> = ({
  exportAvailable,
  selectedCountryCodes,
  excludeCountryCodes = [],
  disabled = false,
  onExportAvailableChange,
  onMarketsChange,
}) => {
  const { t } = useTranslation();
  const { countries, loading } = useSupportedCountries();

  const exclude = useMemo(
    () => new Set(excludeCountryCodes.map((c) => c.toUpperCase())),
    [excludeCountryCodes]
  );

  const destinationMarkets = useMemo(
    () =>
      countries.filter(
        (c) =>
          c.serviceStatus === 'active' && !exclude.has(c.code.toUpperCase())
      ),
    [countries, exclude]
  );

  const selected = useMemo(
    () => new Set(selectedCountryCodes.map((c) => c.toUpperCase())),
    [selectedCountryCodes]
  );

  const toggleMarket = (code: string) => {
    const upper = code.toUpperCase();
    if (selected.has(upper)) {
      onMarketsChange([...selected].filter((c) => c !== upper));
    } else {
      onMarketsChange([...selected, upper]);
    }
  };

  return (
    <Stack spacing={1.5}>
      <FormControlLabel
        control={
          <Switch
            checked={exportAvailable}
            onChange={(e) => {
              const on = e.target.checked;
              onExportAvailableChange(on);
              if (!on) onMarketsChange([]);
            }}
            disabled={disabled}
          />
        }
        label={t(
          'exportCatalog.merchantToggle',
          'Available for export'
        )}
      />
      {exportAvailable ? (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t(
              'exportCatalog.marketsHelp',
              'Choose markets where shoppers can discover this item and submit interest. List the item at one home location only.'
            )}
          </Typography>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
            {loading
              ? null
              : destinationMarkets.map((market) => {
                  const active = selected.has(market.code.toUpperCase());
                  return (
                    <Chip
                      key={market.code}
                      label={market.name}
                      color={active ? 'primary' : 'default'}
                      variant={active ? 'filled' : 'outlined'}
                      onClick={() => !disabled && toggleMarket(market.code)}
                      disabled={disabled}
                      clickable={!disabled}
                    />
                  );
                })}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
};

export default ExportMarketsField;
