import { TextField } from '@mui/material';
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
  ...props
}) => {
  return (
    <PhoneInputBase
      international
      defaultCountry={defaultCountry}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      style={{
        width: fullWidth ? '100%' : 'auto',
      }}
      inputComponent={({ value, onChange, onFocus, onBlur, ...inputProps }) => (
        <TextField
          {...inputProps}
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          label={label}
          error={error}
          helperText={helperText}
          disabled={disabled}
          required={required}
          fullWidth={fullWidth}
          variant="outlined"
          type="tel"
          autoComplete="tel"
          sx={{
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: error ? 'error.main' : 'divider',
              },
              '&:hover fieldset': {
                borderColor: error ? 'error.main' : 'primary.main',
              },
              '&.Mui-focused fieldset': {
                borderColor: error ? 'error.main' : 'primary.main',
              },
            },
          }}
        />
      )}
    />
  );
};

export default PhoneInput;
