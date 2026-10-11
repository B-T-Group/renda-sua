import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  TextField,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScopedMarket } from '../../hooks/useCountryAdmins';

export interface GrantDraft {
  userId: string;
  email: string;
  countryCode: string;
  allStates: boolean;
  stateIds: string[];
}

interface Props {
  open: boolean;
  draft: GrantDraft | null;
  markets: ScopedMarket[];
  lookupEmail?: (email: string) => Promise<{ userId: string; email: string }>;
  onChange: (draft: GrantDraft) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}

const CountryAdminGrantDialog: React.FC<Props> = ({
  open,
  draft,
  markets,
  lookupEmail,
  onChange,
  onClose,
  onSave,
  saving,
}) => {
  const { t } = useTranslation();
  const [lookupError, setLookupError] = useState<string | null>(null);
  if (!draft) return null;
  const states = markets.find((market) => market.countryCode === draft.countryCode)?.states ?? [];
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {draft.userId
          ? t('admin.countryAdmins.editTitle', 'Edit country admin')
          : t('admin.countryAdmins.addTitle', 'Add country admin')}
      </DialogTitle>
      <DialogContent>
        <EmailField
          draft={draft}
          lookupEmail={lookupEmail}
          lookupError={lookupError}
          onLookupError={setLookupError}
          onChange={onChange}
        />
        <TextField
          select
          fullWidth
          margin="normal"
          label={t('admin.countryAdmins.country', 'Country')}
          value={draft.countryCode}
          onChange={(event) =>
            onChange({ ...draft, countryCode: event.target.value, stateIds: [], allStates: true })
          }
        >
          {markets.map((market) => (
            <MenuItem key={market.countryCode} value={market.countryCode}>
              {market.countryName}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={
            <Checkbox
              checked={draft.allStates}
              onChange={(event) => onChange({ ...draft, allStates: event.target.checked })}
            />
          }
          label={t('admin.countryAdmins.allStates', 'All states')}
        />
        {draft.allStates ? null : (
          <TextField
            select
            fullWidth
            margin="normal"
            SelectProps={{ multiple: true }}
            label={t('admin.countryAdmins.states', 'States')}
            value={draft.stateIds}
            onChange={(event) =>
              onChange({ ...draft, stateIds: event.target.value as unknown as string[] })
            }
          >
            {states.map((state) => (
              <MenuItem key={state.id} value={state.id}>
                {state.name}
              </MenuItem>
            ))}
          </TextField>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
        <Button variant="contained" disabled={saving || !draft.userId || !draft.countryCode} onClick={onSave}>
          {t('common.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

function EmailField({
  draft,
  lookupEmail,
  lookupError,
  onLookupError,
  onChange,
}: {
  draft: GrantDraft;
  lookupEmail?: (email: string) => Promise<{ userId: string; email: string }>;
  lookupError: string | null;
  onLookupError: (value: string | null) => void;
  onChange: (draft: GrantDraft) => void;
}) {
  const { t } = useTranslation();
  if (draft.userId && !lookupEmail) {
    return <Box sx={{ mt: 1 }}>{draft.email}</Box>;
  }
  return (
    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
      <TextField
        fullWidth
        label={t('admin.countryAdmins.email', 'Email')}
        value={draft.email}
        error={!!lookupError}
        helperText={lookupError || ' '}
        onChange={(event) => onChange({ ...draft, email: event.target.value, userId: '' })}
      />
      <Button
        sx={{ mt: 1 }}
        onClick={() => void findUser(draft.email, lookupEmail, onChange, draft, onLookupError)}
      >
        {t('admin.countryAdmins.lookup', 'Find')}
      </Button>
    </Box>
  );
}

async function findUser(
  email: string,
  lookup: ((email: string) => Promise<{ userId: string; email: string }>) | undefined,
  onChange: (draft: GrantDraft) => void,
  draft: GrantDraft,
  onLookupError: (value: string | null) => void
) {
  if (!lookup) return;
  try {
    const user = await lookup(email);
    onLookupError(null);
    onChange({ ...draft, userId: user.userId, email: user.email });
  } catch (error: any) {
    onLookupError(error?.response?.data?.message || 'User not found');
  }
}

export default CountryAdminGrantDialog;
