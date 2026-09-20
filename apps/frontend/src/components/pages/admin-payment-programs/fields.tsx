import { Autocomplete, MenuItem, Paper, TextField, Typography } from '@mui/material';
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

export function ImpactCard({ text }: { text: string }) {
  const { t } = useTranslation();
  return (
    <Paper variant="outlined" sx={{ p: 2.5, flex: 1, alignSelf: 'stretch', bgcolor: 'action.hover' }}>
      <Typography variant="overline" color="text.secondary">
        {t('admin.paymentPrograms.whatThisDoes', 'What this does')}
      </Typography>
      <Typography variant="body1" sx={{ mt: 1 }}>{text}</Typography>
    </Paper>
  );
}
