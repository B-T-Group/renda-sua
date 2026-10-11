import { Chip, Stack } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useSupportedCountries } from '../../hooks/useSupportedCountries';

type AdminScope = { countryCode: string; states: string[] | null };

const AdminScopeChip: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const { countries } = useSupportedCountries();
  const scopes = profile?.admin_scopes ?? [];
  if (!scopes.length) return null;
  return (
    <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
      {scopes.map((scope) => (
        <Chip
          key={scope.countryCode}
          size="small"
          color="primary"
          variant="outlined"
          label={scopeLabel(scope, countries, t('admin.countryAdmins.allStates', 'All states'))}
        />
      ))}
    </Stack>
  );
};

function scopeLabel(
  scope: AdminScope,
  countries: Array<{ code: string; name: string }>,
  allStates: string
): string {
  const country = countries.find((item) => item.code === scope.countryCode);
  const name = country?.name || scope.countryCode;
  const states = scope.states === null ? allStates : scope.states.join(', ');
  return `${name} · ${states}`;
}

export default AdminScopeChip;
