import {
  Autocomplete,
  Box,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CURRENCIES } from '../../../constants/enums';
import { useApiClient } from '../../../hooks/useApiClient';

export interface DirectoryOption {
  id: string;
  userId?: string;
  name: string;
  email: string;
  referralCode?: string | null;
  phone?: string | null;
}

function optionLabel(option: DirectoryOption): string {
  const extra = option.phone || option.referralCode;
  return `${option.name} · ${option.email}${extra ? ` · ${extra}` : ''}`;
}

/** Two fields per row on sm+, full width on xs. */
export function FormGrid({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 2,
        '& .MuiFormControl-root': { width: '100%' },
      }}
    >
      {children}
    </Box>
  );
}

export function CurrencyField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return (
    <TextField select label={t('admin.paymentPrograms.currency', 'Currency')} value={value} onChange={(event) => onChange(event.target.value)}>
      {CURRENCIES.map((code) => (
        <MenuItem key={code} value={code}>{code}</MenuItem>
      ))}
    </TextField>
  );
}

export function DirectorySearch({
  label,
  placeholder,
  endpoint,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  endpoint: string;
  value: DirectoryOption | null;
  onChange: (value: DirectoryOption | null) => void;
}) {
  const api = useApiClient();
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<DirectoryOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = input.trim();
    if (term.length < 2) {
      setOptions((current) => (current.length ? [] : current));
      return;
    }
    const handle = window.setTimeout(() => {
      setLoading(true);
      void api.get(endpoint, { params: { search: term } })
        .then((response) => setOptions(response.data || []))
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [api, endpoint, input]);

  const shown = value && !options.some((row) => row.id === value.id) ? [value, ...options] : options;
  return (
    <Autocomplete
      options={shown}
      loading={loading}
      value={value}
      filterOptions={(items) => items}
      onChange={(_event, next) => onChange(next)}
      onInputChange={(_event, next, reason) => {
        if (reason === 'input') setInput(next);
      }}
      getOptionLabel={optionLabel}
      isOptionEqualToValue={(left, right) => left.id === right.id}
      renderInput={(params) => <TextField {...params} label={label} placeholder={placeholder} />}
    />
  );
}

export function ImpactCard({
  text,
  objectives,
  art,
}: {
  text: string;
  objectives?: string[];
  art?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const lines = objectives?.filter(Boolean) ?? [];
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        display: 'flex',
        gap: 2,
        alignItems: 'flex-start',
        bgcolor: 'action.hover',
        borderRadius: 2,
      }}
    >
      {art ? (
        <Box sx={{ flexShrink: 0, display: { xs: 'none', sm: 'block' } }}>
          {art}
        </Box>
      ) : null}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="overline"
          color="primary"
          sx={{ display: 'block', fontWeight: 700, letterSpacing: 0.08, lineHeight: 1.2 }}
        >
          {t('admin.paymentPrograms.whatThisDoes', 'What this does')}
        </Typography>
        <Typography variant="body1" sx={{ mt: 0.75, fontWeight: 500, lineHeight: 1.5 }}>
          {text}
        </Typography>
        {lines.length > 0 ? <ImpactObjectives lines={lines} /> : null}
      </Box>
    </Paper>
  );
}

function ImpactObjectives({ lines }: { lines: string[] }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {t('admin.paymentPrograms.objectivesHeading', 'Objectives')}
      </Typography>
      <Box
        component="ul"
        sx={{ m: 0, mt: 0.5, pl: 2.25, '& li': { mt: 0.35 } }}
      >
        {lines.map((line) => (
          <Typography component="li" key={line} variant="body2" color="text.secondary">
            {line}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}
