import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SupportedCountry } from '../../../hooks/useSupportedCountries';
import { AdminMapKind } from './adminMap.types';

interface AdminMapToolbarProps {
  countries: SupportedCountry[];
  regions: string[];
  country: string;
  region: string;
  kind: AdminMapKind;
  live: boolean;
  onCountry: (value: string) => void;
  onRegion: (value: string) => void;
  onKind: (value: AdminMapKind) => void;
  onLive: (value: boolean) => void;
}

const AdminMapToolbar: React.FC<AdminMapToolbarProps> = (props) => {
  const { t } = useTranslation();
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
      <CountrySelect {...props} label={t('admin.map.country', 'Country')} allLabel={t('admin.map.allCountries', 'All countries')} />
      <RegionSelect {...props} label={t('admin.map.region', 'Region')} allLabel={t('admin.map.allRegions', 'All regions')} />
      <KindToggle kind={props.kind} onKind={props.onKind} />
      <LiveSwitch live={props.live} onLive={props.onLive} />
    </Stack>
  );
};

function CountrySelect({
  countries,
  country,
  onCountry,
  label,
  allLabel,
}: AdminMapToolbarProps & { label: string; allLabel: string }) {
  return (
    <FormControl size="small" sx={{ minWidth: 180 }}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={country} onChange={(event) => onCountry(event.target.value)}>
        <MenuItem value="">{allLabel}</MenuItem>
        {countries.map((item) => (
          <MenuItem key={item.code} value={item.code}>{item.name}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function RegionSelect({
  regions,
  country,
  region,
  onRegion,
  label,
  allLabel,
}: AdminMapToolbarProps & { label: string; allLabel: string }) {
  return (
    <FormControl size="small" sx={{ minWidth: 180 }} disabled={!country}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={region} onChange={(event) => onRegion(event.target.value)}>
        <MenuItem value="">{allLabel}</MenuItem>
        {regions.map((name) => (
          <MenuItem key={name} value={name}>{name}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function KindToggle({ kind, onKind }: Pick<AdminMapToolbarProps, 'kind' | 'onKind'>) {
  const { t } = useTranslation();
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={kind}
      onChange={(_event, value: AdminMapKind | null) => value && onKind(value)}
    >
      <ToggleButton value="all">{t('admin.map.kindAll', 'All')}</ToggleButton>
      <ToggleButton value="agents">{t('admin.map.kindAgents', 'Agents')}</ToggleButton>
      <ToggleButton value="businesses">{t('admin.map.kindMerchants', 'Merchants')}</ToggleButton>
    </ToggleButtonGroup>
  );
}

function LiveSwitch({ live, onLive }: Pick<AdminMapToolbarProps, 'live' | 'onLive'>) {
  const { t } = useTranslation();
  return (
    <Tooltip title={t('admin.map.liveHint', 'Refresh agent positions every 15 seconds')}>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Switch checked={live} onChange={(_event, checked) => onLive(checked)} />
        <Typography variant="body2">{t('admin.map.live', 'Live')}</Typography>
      </Stack>
    </Tooltip>
  );
}

export default AdminMapToolbar;
