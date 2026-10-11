import { Add as AddIcon } from '@mui/icons-material';
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '../../common/ConfirmationModal';
import CountryAdminEmptyArt from '../../admin/CountryAdminEmptyArt';
import CountryAdminGrantDialog, { GrantDraft } from '../../admin/CountryAdminGrantDialog';
import {
  CountryAdminUser,
  ScopedRoleGrant,
  useCountryAdmins,
} from '../../../hooks/useCountryAdmins';

const EMPTY_DRAFT: GrantDraft = {
  userId: '',
  email: '',
  countryCode: '',
  allStates: true,
  stateIds: [],
};

const AdminCountryAdminsPage: React.FC = () => {
  const { t } = useTranslation();
  const model = useCountryAdmins();
  const editor = useGrantEditor(model);
  return (
    <Stack spacing={2}>
      <PageHeading onAdd={() => editor.open(EMPTY_DRAFT)} />
      {model.error ? <Alert severity="error">{model.error}</Alert> : null}
      {model.loading ? <Alert severity="info">{t('common.loading', 'Loading...')}</Alert> : null}
      {!model.loading && model.users.length === 0 ? <EmptyState /> : null}
      {model.users.map((user) => (
        <AdminCard
          key={user.userId}
          user={user}
          onEdit={() => editor.open(draftFromUser(user, model.markets))}
          onRemove={() => editor.askRemove(user)}
        />
      ))}
      <CountryAdminGrantDialog
        open={!!editor.draft}
        draft={editor.draft}
        markets={model.markets}
        lookupEmail={editor.draft?.userId ? undefined : model.lookup}
        onChange={editor.setDraft}
        onClose={editor.close}
        onSave={() => void editor.save()}
        saving={editor.saving}
      />
      <ConfirmationModal
        open={!!editor.removeTarget}
        title={t('admin.countryAdmins.removeTitle', 'Remove country admin')}
        message={t(
          'admin.countryAdmins.removeMessage',
          'This person will lose country admin access.'
        )}
        confirmColor="error"
        loading={editor.saving}
        onCancel={editor.close}
        onConfirm={() => void editor.remove()}
      />
    </Stack>
  );
};

function PageHeading({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Box>
        <Typography variant="h5">{t('admin.countryAdmins.title', 'Country admins')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('admin.countryAdmins.subtitle', 'Give someone admin tools for a country or its states.')}
        </Typography>
      </Box>
      <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>
        {t('admin.countryAdmins.add', 'Add country admin')}
      </Button>
    </Box>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <Card variant="outlined">
      <CardContent sx={{ textAlign: 'center' }}>
        <CountryAdminEmptyArt />
        <Typography>{t('admin.countryAdmins.empty', 'No country admins yet.')}</Typography>
      </CardContent>
    </Card>
  );
}

function AdminCard({
  user,
  onEdit,
  onRemove,
}: {
  user: CountryAdminUser;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography fontWeight={600}>{name}</Typography>
        <Typography variant="body2" color="text.secondary">{user.email}</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>{grantSummary(user)}</Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button size="small" onClick={onEdit}>{t('common.edit', 'Edit')}</Button>
          <Button size="small" color="error" onClick={onRemove}>{t('common.remove', 'Remove')}</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function grantSummary(user: CountryAdminUser): string {
  const byCountry = new Map<string, string[] | null>();
  for (const grant of user.grants) {
    if (!grant.countryCode) continue;
    if (!grant.stateName) byCountry.set(grant.countryCode, null);
    else if (byCountry.get(grant.countryCode) !== null) {
      const names = byCountry.get(grant.countryCode) ?? [];
      byCountry.set(grant.countryCode, [...names, grant.stateName]);
    }
  }
  return Array.from(byCountry.entries())
    .map(([code, states]) => `${code}${states ? ` · ${states.join(', ')}` : ''}`)
    .join(' · ');
}

function draftFromUser(
  user: CountryAdminUser,
  markets: Array<{ countryCode: string; states: Array<{ id: string; name: string }> }>
): GrantDraft {
  const countryCode = user.grants.find((grant) => grant.countryCode)?.countryCode ?? '';
  const countryGrants = user.grants.filter((grant) => grant.countryCode === countryCode);
  const allStates = countryGrants.some((grant) => !grant.stateKey);
  const market = markets.find((item) => item.countryCode === countryCode);
  const stateIds = allStates
    ? []
    : countryGrants
        .map((grant) => market?.states.find((state) => state.name === grant.stateName)?.id)
        .filter((id): id is string => !!id);
  return {
    userId: user.userId,
    email: user.email ?? '',
    countryCode,
    allStates,
    stateIds,
  };
}

function useGrantEditor(model: ReturnType<typeof useCountryAdmins>) {
  const [draft, setDraft] = useState<GrantDraft | null>(null);
  const [removeTarget, setRemoveTarget] = useState<CountryAdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!draft?.userId || !draft.countryCode) return;
    setSaving(true);
    try {
      await model.save(draft.userId, [toGrant(draft)]);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!removeTarget) return;
    setSaving(true);
    try {
      await model.save(removeTarget.userId, []);
      setRemoveTarget(null);
    } finally {
      setSaving(false);
    }
  };
  return {
    draft,
    setDraft,
    removeTarget,
    saving,
    open: setDraft,
    askRemove: setRemoveTarget,
    close: () => {
      setDraft(null);
      setRemoveTarget(null);
    },
    save,
    remove,
  };
}

function toGrant(draft: GrantDraft): ScopedRoleGrant {
  return {
    role: 'country_admin',
    countryCode: draft.countryCode,
    stateIds: draft.allStates ? undefined : draft.stateIds,
  };
}

export default AdminCountryAdminsPage;
