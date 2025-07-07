import { Box, FormHelperText } from '@mui/material';
import React from 'react';
import PhoneInputBase from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

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
  placeholder = 'Enter phone number',
  defaultCountry = 'US',
  margin = 'normal',
  ...props
}) => {
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
