import {
  Autocomplete,
  Box,
  FormHelperText,
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
  '+237 6 93 07 23 61',
  '+237 6 81 56 35 31',
  '+237 6 94 48 79 00',
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
  /** Fires when the country selector changes (ISO2, e.g. CM, GA) */
  onCountryChange?: (country?: string) => void;
  /** In development, render a dropdown of DEV_PHONE_NUMBERS instead of free-form input (profile/signup) */
  useDevPhoneDropdown?: boolean;
  /** Optional start adornment (e.g. phone icon) for both dev dropdown and standard input */
  startAdornment?: React.ReactNode;
  /** Match square (no radius) inputs, e.g. signup flow */
  squareEdges?: boolean;
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
  onCountryChange,
  useDevPhoneDropdown = false,
  startAdornment,
  squareEdges = false,
  ...props
}) => {
  const { t } = useTranslation();
  const useDropdown =
    useDevPhoneDropdown && environment.isDevelopment;

  if (useDropdown) {
    return (
      <Box sx={{ width: fullWidth ? '100%' : 'auto' }}>
        <Autocomplete
          freeSolo
          options={DEV_PHONE_NUMBERS}
          value={value || ''}
          onInputChange={(_, newValue) =>
            onChange?.(newValue || undefined)
          }
          disabled={disabled}
          renderInput={(params) => (
            <TextField
              {...params}
              fullWidth={fullWidth}
              label={label}
              error={error}
              helperText={helperText}
              required={required}
              margin={margin}
              InputProps={{
                ...params.InputProps,
                startAdornment: startAdornment ? (
                  <>
                    {startAdornment}
                    {params.InputProps?.startAdornment}
                  </>
                ) : (
                  params.InputProps?.startAdornment
                ),
              }}
            />
          )}
        />
        <FormHelperText sx={{ mt: 0.5, ml: 1.5, color: 'text.secondary' }}>
          {t('common.devPhoneNote')}
        </FormHelperText>
      </Box>
    );
  }

  const phoneFieldStyles = {
    position: 'relative' as const,
    flex: 1,
    minWidth: 0,
    '& .PhoneInput': {
      display: 'flex',
      alignItems: 'center',
      border: 'none',
      borderRadius: 0,
      padding: 0,
      backgroundColor: 'transparent',
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
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width: fullWidth ? '100%' : 'auto',
        mb: margin === 'normal' ? 2 : margin === 'dense' ? 1 : 0,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          border: error ? '1px solid #d32f2f' : '1px solid rgba(0, 0, 0, 0.23)',
          borderRadius: squareEdges ? 0 : '4px',
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
        }}
      >
        {startAdornment && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mr: 1,
              color: 'action.active',
              flexShrink: 0,
            }}
          >
            {startAdornment}
          </Box>
        )}
        <Box sx={phoneFieldStyles}>
          <PhoneInputBase
            international
            defaultCountry={defaultCountry as any}
            value={value || ''}
            onChange={onChange as any}
            onCountryChange={onCountryChange as any}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            countries={onlyCountries as any}
          />
        </Box>
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
