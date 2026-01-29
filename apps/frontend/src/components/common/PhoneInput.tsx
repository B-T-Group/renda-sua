import {
  Box,
  FormHelperText,
  MenuItem,
  TextField,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import PhoneInputBase from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { environment } from '../../config/environment';

/** Dev-only phone numbers for dropdown when useDevPhoneDropdown and isDevelopment */
export const DEV_PHONE_NUMBERS = [
  '+241 74 41 65 45',
  '+241 74 41 65 46',
  '+241 74 41 65 47',
  '+241 74 41 65 48',
  '+241 74 41 65 49',
  '+237 6 77 41 65 45',
  '+237 6 77 41 65 46',
  '+237 6 77 41 65 47',
  '+237 6 77 41 65 48',
  '+237 6 77 41 65 49',
];

interface PhoneInputProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  placeholder?: string;
  defaultCountry?: string;
  margin?: 'none' | 'dense' | 'normal';
  onlyCountries?: string[];
  /** In development, render a dropdown of DEV_PHONE_NUMBERS instead of free-form input (profile/signup) */
  useDevPhoneDropdown?: boolean;
}

const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  label,
  error,
  helperText,
  disabled,
  required,
  fullWidth = true,
  placeholder = '',
  defaultCountry = 'US',
  margin = 'normal',
  onlyCountries,
  useDevPhoneDropdown = false,
  ...props
}) => {
  const { t } = useTranslation();
  const useDropdown =
    useDevPhoneDropdown && environment.isDevelopment;

  if (useDropdown) {
    return (
      <Box sx={{ width: fullWidth ? '100%' : 'auto' }}>
        <TextField
          select
          fullWidth={fullWidth}
          label={label}
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value || undefined)}
          error={error}
          helperText={helperText}
          required={required}
          margin={margin}
          disabled={disabled}
          SelectProps={{
            displayEmpty: true,
            renderValue: (v) => v || '',
          }}
        >
          <MenuItem value="">
            {' '}
          </MenuItem>
          {DEV_PHONE_NUMBERS.map((num) => (
            <MenuItem key={num} value={num}>
              {num}
            </MenuItem>
          ))}
        </TextField>
        <FormHelperText sx={{ mt: 0.5, ml: 1.5, color: 'text.secondary' }}>
          {t('common.devPhoneNote')}
        </FormHelperText>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: fullWidth ? '100%' : 'auto',
        mb: margin === 'normal' ? 2 : margin === 'dense' ? 1 : 0,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          '& .PhoneInput': {
            display: 'flex',
            alignItems: 'center',
            border: error
              ? '1px solid #d32f2f'
              : '1px solid rgba(0, 0, 0, 0.23)',
            borderRadius: '4px',
            padding: '8px 12px',
            backgroundColor: disabled ? 'rgba(0, 0, 0, 0.12)' : 'transparent',
            transition: 'border-color 0.2s ease-in-out',
            '&:hover': {
              borderColor: error ? '#d32f2f' : 'rgba(0, 0, 0, 0.87)',
            },
            '&:focus-within': {
              borderColor: error ? '#d32f2f' : '#1976d2',
              borderWidth: '2px',
            },
          },
          '& .PhoneInputCountry': {
            marginRight: '8px',
            display: 'flex',
            alignItems: 'center',
          },
          '& .PhoneInputCountrySelect': {
            border: 'none',
            background: 'transparent',
            fontSize: '14px',
            color: 'rgba(0, 0, 0, 0.87)',
            cursor: 'pointer',
            '&:focus': {
              outline: 'none',
            },
          },
          '& .PhoneInputCountryIcon': {
            width: '20px',
            height: '15px',
            marginRight: '4px',
          },
          '& .PhoneInputInput': {
            border: 'none',
            background: 'transparent',
            fontSize: '16px',
            color: 'rgba(0, 0, 0, 0.87)',
            flex: 1,
            '&:focus': {
              outline: 'none',
            },
            '&::placeholder': {
              color: 'rgba(0, 0, 0, 0.54)',
            },
            '&:disabled': {
              color: 'rgba(0, 0, 0, 0.38)',
            },
          },
        }}
      >
        <PhoneInputBase
          international
          defaultCountry={defaultCountry as any}
          value={value || ''}
          onChange={onChange as any}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          countries={onlyCountries as any}
        />
      </Box>

      {label && (
        <Box
          component="label"
          sx={{
            position: 'absolute',
            top: '-8px',
            left: '12px',
            backgroundColor: 'white',
            padding: '0 4px',
            fontSize: '12px',
            color: error ? '#d32f2f' : 'rgba(0, 0, 0, 0.6)',
            zIndex: 1,
          }}
        >
          {label}
          {required && <span style={{ color: '#d32f2f' }}> *</span>}
        </Box>
      )}

      {helperText && (
        <FormHelperText error={error} sx={{ mt: 0.5, ml: 1.5 }}>
          {helperText}
        </FormHelperText>
      )}
    </Box>
  );
};

export default PhoneInput;
