import { Autocomplete, TextField } from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminBusinessOptions } from '../../hooks/useAdminBusinessOptions';
import type { AdminBusinessOption } from '../../hooks/useAdminBusinessOptions';

interface AdminBusinessSelectorProps {
  selectedBusinessId?: string;
  ownBusinessId?: string;
  ownBusinessName?: string;
  onChange: (businessId: string, businessName: string) => void;
}

const AdminBusinessSelector: React.FC<AdminBusinessSelectorProps> = ({
  selectedBusinessId,
  ownBusinessId,
  ownBusinessName,
  onChange,
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { options, loading } = useAdminBusinessOptions(true, search);

  const allOptions = useMemo(() => {
    const map = new Map<string, AdminBusinessOption>();
    if (ownBusinessId) {
      map.set(ownBusinessId, {
        id: ownBusinessId,
        name: ownBusinessName || t('business.items.businessSelector.ownBusiness', 'My business'),
      });
    }
    for (const opt of options) {
      map.set(opt.id, opt);
    }
    return Array.from(map.values());
  }, [options, ownBusinessId, ownBusinessName, t]);

  const selectedOption =
    allOptions.find((o) => o.id === selectedBusinessId) ?? null;

  return (
    <Autocomplete
      size="small"
      sx={{ minWidth: { xs: '100%', sm: 280 }, maxWidth: 420 }}
      options={allOptions}
      value={selectedOption}
      loading={loading}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      onChange={(_, value) => {
        if (value) onChange(value.id, value.name);
      }}
      onInputChange={(_, value, reason) => {
        if (reason === 'input') setSearch(value);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t('business.items.businessSelector.label', 'Business')}
          placeholder={t(
            'business.items.businessSelector.placeholder',
            'Search businesses…'
          )}
        />
      )}
    />
  );
};

export default AdminBusinessSelector;
