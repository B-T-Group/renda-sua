import PhoneIphoneOutlined from '@mui/icons-material/PhoneIphoneOutlined';
import {
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import React, { useId } from 'react';
import { ACTIVE_PHONE_COUNTRY_OPTIONS } from '../../constants/activeCountries';

interface CountryPhoneNumberInputProps {
  countryCode: string;
  onCountryCodeChange: (countryCode: string) => void;
  nationalNumber: string;
  onNationalNumberChange: (nationalNumber: string) => void;
  countryLabel: string;
  phoneLabel: string;
  invalidPhoneMessage: string;
  isPhoneValid: boolean;
  disabled?: boolean;
}

const CountryPhoneNumberInput: React.FC<CountryPhoneNumberInputProps> = ({
  countryCode,
  onCountryCodeChange,
  nationalNumber,
  onNationalNumberChange,
  countryLabel,
  phoneLabel,
  invalidPhoneMessage,
  isPhoneValid,
  disabled = false,
}) => {
  const countryLabelId = useId();

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.5}>
        <FormControl
          size="small"
          sx={{
            width: { xs: 130, sm: 140 },
            flexShrink: 0,
            '& .MuiOutlinedInput-root': { borderRadius: 2 },
          }}
        >
          <InputLabel id={countryLabelId}>
            {countryLabel}
          </InputLabel>
          <Select
            labelId={countryLabelId}
            label={countryLabel}
            value={countryCode}
            onChange={(e) => onCountryCodeChange(String(e.target.value || ''))}
            disabled={disabled}
            size="small"
          >
            {ACTIVE_PHONE_COUNTRY_OPTIONS.map((country) => (
              <MenuItem key={country.isoCode} value={country.isoCode}>
                {country.flag} +{country.dialCode}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          fullWidth
          size="small"
          label={phoneLabel}
          value={nationalNumber}
          onChange={(e) => {
            const digits = String(e.target.value || '').replace(/\D/g, '');
            onNationalNumberChange(digits);
          }}
          autoComplete="tel-national"
          disabled={disabled}
          error={nationalNumber.length > 0 && !isPhoneValid}
          helperText={nationalNumber.length > 0 && !isPhoneValid ? invalidPhoneMessage : undefined}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <PhoneIphoneOutlined
                    fontSize="small"
                    sx={{ color: isPhoneValid ? 'primary.main' : 'text.disabled' }}
                  />
                </InputAdornment>
              ),
            },
          }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
      </Stack>
    </Stack>
  );
};

export default CountryPhoneNumberInput;
