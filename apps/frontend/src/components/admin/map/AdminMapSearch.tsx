import {
  Alert,
  Autocomplete,
  Box,
  Stack,
  TextField,
  Typography,
  type AutocompleteRenderInputParams,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveMapOrders, useAdminMapSearch } from '../../../hooks/useAdminMap';
import { AdminMapPin, AdminMapSearchHit, AdminMapSearchNotice } from './adminMap.types';

interface AdminMapSearchProps {
  onFocus: (pin: AdminMapPin, orderNumber: string | null) => void;
}

const AdminMapSearch: React.FC<AdminMapSearchProps> = ({ onFocus }) => {
  const search = useAdminMapSearch();
  const orders = useActiveMapOrders();
  const [notice, setNotice] = useState<AdminMapSearchNotice | null>(null);
  const pick = (hit: AdminMapSearchHit | null, asOrder: boolean) => {
    if (!hit) return;
    setNotice(hit.notice);
    if (hit.pin) onFocus(hit.pin, asOrder ? hit.title : null);
  };
  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        <Box sx={{ flex: 1 }}>
          <SearchField search={search} onPick={(hit) => pick(hit, false)} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <OrderField orders={orders} onPick={(hit) => pick(hit, true)} />
        </Box>
      </Stack>
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
      placeholder={t('admin.map.searchPlaceholder', 'Name or business')}
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

function OrderField({
  orders,
  onPick,
}: {
  orders: ReturnType<typeof useActiveMapOrders>;
  onPick: (hit: AdminMapSearchHit | null) => void;
}) {
  return (
    <Autocomplete
      openOnFocus
      options={orders.results}
      loading={orders.loading}
      filterOptions={(options) => options}
      getOptionLabel={(hit) => hit.title}
      isOptionEqualToValue={(left, right) => left.id === right.id}
      inputValue={orders.query}
      value={null}
      onInputChange={(_event, value, reason) => {
        if (reason !== 'reset') orders.setQuery(value);
      }}
      onChange={(_event, hit) => onPick(hit)}
      renderOption={(props, hit) => <OrderOption optionProps={props} hit={hit} />}
      renderInput={(params) => <OrderInput params={params} />}
    />
  );
}

function OrderInput({ params }: { params: AutocompleteRenderInputParams }) {
  const { t } = useTranslation();
  return (
    <TextField
      {...params}
      size="small"
      label={t('admin.map.activeOrders', 'Active orders')}
      placeholder={t('admin.map.activeOrdersPlaceholder', 'Order number')}
    />
  );
}

function OrderOption({
  optionProps,
  hit,
}: {
  optionProps: React.HTMLAttributes<HTMLLIElement>;
  hit: AdminMapSearchHit;
}) {
  const { t } = useTranslation();
  const status = hit.subtitle
    ? t(`common.orderStatus.${hit.subtitle}`, hit.subtitle)
    : '';
  return (
    <Box component="li" {...optionProps}>
      <Box>
        <Typography variant="body2">{hit.title}</Typography>
        <Typography variant="caption" color="text.secondary">{status}</Typography>
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
