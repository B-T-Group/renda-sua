import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgentReferralLookup } from '../../hooks/useAgentReferralLookup';
import AgentReferralCodeField from './AgentReferralCodeField';

export interface ReferralCodeEntryButtonProps {
  value: string;
  onChange: (value: string) => void;
  labelKey?: string;
  labelDefault?: string;
  helpKey?: string;
  helpDefault?: string;
}

const ReferralCodeEntryButton: React.FC<ReferralCodeEntryButtonProps> = ({
  value,
  onChange,
  labelKey,
  labelDefault,
  helpKey,
  helpDefault,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const {
    result: lookupResult,
    loading: lookupLoading,
    error: lookupError,
  } = useAgentReferralLookup(open ? draft : '');
  const trimmed = value.trim().toUpperCase();

  const handleOpen = () => {
    setDraft(value);
    setOpen(true);
  };

  const handleSave = () => {
    onChange(draft.trim().toUpperCase());
    setOpen(false);
  };

  const handleClear = () => {
    setDraft('');
    onChange('');
    setOpen(false);
  };

  return (
    <Box>
      {trimmed ? (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Box sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            {t('referrals.codeApplied', 'Referral code: {{code}}', {
              code: trimmed,
            })}
          </Box>
          <Link
            component="button"
            type="button"
            variant="body2"
            onClick={handleOpen}
            underline="hover"
          >
            {t('referrals.changeCode', 'Change')}
          </Link>
        </Stack>
      ) : (
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={handleOpen}
          underline="hover"
        >
          {t('referrals.haveCodeLink', 'Have a referral code?')}
        </Link>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {t('referrals.enterCodeTitle', 'Enter referral code')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <AgentReferralCodeField
              value={draft}
              onChange={setDraft}
              labelKey={labelKey}
              labelDefault={labelDefault}
              helpKey={helpKey}
              helpDefault={helpDefault}
              lookupResult={lookupResult}
              lookupLoading={lookupLoading}
              lookupError={lookupError}
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              {trimmed || draft.trim() ? (
                <Button onClick={handleClear} color="inherit">
                  {t('common.clear', 'Clear')}
                </Button>
              ) : null}
              <Button onClick={() => setOpen(false)} color="inherit">
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button onClick={handleSave} variant="contained">
                {t('common.save', 'Save')}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ReferralCodeEntryButton;
