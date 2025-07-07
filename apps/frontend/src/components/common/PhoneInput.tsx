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
    <div style={{ width: fullWidth ? '100%' : 'auto' }}>
      {label && (
        <label
          style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            color: error ? '#d32f2f' : 'rgba(0, 0, 0, 0.87)',
          }}
        >
          {label}
        </label>
      )}
      <PhoneInputBase
        international
        defaultCountry={defaultCountry as any}
        value={value || ''}
        onChange={onChange as any}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        style={{
          width: '100%',
        }}
      />
      {helperText && (
        <div
          style={{
            marginTop: '4px',
            fontSize: '12px',
            color: error ? '#d32f2f' : 'rgba(0, 0, 0, 0.6)',
          }}
        >
          {helperText}
        </div>
      )}
    </div>
  );
};

export default PhoneInput;
