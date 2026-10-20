import React from 'react';
import {
  Box,
  FormControl,
  FormLabel,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

export type TogoOperator = 'moov' | 'togocel';

interface TogoOperatorPickerProps {
  value?: TogoOperator;
  onChange: (operator: TogoOperator) => void;
  disabled?: boolean;
  phoneNumber?: string;
}

/**
 * Detects Togo mobile money operator from phone prefix
 * @param phone Phone number (may include +228 prefix or just the local part)
 * @returns 'moov' or 'togocel' (default)
 */
export const detectTogoOperator = (phone?: string): TogoOperator => {
  if (!phone) return 'togocel';

  // Remove +228 country code and any non-digits
  const digits = phone.replace(/[^\d]/g, '').replace(/^228/, '');

  // Moov prefixes: 78, 79, 96, 97, 98, 99
  if (/^(78|79|96|97|98|99)/.test(digits)) {
    return 'moov';
  }

  // Togocel/Mixx by Yas prefixes: 70, 71, 72, 73, 90, 91, 92, 93
  return 'togocel';
};

/**
 * Operator picker for Togo mobile money payments
 * Allows user to select between Moov Money and Mixx by Yas (Togocel)
 */
export const TogoOperatorPicker: React.FC<TogoOperatorPickerProps> = ({
  value,
  onChange,
  disabled = false,
  phoneNumber,
}) => {
  const { t } = useTranslation();

  // Auto-detect operator from phone number if no value is set
  const effectiveValue = value || detectTogoOperator(phoneNumber);

  const handleChange = (_event: React.MouseEvent<HTMLElement>, newValue: TogoOperator | null) => {
    if (newValue !== null) {
      onChange(newValue);
    }
  };

  return (
    <Box sx={{ mt: 2, mb: 2 }}>
      <FormControl component="fieldset" fullWidth disabled={disabled}>
        <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 500 }}>
          {t('payment.togoOperator.label', 'Mobile Money Operator')}
        </FormLabel>
        <ToggleButtonGroup
          value={effectiveValue}
          exclusive
          onChange={handleChange}
          aria-label={t('payment.togoOperator.label', 'Mobile Money Operator')}
          fullWidth
          disabled={disabled}
        >
          <ToggleButton value="moov" aria-label={t('payment.togoOperator.moov', 'Moov Money')}>
            <Box sx={{ textAlign: 'center', py: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {t('payment.togoOperator.moov', 'Moov Money')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                78/79/96-99
              </Typography>
            </Box>
          </ToggleButton>
          <ToggleButton value="togocel" aria-label={t('payment.togoOperator.mixx', 'Mixx by Yas')}>
            <Box sx={{ textAlign: 'center', py: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {t('payment.togoOperator.mixx', 'Mixx by Yas')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                70-73/90-93
              </Typography>
            </Box>
          </ToggleButton>
        </ToggleButtonGroup>
      </FormControl>
    </Box>
  );
};
