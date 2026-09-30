import {
  Alert,
  Autocomplete,
  Box,
  TextField,
  Typography,
  type AutocompleteRenderInputParams,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminMapSearch } from '../../../hooks/useAdminMap';
import { AdminMapPin, AdminMapSearchHit, AdminMapSearchNotice } from './adminMap.types';

interface AdminMapSearchProps {
  onFocus: (pin: AdminMapPin, orderNumber: string | null) => void;
}

const AdminMapSearch: React.FC<AdminMapSearchProps> = ({ onFocus }) => {
  const search = useAdminMapSearch();
  const [notice, setNotice] = useState<AdminMapSearchNotice | null>(null);
  const pick = (hit: AdminMapSearchHit | null) => {
    if (!hit) return;
    setNotice(hit.notice);
    if (hit.pin) onFocus(hit.pin, hit.kind === 'order' ? hit.title : null);
  };
  return (
    <Box>
      <SearchField search={search} onPick={pick} />
      <SearchNotice notice={notice} />
    </Box>
  );
};

function SearchField({
  search,
  onPick,
}: {
  search: ReturnType<typeof useAdminMapSearch>;
  onPick: (hit: AdminMapSearchHit | null) => void;
}) {
  return (
    <Autocomplete
      options={search.results}
      loading={search.loading}
      filterOptions={(options) => options}
      getOptionLabel={(hit) => hit.title}
      isOptionEqualToValue={(left, right) => left.id === right.id}
      inputValue={search.query}
      value={null}
      onInputChange={(_event, value, reason) => {
        if (reason !== 'reset') search.setQuery(value);
      }}
      onChange={(_event, hit) => onPick(hit)}
      renderOption={(props, hit) => <SearchOption optionProps={props} hit={hit} />}
      renderInput={(params) => <SearchInput params={params} />}
    />
  );
}

function SearchInput({ params }: { params: AutocompleteRenderInputParams }) {
  const { t } = useTranslation();
  return (
    <TextField
      {...params}
      size="small"
      label={t('admin.map.search', 'Find on the map')}
      placeholder={t('admin.map.searchPlaceholder', 'Name, business, or order number')}
    />
  );
}

function SearchOption({
  optionProps,
  hit,
}: {
  optionProps: React.HTMLAttributes<HTMLLIElement>;
  hit: AdminMapSearchHit;
}) {
  const { t } = useTranslation();
  return (
    <Box component="li" {...optionProps}>
      <Box>
        <Typography variant="body2">{hit.title}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t(`admin.map.searchKind.${hit.kind}`, hit.kind)}
          {hit.subtitle ? ` · ${hit.subtitle}` : ''}
        </Typography>
      </Box>
    </Box>
  );
}

function SearchNotice({ notice }: { notice: AdminMapSearchNotice | null }) {
  const { t } = useTranslation();
  if (!notice) return null;
  return <Alert severity="info" sx={{ mt: 1 }}>{t(`admin.map.searchNotice.${notice}`, notice)}</Alert>;
}

export default AdminMapSearch;
